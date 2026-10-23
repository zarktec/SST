import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { bogotaDate } from "@/core/calendar/business-days";
import { loadBusinessCalendar } from "@/core/calendar/service";
import { decrypt } from "@/core/crypto/envelope";
import { assertWritable } from "@/core/plans/limits";
import { sendMail } from "@/core/mail";
import { emailsForRoles } from "@/core/notify/recipients";
import { todayYmd } from "@/lib/dates";
import { createAction } from "@/modules/capa/service";
import { getParameter } from "@/modules/platform/catalogs/service";
import {
  closeBlockers,
  diseaseSchema,
  incidentSchema,
  investigationDeadline,
  isSevere,
  reportDeadline,
  reportState,
  type DiseaseInput,
  type IncidentInput,
} from "./rules";
import type { TeamMember } from "@/core/db/schema/incidents";

const {
  incident,
  incidentInvestigation,
  occupationalDisease,
  worker,
  tenant,
  workCenter,
  sensitiveAccessLog,
} = schema;
export type Incident = typeof incident.$inferSelect;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });

export class IncidentError extends Error {}

async function calendarFor(date: string) {
  const y = Number(date.slice(0, 4));
  return loadBusinessCalendar(y - 1, y + 1);
}

/**
 * Registra el evento. Calcula el plazo de 2 días hábiles para reportar a la ARL y a la EPS desde que la empresa lo conoce y avisa
 * al responsable del SG-SST. Bogotá es UTC-5: la hora se interpreta en hora de Colombia.
 */
export async function reportIncident(tenantId: string, userId: string, input: IncidentInput) {
  const d = incidentSchema.parse(input);
  await assertWritable(tenantId);
  const occurredAt = new Date(`${d.occurredDate}T${d.occurredTime}:00-05:00`);
  if (Number.isNaN(occurredAt.getTime())) throw new IncidentError("Fecha u hora inválida");
  if (occurredAt.getTime() > Date.now() + 3_600_000)
    throw new IncidentError("El evento no puede ser futuro");
  const knownAt = new Date();
  const days = await getParameter("at.reporte_arl_dias_habiles", 2);
  const deadline = reportDeadline(knownAt, days, await calendarFor(bogotaDate(knownAt)));
  const created = await withTenant(ctxOf(tenantId, userId), async (tx) => {
    if (d.workerId) {
      const [w] = await tx
        .select({ id: worker.id })
        .from(worker)
        .where(
          and(eq(worker.id, d.workerId), eq(worker.tenantId, tenantId), isNull(worker.deletedAt)),
        );
      if (!w) throw new IncidentError("Persona no encontrada");
    }
    const [i] = await tx
      .insert(incident)
      .values({
        tenantId,
        kind: d.kind,
        workerId: d.workerId,
        affectedName: d.affectedName,
        occurredAt,
        place: d.place,
        workCenterId: d.workCenterId,
        activity: d.activity,
        description: d.description,
        bodyPart: d.bodyPart,
        injuryType: d.injuryType,
        severity: d.severity,
        witnesses: d.witnesses,
        knownAt,
        arlDeadline: deadline,
        reportedBy: userId,
      })
      .returning({ id: incident.id });
    return i.id;
  });
  const to = await emailsForRoles(tenantId, ["RESPONSABLE_SST", "ADMIN_EMPRESA"]);
  await Promise.all(
    to.map((email) =>
      sendMail({
        to: email,
        subject: `${d.kind === "accident" ? "Accidente" : "Incidente"} de trabajo reportado — plazo ARL/EPS ${deadline}`,
        html: `<p>Se reportó un ${d.kind === "accident" ? "accidente" : "incidente"} de trabajo en ${d.place} (${d.occurredDate}). Debe informarse a la ARL y a la EPS a más tardar el <strong>${deadline}</strong> (2 días hábiles).</p>`,
      }).catch(() => undefined),
    ),
  );
  return { id: created, arlDeadline: deadline };
}

export async function markReported(
  tenantId: string,
  userId: string,
  id: string,
  input: { arlReportedAt: string; epsReportedAt?: string; reportNumber?: string },
) {
  await assertWritable(tenantId);
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymd.test(input.arlReportedAt) || (input.epsReportedAt && !ymd.test(input.epsReportedAt)))
    throw new IncidentError("Fecha inválida");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(incident)
      .set({
        arlReportedAt: input.arlReportedAt,
        epsReportedAt: input.epsReportedAt || input.arlReportedAt,
        arlReportNumber: input.reportNumber?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(incident.id, id), eq(incident.tenantId, tenantId)))
      .returning({ id: incident.id });
    if (!r.length) throw new IncidentError("Evento no encontrado");
  });
}

export async function listIncidents(tenantId: string) {
  const today = todayYmd();
  const cal = await calendarFor(today);
  return withTenant(ctxOf(tenantId), async (tx) => {
    const rows = await tx
      .select({ i: incident, workerName: worker.fullName, inv: incidentInvestigation })
      .from(incident)
      .leftJoin(worker, eq(worker.id, incident.workerId))
      .leftJoin(incidentInvestigation, eq(incidentInvestigation.incidentId, incident.id))
      .where(eq(incident.tenantId, tenantId))
      .orderBy(desc(incident.occurredAt));
    return rows.map(({ i, workerName, inv }) => ({
      ...i,
      person: workerName ?? i.affectedName ?? "—",
      report: i.arlDeadline ? reportState(i.arlDeadline, i.arlReportedAt, today, cal) : null,
      investigation: inv
        ? {
            deadline: inv.deadline,
            done: Boolean(inv.completedAt),
            overdue: !inv.completedAt && inv.deadline < today,
          }
        : null,
    }));
  });
}

export async function getIncident(tenantId: string, id: string) {
  const list = await listIncidents(tenantId);
  const i = list.find((x) => x.id === id);
  if (!i) return null;
  const inv = await withTenant(
    ctxOf(tenantId),
    async (tx) =>
      (
        await tx
          .select()
          .from(incidentInvestigation)
          .where(eq(incidentInvestigation.incidentId, id))
      )[0] ?? null,
  );
  return { incident: i, investigation: inv };
}

/** Abre la investigación con su plazo (15 días desde el evento, parametrizable) y el estado "en investigación". */
export async function startInvestigation(tenantId: string, userId: string, id: string) {
  await assertWritable(tenantId);
  const days = await getParameter("at.investigacion_dias", 15);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [i] = await tx
      .select()
      .from(incident)
      .where(and(eq(incident.id, id), eq(incident.tenantId, tenantId)));
    if (!i) throw new IncidentError("Evento no encontrado");
    const [dup] = await tx
      .select({ id: incidentInvestigation.id })
      .from(incidentInvestigation)
      .where(eq(incidentInvestigation.incidentId, id));
    if (dup) throw new IncidentError("Ya hay una investigación abierta");
    await tx.insert(incidentInvestigation).values({
      tenantId,
      incidentId: id,
      deadline: investigationDeadline(bogotaDate(i.occurredAt), days),
    });
    await tx
      .update(incident)
      .set({ status: "investigating", updatedAt: new Date() })
      .where(eq(incident.id, id));
  });
}

export async function saveInvestigation(
  tenantId: string,
  userId: string,
  id: string,
  input: {
    team: TeamMember[];
    method: "five_whys" | "cause_tree";
    analysis: unknown;
    immediateCauses?: string;
    basicCauses?: string;
    conclusions?: string;
  },
) {
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [inv] = await tx
      .select()
      .from(incidentInvestigation)
      .where(
        and(eq(incidentInvestigation.incidentId, id), eq(incidentInvestigation.tenantId, tenantId)),
      );
    if (!inv) throw new IncidentError("La investigación no se ha abierto");
    if (inv.completedAt) throw new IncidentError("La investigación ya está cerrada");
    const clean = (s?: string) => s?.trim() || null;
    await tx
      .update(incidentInvestigation)
      .set({
        team: input.team.filter((m) => m.name.trim()),
        method: input.method,
        analysis: input.analysis,
        immediateCauses: clean(input.immediateCauses),
        basicCauses: clean(input.basicCauses),
        conclusions: clean(input.conclusions),
        updatedAt: new Date(),
      })
      .where(eq(incidentInvestigation.id, inv.id));
  });
}

/** Plan de acción de la investigación: cada acción se crea en el módulo central de acciones (CAPA) y queda vinculada al evento. */
export async function addInvestigationAction(
  tenantId: string,
  userId: string,
  id: string,
  a: {
    title: string;
    responsibleName: string;
    dueDate: string;
    type?: "corrective" | "preventive";
  },
) {
  const [existing] = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ id: incidentInvestigation.id })
      .from(incidentInvestigation)
      .where(
        and(eq(incidentInvestigation.incidentId, id), eq(incidentInvestigation.tenantId, tenantId)),
      ),
  );
  if (!existing) throw new IncidentError("La investigación no se ha abierto");
  return createAction(
    tenantId,
    userId,
    {
      type: a.type ?? "corrective",
      title: a.title,
      responsibleName: a.responsibleName,
      dueDate: a.dueDate,
    },
    { source: "incident", sourceId: `${id}:${crypto.randomUUID()}` },
  );
}

export async function investigationActions(tenantId: string, id: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(schema.correctiveAction)
      .where(
        and(
          eq(schema.correctiveAction.tenantId, tenantId),
          eq(schema.correctiveAction.source, "incident"),
        ),
      )
      .orderBy(asc(schema.correctiveAction.dueDate))
      .then((rows) => rows.filter((r) => r.sourceId?.startsWith(`${id}:`))),
  );
}

export async function remitToArl(tenantId: string, userId: string, id: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new IncidentError("Fecha inválida");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(incidentInvestigation)
      .set({ remittedArlAt: date, updatedAt: new Date() })
      .where(
        and(eq(incidentInvestigation.incidentId, id), eq(incidentInvestigation.tenantId, tenantId)),
      )
      .returning({ id: incidentInvestigation.id });
    if (!r.length) throw new IncidentError("La investigación no se ha abierto");
  });
}

/** Cierra la investigación solo si cumple los requisitos (equipo, análisis, causas, plan de acción y remisión si es grave). */
export async function completeInvestigation(tenantId: string, userId: string, id: string) {
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [i] = await tx
      .select()
      .from(incident)
      .where(and(eq(incident.id, id), eq(incident.tenantId, tenantId)));
    const [inv] = await tx
      .select()
      .from(incidentInvestigation)
      .where(eq(incidentInvestigation.incidentId, id));
    if (!i || !inv) throw new IncidentError("La investigación no se ha abierto");
    if (inv.completedAt) throw new IncidentError("La investigación ya está cerrada");
    const actions = (
      await tx
        .select({ s: schema.correctiveAction.sourceId })
        .from(schema.correctiveAction)
        .where(
          and(
            eq(schema.correctiveAction.tenantId, tenantId),
            eq(schema.correctiveAction.source, "incident"),
          ),
        )
    ).filter((a) => a.s?.startsWith(`${id}:`)).length;
    const blockers = closeBlockers({
      team: inv.team,
      method: inv.method,
      analysis: inv.analysis,
      immediateCauses: inv.immediateCauses,
      basicCauses: inv.basicCauses,
      actionCount: actions,
      severe: isSevere(i.severity),
      remittedArlAt: inv.remittedArlAt,
    });
    if (blockers.length) throw new IncidentError(blockers.join(". "));
    await tx
      .update(incidentInvestigation)
      .set({ completedAt: new Date(), updatedAt: new Date() })
      .where(eq(incidentInvestigation.id, inv.id));
    await tx
      .update(incident)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(incident.id, id));
  });
}

/** Lecciones aprendidas: se redactan y se registra la fecha de divulgación. */
export async function discloseLessons(
  tenantId: string,
  userId: string,
  id: string,
  lessons: string,
) {
  if (lessons.trim().length < 10) throw new IncidentError("Redacta las lecciones aprendidas");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(incidentInvestigation)
      .set({
        lessonsLearned: lessons.trim(),
        lessonsDisclosedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(incidentInvestigation.incidentId, id), eq(incidentInvestigation.tenantId, tenantId)),
      )
      .returning({ id: incidentInvestigation.id });
    if (!r.length) throw new IncidentError("La investigación no se ha abierto");
  });
}

/**
 * Datos precargados para el formato de reporte de la ARL (FURAT). Incluye el documento descifrado del trabajador, por lo que
 * la consulta queda en el registro de accesos sensibles.
 */
export async function furatData(tenantId: string, userId: string, id: string) {
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [i] = await tx
      .select()
      .from(incident)
      .where(and(eq(incident.id, id), eq(incident.tenantId, tenantId)));
    if (!i) return null;
    const [t] = await tx.select().from(tenant).where(eq(tenant.id, tenantId));
    const [w] = i.workerId ? await tx.select().from(worker).where(eq(worker.id, i.workerId)) : [];
    const [c] = i.workCenterId
      ? await tx.select().from(workCenter).where(eq(workCenter.id, i.workCenterId))
      : [];
    await tx.insert(sensitiveAccessLog).values({
      tenantId,
      actorId: userId,
      entity: "furat",
      entityId: id,
      reason: "datos precargados del FURAT",
    });
    return {
      empleador: {
        razonSocial: t.legalName,
        nit: t.nit ? `${t.nit}${t.nitDv ? `-${t.nitDv}` : ""}` : null,
        ciiu: t.ciiu,
        arl: t.arl,
        representante: t.legalRepresentative,
        claseRiesgo: t.riskClass,
      },
      trabajador: w
        ? {
            nombre: w.fullName,
            tipoDocumento: w.idType,
            documento: decrypt(w.idEncrypted, `worker:${tenantId}:id`),
            cargo: w.position,
            fechaIngreso: w.startDate,
            eps: w.eps,
            afp: w.afp,
            telefono: w.phone,
            correo: w.email,
          }
        : { nombre: i.affectedName },
      evento: {
        tipo: i.kind === "accident" ? "Accidente de trabajo" : "Incidente de trabajo",
        fecha: bogotaDate(i.occurredAt),
        hora: new Intl.DateTimeFormat("es-CO", {
          timeStyle: "short",
          timeZone: "America/Bogota",
        }).format(i.occurredAt),
        lugar: i.place,
        sede: c?.name ?? null,
        actividad: i.activity,
        descripcion: i.description,
        parteCuerpo: i.bodyPart,
        tipoLesion: i.injuryType,
        gravedad: i.severity,
        testigos: i.witnesses,
        conocidoEl: bogotaDate(i.knownAt),
        plazoReporte: i.arlDeadline,
      },
    };
  });
}

// ---------- Enfermedad laboral ----------

export async function addDisease(tenantId: string, userId: string, input: DiseaseInput) {
  const d = diseaseSchema.parse(input);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [w] = await tx
      .select({ id: worker.id })
      .from(worker)
      .where(
        and(eq(worker.id, d.workerId), eq(worker.tenantId, tenantId), isNull(worker.deletedAt)),
      );
    if (!w) throw new IncidentError("Persona no encontrada");
    const [r] = await tx
      .insert(occupationalDisease)
      .values({ tenantId, ...d })
      .returning({ id: occupationalDisease.id });
    return r.id;
  });
}

export async function qualifyDisease(
  tenantId: string,
  userId: string,
  id: string,
  input: {
    qualification: "occupational" | "common";
    qualifiedOn: string;
    qualifiedBy: string;
    followUp?: string;
  },
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.qualifiedOn)) throw new IncidentError("Fecha inválida");
  if (!input.qualifiedBy.trim())
    throw new IncidentError("Indica quién calificó (EPS, ARL o junta)");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(occupationalDisease)
      .set({
        qualification: input.qualification,
        qualifiedOn: input.qualifiedOn,
        qualifiedBy: input.qualifiedBy.trim(),
        followUp: input.followUp?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(occupationalDisease.id, id), eq(occupationalDisease.tenantId, tenantId)))
      .returning({ id: occupationalDisease.id });
    if (!r.length) throw new IncidentError("Caso no encontrado");
  });
}

export async function listDiseases(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ d: occupationalDisease, name: worker.fullName })
      .from(occupationalDisease)
      .innerJoin(worker, eq(worker.id, occupationalDisease.workerId))
      .where(eq(occupationalDisease.tenantId, tenantId))
      .orderBy(desc(occupationalDisease.detectedOn))
      .then((r) => r.map((x) => ({ ...x.d, workerName: x.name }))),
  );
}
