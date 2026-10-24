import "server-only";
import { and, eq } from "drizzle-orm";
import { bogotaDate } from "@/core/calendar/business-days";
import { schema, withTenant } from "@/core/db";
import type { PermissionModule } from "@/core/rbac/roles";
import type { Report, Table } from "@/core/reports/types";
import { todayYmd } from "@/lib/dates";
import { getPlan } from "@/modules/annual-plan/service";
import { buildReviewInputs, listReviews } from "@/modules/audits/service";
import { getAssessment, listAssessments, listImprovements } from "@/modules/assessment/service";
import { listActions } from "@/modules/capa/service";
import { masterList } from "@/modules/documents/service";
import { getMatrix as getHazardMatrix, listMatrices } from "@/modules/hazards/service";
import { dashboard } from "@/modules/indicators/service";
import {
  getIncident,
  investigationActions,
  listDiseases,
  listIncidents,
} from "@/modules/incidents/service";
import { getMatrix as getLegalMatrix } from "@/modules/legal/service";
import { annualStats, listCrashes, listVehicles } from "@/modules/pesv/service";
import { listCourses, listSessions } from "@/modules/training/service";

const { committee, committeeMinutes, trainingAttendance } = schema;
const ctxOf = (tenantId: string) => ({ tenantId });
const yes = (b: boolean | null | undefined) => (b ? "Sí" : "No");
const fmtDate = (d: Date | string | null | undefined) =>
  !d ? "" : typeof d === "string" ? d : bogotaDate(d);
const num = (v: number | null | undefined) => (v === null || v === undefined ? "" : v);
const table = (name: string, head: string[], rows: Table["rows"]): Table => ({ name, head, rows });
const note = (heading: string, ...text: string[]) => ({ heading, text });

export type ReportDef = {
  id: string;
  title: string;
  description: string;
  /** Módulo de permisos que debe poder exportar. */
  module: PermissionModule;
  /** Carpeta del ciclo PHVA en la carpeta de inspección. */
  phva: "1-Planear" | "2-Hacer" | "3-Verificar" | "4-Actuar";
  yearly: boolean;
};

export const REPORTS: ReportDef[] = [
  {
    id: "estandares",
    title: "Autoevaluación de estándares mínimos y plan de mejoramiento",
    description:
      "Estructura de la autoevaluación (Res. 0312, art. 27) con datos listos para transcribir a la plataforma del Ministerio y copia para la ARL.",
    module: "standards",
    phva: "1-Planear",
    yearly: true,
  },
  {
    id: "matriz-peligros",
    title: "Matriz de peligros y valoración de riesgos (GTC 45)",
    description: "Versión aprobada vigente de la matriz.",
    module: "hazard_matrix",
    phva: "1-Planear",
    yearly: false,
  },
  {
    id: "matriz-legal",
    title: "Matriz legal",
    description: "Normas y requisitos evaluados por la empresa.",
    module: "legal_matrix",
    phva: "1-Planear",
    yearly: false,
  },
  {
    id: "plan-anual",
    title: "Plan anual de trabajo",
    description: "Cronograma de actividades del año con su estado.",
    module: "annual_plan",
    phva: "1-Planear",
    yearly: true,
  },
  {
    id: "documentos",
    title: "Lista maestra de documentos",
    description: "Documentos controlados con su versión vigente y fecha de revisión.",
    module: "documents",
    phva: "1-Planear",
    yearly: false,
  },
  {
    id: "plan-capacitacion",
    title: "Plan de capacitación",
    description: "Cursos y sesiones del año.",
    module: "training",
    phva: "2-Hacer",
    yearly: true,
  },
  {
    id: "actas-comites",
    title: "Actas de los comités (COPASST/Vigía y Convivencia)",
    description:
      "Las actas del Comité de Convivencia excluyen el contenido y la información confidencial de las quejas.",
    module: "committees",
    phva: "2-Hacer",
    yearly: true,
  },
  {
    id: "pesv-anual",
    title: "Reporte anual de autogestión del PESV",
    description: "Conteos base del año, vehículos y siniestros viales.",
    module: "pesv",
    phva: "2-Hacer",
    yearly: true,
  },
  {
    id: "eventos",
    title: "Accidentes, incidentes y enfermedad laboral",
    description: "Datos para diligenciar el FURAT y el FUREL en la ARL.",
    module: "incidents",
    phva: "3-Verificar",
    yearly: true,
  },
  {
    id: "indicadores",
    title: "Indicadores del periodo con fichas técnicas",
    description: "Resultado, meta, fórmula y análisis de cada indicador.",
    module: "indicators",
    phva: "3-Verificar",
    yearly: true,
  },
  {
    id: "revision-direccion",
    title: "Informe de revisión por la alta dirección",
    description: "Entradas, conclusiones, decisiones y firma.",
    module: "management_review",
    phva: "3-Verificar",
    yearly: true,
  },
  {
    id: "rendicion-cuentas",
    title: "Informe de rendición de cuentas",
    description: "Resumen anual del SG-SST para la alta dirección y los trabajadores.",
    module: "indicators",
    phva: "3-Verificar",
    yearly: true,
  },
  {
    id: "acciones",
    title: "Acciones correctivas, preventivas y de mejora",
    description: "Todas las acciones con su origen, responsable y estado.",
    module: "actions",
    phva: "4-Actuar",
    yearly: false,
  },
];

export const reportDef = (id: string) => REPORTS.find((r) => r.id === id) ?? null;

export async function buildReport(
  id: string,
  tenantId: string,
  year: number,
  tenantName: string,
): Promise<Report | null> {
  const def = reportDef(id);
  if (!def) return null;
  const sub = def.yearly ? `${tenantName} · ${year}` : tenantName;
  const mk = (sections: Report["sections"]): Report => ({
    id,
    title: def.title,
    subtitle: sub,
    sections,
  });
  const today = todayYmd();

  switch (id) {
    case "estandares": {
      const all = await listAssessments(tenantId);
      const a = all.find((x) => x.year === year) ?? all[0];
      if (!a) return mk([note("Sin datos", "Aún no hay autoevaluación de estándares mínimos.")]);
      const full = await getAssessment(tenantId, a.id);
      const improvements = await listImprovements(tenantId, a.id);
      return mk([
        note(
          "Resumen",
          `Autoevaluación ${a.year} · grupo de ${a.standardsGroup} estándares · estado: ${a.status === "closed" ? "cerrada" : "en curso"}.`,
          `Puntaje: ${a.scorePct ?? full?.live.pct ?? "—"}% · valoración: ${a.ratingLevel ?? "sin cerrar"}.`,
          a.registeredMinistryAt
            ? `Registrada en la plataforma del Ministerio del Trabajo el ${a.registeredMinistryAt}.`
            : "Aún no se ha confirmado el registro en la plataforma del Ministerio del Trabajo.",
        ),
        {
          heading: "Ítems evaluados",
          table: table(
            "Estándares",
            [
              "Código",
              "Estándar",
              "Criterio",
              "Estado",
              "Responsable",
              "Evidencia",
              "Justificación",
            ],
            (full?.items ?? []).map((i) => [
              i.itemCode,
              i.snapshot.standardName,
              i.snapshot.criterion,
              {
                cumple: "Cumple",
                no_cumple: "No cumple",
                no_aplica: "No aplica",
                pending: "Sin calificar",
              }[i.status] ?? i.status,
              i.responsibleName,
              i.evidence,
              i.justification,
            ]),
          ),
        },
        {
          heading: "Plan de mejoramiento",
          table: table(
            "Plan de mejoramiento",
            ["Ítem", "Acción", "Responsable", "Fecha límite", "Estado"],
            improvements.map((i) => [
              i.itemCode,
              i.description,
              i.responsibleName,
              i.dueDate,
              i.status,
            ]),
          ),
        },
      ]);
    }
    case "matriz-peligros": {
      const ms = await listMatrices(tenantId);
      const m = ms.find((x) => x.status === "approved") ?? ms[0];
      if (!m) return mk([note("Sin datos", "Aún no hay matriz de peligros.")]);
      const d = await getHazardMatrix(tenantId, m.id);
      return mk([
        note(
          "Versión",
          `Versión ${m.version} · ${m.status === "approved" ? "aprobada" : "borrador (aún no aprobada)"}${m.approvedAt ? ` el ${fmtDate(m.approvedAt)}` : ""}.`,
          `Resumen: ${d?.summary.total ?? 0} peligros · nivel I: ${d?.summary.I ?? 0}, II: ${d?.summary.II ?? 0}, III: ${d?.summary.III ?? 0}, IV: ${d?.summary.IV ?? 0}.`,
        ),
        {
          heading: "Peligros identificados y valorados",
          table: table(
            "Matriz de peligros",
            [
              "Proceso",
              "Actividad",
              "Tarea",
              "Rutinaria",
              "Familia",
              "Peligro",
              "Efectos",
              "Controles existentes",
              "NP",
              "NR",
              "Nivel",
              "Aceptabilidad",
              "Eliminación",
              "Sustitución",
              "Ingeniería",
              "Administrativos",
              "EPP",
              "Requisito legal",
            ],
            (d?.rows ?? []).map((r) => [
              r.process,
              r.activity,
              r.task,
              yes(r.routine),
              r.hazardFamily,
              r.hazardName,
              r.effects,
              [r.existingSource, r.existingMedium, r.existingPerson].filter(Boolean).join(" / "),
              num(r.np),
              num(r.nr),
              r.riskLevel,
              r.acceptability,
              r.ctrlElimination,
              r.ctrlSubstitution,
              r.ctrlEngineering,
              r.ctrlAdmin,
              r.ctrlEpp,
              r.legalRequirement,
            ]),
          ),
        },
      ]);
    }
    case "matriz-legal": {
      const m = await getLegalMatrix(tenantId);
      return mk([
        note(
          "Resumen",
          `Normas versión ${m.version.norms ?? "—"} · requisitos versión ${m.version.requirements ?? "—"}.`,
        ),
        {
          heading: "Normas y requisitos",
          table: table(
            "Matriz legal",
            [
              "Tipo",
              "Norma / artículo",
              "Detalle",
              "Aplica",
              "Cumplimiento",
              "Responsable",
              "Próxima revisión",
            ],
            m.lines.map((l) => [
              l.kind === "norm" ? "Norma" : "Requisito",
              l.title,
              l.detail,
              l.entry?.applies,
              l.entry?.compliance,
              l.entry?.responsibleName,
              l.entry?.nextReviewDate,
            ]),
          ),
        },
      ]);
    }
    case "plan-anual": {
      const p = await getPlan(tenantId, year);
      if (!p) return mk([note("Sin datos", `No hay plan anual de trabajo ${year}.`)]);
      return mk([
        note(
          "Resumen",
          `Estado: ${p.plan.status === "signed" ? "firmado" : "borrador"} · avance: ${p.progress.done} de ${p.progress.total} actividades (${p.progress.pct}%).`,
          p.plan.employerSignedAt
            ? `Firma del empleador: ${fmtDate(p.plan.employerSignedAt)}.`
            : "Sin firma del empleador.",
          p.plan.responsibleSignedAt
            ? `Firma del responsable del SG-SST: ${fmtDate(p.plan.responsibleSignedAt)}.`
            : "Sin firma del responsable.",
        ),
        {
          heading: "Actividades",
          table: table(
            "Plan anual",
            [
              "PHVA",
              "Actividad",
              "Objetivo",
              "Responsable",
              "Inicio",
              "Fin",
              "Estado",
              "Evidencia",
            ],
            p.activities.map((a) => [
              a.phva,
              a.title,
              a.objective,
              a.responsibleName,
              a.startDate,
              a.endDate,
              a.status,
              a.evidence,
            ]),
          ),
        },
      ]);
    }
    case "documentos": {
      const docs = await masterList(tenantId);
      return mk([
        {
          heading: "Lista maestra",
          table: table(
            "Documentos",
            [
              "Código",
              "Título",
              "Tipo",
              "Versión vigente",
              "Vigente desde",
              "Aprobó",
              "Próxima revisión",
              "Estado",
            ],
            docs.map((d) => [
              d.code,
              d.title,
              d.kind,
              d.current ? `v${d.current.version}` : "—",
              d.current?.effectiveFrom,
              d.current?.approvedName,
              d.current?.nextReviewOn,
              d.review,
            ]),
          ),
        },
      ]);
    }
    case "plan-capacitacion": {
      const [courses, sessions, attendance] = await Promise.all([
        listCourses(tenantId),
        listSessions(tenantId),
        withTenant(ctxOf(tenantId), (tx) =>
          tx
            .select({ sessionId: trainingAttendance.sessionId })
            .from(trainingAttendance)
            .where(eq(trainingAttendance.tenantId, tenantId)),
        ),
      ]);
      const n = (id: string) => attendance.filter((a) => a.sessionId === id).length;
      return mk([
        {
          heading: "Cursos",
          table: table(
            "Cursos",
            ["Curso", "Tipo", "Horas", "Vigencia (meses)", "Nota mínima"],
            courses.map((c) => [
              c.name,
              c.kind,
              c.durationHours,
              num(c.validityMonths),
              num(c.passScore),
            ]),
          ),
        },
        {
          heading: `Sesiones ${year}`,
          table: table(
            "Sesiones",
            ["Fecha", "Curso", "Lugar", "Capacitador", "Estado", "Asistentes"],
            sessions
              .filter((s) => s.session.date.startsWith(String(year)))
              .map((s) => [
                s.session.date,
                s.courseName,
                s.session.location,
                s.session.trainer,
                s.session.status,
                n(s.session.id),
              ]),
          ),
        },
      ]);
    }
    case "actas-comites": {
      const rows = await withTenant(ctxOf(tenantId), (tx) =>
        tx
          .select({ m: committeeMinutes, kind: committee.kind })
          .from(committeeMinutes)
          .innerJoin(committee, eq(committee.id, committeeMinutes.committeeId))
          .where(and(eq(committeeMinutes.tenantId, tenantId))),
      );
      const yr = rows
        .filter((r) => r.m.date.startsWith(String(year)))
        .sort((a, b) => a.m.date.localeCompare(b.m.date));
      const label = {
        copasst: "COPASST",
        vigia: "Vigía SST",
        ccl: "Convivencia Laboral",
      } as Record<string, string>;
      return mk([
        note(
          "Alcance",
          "Las actas del Comité de Convivencia Laboral no incluyen el contenido ni la información confidencial de las quejas (Ley 1581 de 2012 y Res. 3461 de 2025).",
        ),
        {
          heading: "Actas",
          table: table(
            "Actas",
            ["Comité", "Tipo", "Fecha", "Agenda", "Contenido", "Asistentes"],
            yr.map((r) => [
              label[r.kind] ?? r.kind,
              r.m.kind,
              r.m.date,
              r.m.agenda,
              r.kind === "ccl" ? "(reservado)" : r.m.content,
              Array.isArray(r.m.attendeeIds) ? r.m.attendeeIds.length : 0,
            ]),
          ),
        },
      ]);
    }
    case "pesv-anual": {
      const [s, vehicles, crashes] = await Promise.all([
        annualStats(tenantId, year),
        listVehicles(tenantId),
        listCrashes(tenantId),
      ]);
      return mk([
        note(
          "Conteos base",
          `Vehículos con SOAT y revisión vigentes: ${s.vehiclesDocsOk} de ${s.vehicles}.`,
          `Conductores con licencia vigente: ${s.driversLicenseOk} de ${s.drivers}.`,
          `Vehículos con preoperacional en 30 días: ${s.preopVehiclesLast30} de ${s.vehicles}.`,
          `Siniestros viales ${year}: ${s.crashes} · lesionados ${s.injured} · muertos ${s.fatalities} · por vehículo ${s.crashesPerVehicle ?? "—"}.`,
          "Las fórmulas oficiales de los indicadores del PESV están pendientes de validación.",
        ),
        {
          heading: "Vehículos",
          table: table(
            "Vehículos",
            ["Placa", "Tipo", "Propiedad", "SOAT vence", "Revisión técnico-mecánica vence"],
            vehicles.map((v) => [v.plate, v.kind, v.ownership, v.soatExpiresOn, v.rtmExpiresOn]),
          ),
        },
        {
          heading: "Siniestros viales",
          table: table(
            "Siniestros",
            ["Fecha", "Placa", "Conductor", "Lugar", "Lesionados", "Muertos", "Descripción"],
            crashes
              .filter((c) => bogotaDate(c.occurredAt).startsWith(String(year)))
              .map((c) => [
                bogotaDate(c.occurredAt),
                c.plate,
                c.driverName,
                c.place,
                c.injured,
                c.fatalities,
                c.description,
              ]),
          ),
        },
      ]);
    }
    case "eventos": {
      const [events, diseases] = await Promise.all([
        listIncidents(tenantId),
        listDiseases(tenantId),
      ]);
      return mk([
        note(
          "Alcance",
          "Datos para diligenciar el FURAT (accidentes) y el FUREL (enfermedad laboral) en el portal de la ARL. No incluye el documento de identidad: consulta los datos precargados del evento.",
        ),
        {
          heading: "Accidentes e incidentes",
          table: table(
            "Eventos",
            [
              "Fecha",
              "Tipo",
              "Persona",
              "Lugar",
              "Gravedad",
              "Parte del cuerpo",
              "Tipo de lesión",
              "Plazo ARL",
              "Reportado a la ARL",
              "N.° de reporte",
              "Estado",
            ],
            events
              .filter((e) => bogotaDate(e.occurredAt).startsWith(String(year)))
              .map((e) => [
                bogotaDate(e.occurredAt),
                e.kind === "accident" ? "Accidente" : "Incidente",
                e.person,
                e.place,
                e.severity,
                e.bodyPart,
                e.injuryType,
                e.arlDeadline,
                e.arlReportedAt,
                e.arlReportNumber,
                e.status,
              ]),
          ),
        },
        {
          heading: "Enfermedad laboral",
          table: table(
            "Enfermedad laboral",
            ["Persona", "Diagnóstico", "Detección", "Calificación", "Calificó", "Caso nuevo"],
            diseases
              .filter((d) => d.detectedOn.startsWith(String(year)))
              .map((d) => [
                d.workerName,
                d.diagnosis,
                d.detectedOn,
                d.qualification,
                d.qualifiedBy,
                yes(d.isNew),
              ]),
          ),
        },
      ]);
    }
    case "indicadores": {
      const ref = year >= Number(today.slice(0, 4)) ? `${today.slice(0, 7)}-01` : `${year}-12-01`;
      const ind = await dashboard(tenantId, ref);
      return mk([
        note(
          "Periodo",
          `Resultados con corte a ${ref.slice(0, 7)}. Fórmulas, factores y metas del catálogo normativo (provisionales hasta validación del experto SST).`,
        ),
        {
          heading: "Fichas técnicas",
          table: table(
            "Indicadores",
            [
              "Indicador",
              "Tipo",
              "Numerador",
              "Denominador",
              "Factor",
              "Periodicidad",
              "Meta",
              "Resultado",
              "Estado",
              "Norma",
              "Análisis",
            ],
            ind.map((i) => [
              i.name,
              i.type,
              i.numerator,
              i.denominator,
              i.factor,
              i.periodicity,
              num(i.target),
              num(i.current.value),
              i.status,
              i.sourceNorm,
              i.analysis,
            ]),
          ),
        },
      ]);
    }
    case "revision-direccion": {
      const r = (await listReviews(tenantId))
        .filter((x) => x.year === year)
        .sort((a, b) => (a.status === "signed" ? -1 : 1) - (b.status === "signed" ? -1 : 1))[0];
      if (!r) return mk([note("Sin datos", `No hay revisión por la dirección ${year}.`)]);
      const i = r.inputs;
      return mk([
        note(
          "Datos de la reunión",
          `Fecha: ${r.heldOn} · asistentes: ${r.attendees}.`,
          r.status === "signed"
            ? `Firmada por ${r.signedName} el ${fmtDate(r.signedAt)}. Huella de evidencia: ${r.evidenceHash}.`
            : "BORRADOR: aún sin firma de la alta dirección.",
        ),
        note(
          "Entradas del sistema",
          `Accidentalidad: ${i.accidents.total} accidente(s), ${i.accidents.fatal} mortal(es), ${i.accidents.incidents} incidente(s).`,
          ...i.indicators.map(
            (x) => `${x.name}: ${x.value ?? "—"}${x.target !== null ? ` (meta ${x.target})` : ""}`,
          ),
          `Acciones: ${i.actions.open} abiertas, ${i.actions.overdue} vencidas, ${i.actions.awaitingVerification} por verificar.`,
          i.standards
            ? `Autoevaluación ${i.standards.year}: ${i.standards.scorePct ?? "—"}% (${i.standards.level ?? "—"}).`
            : "Sin autoevaluación cerrada.",
          i.annualPlan
            ? `Plan anual: ${i.annualPlan.done} de ${i.annualPlan.total} actividades (${i.annualPlan.pct}%).`
            : "Sin plan anual del año.",
          ...(i.audits.length
            ? i.audits.map(
                (a) =>
                  `Auditoría: ${a.title} (${a.status === "closed" ? "cerrada" : "abierta"}, ${a.findings} hallazgo(s)).`,
              )
            : ["Sin auditorías del año."]),
        ),
        note(
          "Información adicional",
          `Cambios en el entorno legal: ${r.legalChanges ?? "—"}`,
          `Comunicaciones de las partes interesadas: ${r.stakeholderComms ?? "—"}`,
          `Cumplimiento de objetivos y metas: ${r.objectivesCompliance ?? "—"}`,
        ),
        note("Conclusiones", r.conclusions ?? "—"),
        note("Decisiones", ...(r.decisions ?? "—").split(/\r?\n/).filter(Boolean)),
      ]);
    }
    case "rendicion-cuentas": {
      const i = await buildReviewInputs(tenantId, year);
      return mk([
        note(
          "Accidentalidad",
          `${i.accidents.total} accidente(s) de trabajo, ${i.accidents.fatal} mortal(es) y ${i.accidents.incidents} incidente(s) en ${year}.`,
        ),
        {
          heading: "Indicadores",
          table: table(
            "Indicadores",
            ["Indicador", "Resultado", "Meta"],
            i.indicators.map((x) => [x.name, num(x.value), num(x.target)]),
          ),
        },
        note(
          "Gestión",
          `Plan anual: ${i.annualPlan ? `${i.annualPlan.done} de ${i.annualPlan.total} actividades (${i.annualPlan.pct}%)` : "sin plan del año"}.`,
          `Acciones: ${i.actions.open} abiertas, ${i.actions.overdue} vencidas, ${i.actions.awaitingVerification} por verificar, ${i.actions.total} en total.`,
          i.standards
            ? `Autoevaluación de estándares ${i.standards.year}: ${i.standards.scorePct ?? "—"}% (${i.standards.level ?? "—"}).`
            : "Sin autoevaluación cerrada.",
          i.audits.length
            ? `Auditorías: ${i.audits.length} (${i.audits.reduce((s, a) => s + a.findings, 0)} hallazgo(s)).`
            : "Sin auditorías del año.",
        ),
      ]);
    }
    case "acciones": {
      const acts = await listActions(tenantId, { status: "all" });
      return mk([
        {
          heading: "Acciones",
          table: table(
            "Acciones",
            [
              "Origen",
              "Tipo",
              "Acción",
              "Responsable",
              "Fecha límite",
              "Estado",
              "Días de mora",
              "Cierre",
            ],
            acts.map((a) => [
              a.source,
              a.type,
              a.title,
              a.responsibleName,
              a.dueDate,
              a.status,
              a.overdueDays,
              a.closureEvidence ?? "",
            ]),
          ),
        },
      ]);
    }
  }
  return null;
}

/** Informe de investigación de un accidente o incidente (Resolución 1401 de 2007). */
export async function buildInvestigationReport(
  tenantId: string,
  incidentId: string,
  tenantName: string,
): Promise<Report | null> {
  const d = await getIncident(tenantId, incidentId);
  if (!d) return null;
  const { incident: i, investigation: inv } = d;
  const actions = await investigationActions(tenantId, incidentId);
  const roles: Record<string, string> = {
    copasst: "COPASST / Vigía",
    sst: "Responsable del SG-SST",
    boss: "Jefe inmediato",
    licensed: "Profesional con licencia en SST",
    other: "Otro",
  };
  const analysis =
    inv && Array.isArray(inv.analysis)
      ? (inv.analysis as unknown[]).map(
          (x, n) =>
            `${n + 1}. ${typeof x === "string" ? x : String((x as { text?: string }).text ?? "")}`,
        )
      : [];
  return {
    id: "investigacion",
    title: `Informe de investigación de ${i.kind === "accident" ? "accidente" : "incidente"} de trabajo`,
    subtitle: `${tenantName} · ${bogotaDate(i.occurredAt)}`,
    sections: [
      note(
        "Datos del evento",
        `Persona: ${i.person} · lugar: ${i.place}${i.activity ? ` · actividad: ${i.activity}` : ""}.`,
        `Gravedad: ${i.severity} · parte del cuerpo: ${i.bodyPart ?? "—"} · tipo de lesión: ${i.injuryType ?? "—"} · testigos: ${i.witnesses ?? "—"}.`,
        `Descripción: ${i.description}`,
        `Reporte a la ARL/EPS: plazo ${i.arlDeadline ?? "—"} · reportado ${i.arlReportedAt ?? "pendiente"}${i.arlReportNumber ? ` (N.° ${i.arlReportNumber})` : ""}.`,
      ),
      ...(inv
        ? [
            note(
              "Investigación",
              `Plazo: ${inv.deadline} · estado: ${inv.completedAt ? `cerrada el ${fmtDate(inv.completedAt)}` : "en curso"} · metodología: ${inv.method === "five_whys" ? "5 porqués" : "árbol de causas"}.`,
            ),
            {
              heading: "Equipo investigador",
              table: table(
                "Equipo",
                ["Nombre", "Rol"],
                inv.team.map((m) => [m.name, roles[m.role] ?? m.role]),
              ),
            },
            note("Análisis de causas", ...(analysis.length ? analysis : ["—"])),
            note(
              "Causas",
              `Inmediatas: ${inv.immediateCauses ?? "—"}`,
              `Básicas: ${inv.basicCauses ?? "—"}`,
              `Conclusiones: ${inv.conclusions ?? "—"}`,
            ),
            {
              heading: "Plan de acción",
              table: table(
                "Plan de acción",
                ["Acción", "Tipo", "Responsable", "Fecha límite", "Estado"],
                actions.map((a) => [a.title, a.type, a.responsibleName, a.dueDate, a.status]),
              ),
            },
            note(
              "Seguimiento",
              inv.remittedArlAt
                ? `Remitida a la ARL el ${inv.remittedArlAt}.`
                : "No remitida a la ARL.",
              inv.lessonsLearned
                ? `Lecciones aprendidas (${inv.lessonsDisclosedAt ? `divulgadas ${fmtDate(inv.lessonsDisclosedAt)}` : "sin divulgar"}): ${inv.lessonsLearned}`
                : "Sin lecciones aprendidas registradas.",
            ),
          ]
        : [note("Investigación", "La investigación aún no se ha abierto.")]),
    ],
  };
}
