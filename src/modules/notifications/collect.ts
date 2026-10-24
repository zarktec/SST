import "server-only";
import { getEntitlements } from "@/core/plans/limits";
import { listActions } from "@/modules/capa/service";
import { listAudits } from "@/modules/audits/service";
import { emergencySummary, listAssets, listDrills, listPlans } from "@/modules/emergencies/service";
import { highRiskSummary, listCertificates, listEquipment } from "@/modules/high-risk/service";
import { listIncidents } from "@/modules/incidents/service";
import { periodicStatus, pendingReturnEvaluations } from "@/modules/medical/service";
import { listVehicles, listDrivers } from "@/modules/pesv/service";
import { chemicalSummary } from "@/modules/chemicals/service";
import { listPrograms, listPsychosocial, pveSummary } from "@/modules/pve/service";
import type { AlertItem, CalendarEvent } from "./rules";

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Reúne las alertas vigentes de todos los módulos de la empresa. Cada fuente es independiente: si una falla, las demás siguen.
 * Las alertas "por vencer" son advertencia; las vencidas, críticas.
 */
export async function collectAlerts(tenantId: string): Promise<AlertItem[]> {
  const out: AlertItem[] = [];
  const { modules } = await safe(() => getEntitlements(tenantId), {
    modules: [] as string[],
  } as never);

  const incidents = await safe(() => listIncidents(tenantId), []);
  for (const i of incidents) {
    if (i.report && (i.report.state === "vencido" || i.report.state === "vence_hoy"))
      out.push({
        key: `incident-arl:${i.id}`,
        module: "incidents",
        severity: "critical",
        title:
          i.report.state === "vencido"
            ? "Reporte a la ARL/EPS vencido"
            : "Reporte a la ARL/EPS vence hoy",
        detail: `${i.kind === "accident" ? "Accidente" : "Incidente"} de ${i.person}`,
        href: `/accidentes/${i.id}`,
        dueOn: i.arlDeadline,
      });
    if (i.investigation?.overdue)
      out.push({
        key: `incident-inv:${i.id}`,
        module: "incidents",
        severity: "critical",
        title: "Investigación de accidente vencida",
        detail: `Evento de ${i.person}`,
        href: `/accidentes/${i.id}`,
        dueOn: i.investigation.deadline,
      });
  }

  const actions = await safe(() => listActions(tenantId, { status: "open" }), []);
  const overdue = actions.filter((a) => a.overdueDays > 0);
  if (overdue.length)
    out.push({
      key: "capa-overdue",
      module: "actions",
      severity: "critical",
      title: `${plural(overdue.length, "acción vencida", "acciones vencidas")}`,
      detail: overdue
        .slice(0, 3)
        .map((a) => a.title)
        .join("; "),
      href: "/acciones",
    });

  const em = await safe(() => emergencySummary(tenantId), null);
  if (em) {
    if (!em.drills.ok)
      out.push({
        key: "emergency-drill",
        module: "emergencies",
        severity: "warning",
        title: "Sin simulacro realizado este año",
        href: "/emergencias",
      });
    if (!em.hasPlan)
      out.push({
        key: "emergency-plan",
        module: "emergencies",
        severity: "warning",
        title: "No hay plan de emergencias",
        href: "/emergencias",
      });
    if (em.plansDue)
      out.push({
        key: "emergency-plan-review",
        module: "emergencies",
        severity: "warning",
        title: "Plan de emergencias con revisión vencida",
        href: "/emergencias",
      });
    if (em.assets.expired)
      out.push({
        key: "emergency-assets-expired",
        module: "emergencies",
        severity: "critical",
        title: plural(
          em.assets.expired,
          "equipo de emergencia vencido",
          "equipos de emergencia vencidos",
        ),
        href: "/emergencias",
      });
    if (em.assets.expiring)
      out.push({
        key: "emergency-assets-expiring",
        module: "emergencies",
        severity: "warning",
        title: plural(
          em.assets.expiring,
          "equipo de emergencia por vencer",
          "equipos de emergencia por vencer",
        ),
        href: "/emergencias",
      });
    if (em.assets.inspectionDue)
      out.push({
        key: "emergency-assets-inspection",
        module: "emergencies",
        severity: "warning",
        title: plural(
          em.assets.inspectionDue,
          "equipo sin inspección al día",
          "equipos sin inspección al día",
        ),
        href: "/emergencias",
      });
  }

  const hr = await safe(() => highRiskSummary(tenantId), null);
  if (hr) {
    if (hr.toAuthorize)
      out.push({
        key: "permits-authorize",
        module: "high_risk",
        severity: "warning",
        title: plural(
          hr.toAuthorize,
          "permiso de trabajo por autorizar",
          "permisos de trabajo por autorizar",
        ),
        href: "/alto-riesgo",
      });
    if (hr.toClose)
      out.push({
        key: "permits-close",
        module: "high_risk",
        severity: "critical",
        title: plural(hr.toClose, "permiso vencido sin cerrar", "permisos vencidos sin cerrar"),
        href: "/alto-riesgo",
      });
    if (hr.certsExpired)
      out.push({
        key: "heights-certs-expired",
        module: "high_risk",
        severity: "critical",
        title: plural(
          hr.certsExpired,
          "certificado de alturas vencido",
          "certificados de alturas vencidos",
        ),
        href: "/alto-riesgo",
      });
    if (hr.certsExpiring)
      out.push({
        key: "heights-certs-expiring",
        module: "high_risk",
        severity: "warning",
        title: plural(
          hr.certsExpiring,
          "certificado de alturas por vencer",
          "certificados de alturas por vencer",
        ),
        href: "/alto-riesgo",
      });
    if (hr.equipmentExpired)
      out.push({
        key: "heights-equipment-expired",
        module: "high_risk",
        severity: "critical",
        title: plural(
          hr.equipmentExpired,
          "equipo de alturas sin certificación vigente",
          "equipos de alturas sin certificación vigente",
        ),
        href: "/alto-riesgo",
      });
    if (hr.equipmentExpiring)
      out.push({
        key: "heights-equipment-expiring",
        module: "high_risk",
        severity: "warning",
        title: plural(
          hr.equipmentExpiring,
          "equipo de alturas por vencer",
          "equipos de alturas por vencer",
        ),
        href: "/alto-riesgo",
      });
  }

  const ch = await safe(() => chemicalSummary(tenantId), null);
  if (ch) {
    if (ch.conflicts.length)
      out.push({
        key: "chem-conflicts",
        module: "chemicals",
        severity: "critical",
        title: plural(
          ch.conflicts.length,
          "almacenamiento químico incompatible",
          "almacenamientos químicos incompatibles",
        ),
        href: "/quimicos",
      });
    if (ch.withoutSds)
      out.push({
        key: "chem-no-sds",
        module: "chemicals",
        severity: "warning",
        title: plural(ch.withoutSds, "sustancia sin FDS", "sustancias sin FDS"),
        href: "/quimicos",
      });
    if (ch.sdsToReview)
      out.push({
        key: "chem-sds-review",
        module: "chemicals",
        severity: "warning",
        title: plural(ch.sdsToReview, "FDS por revisar", "FDS por revisar"),
        href: "/quimicos",
      });
  }

  if (modules.includes("pesv")) {
    const [vehicles, drivers] = await Promise.all([
      safe(() => listVehicles(tenantId), []),
      safe(() => listDrivers(tenantId), []),
    ]);
    const bad = vehicles.filter((v) => !v.docs.ok);
    if (bad.length)
      out.push({
        key: "pesv-docs",
        module: "pesv",
        severity: "critical",
        title: plural(
          bad.length,
          "vehículo con documentos vencidos",
          "vehículos con documentos vencidos",
        ),
        detail: bad.map((v) => v.plate).join(", "),
        href: "/pesv",
      });
    const lic = drivers.filter((d) => d.license === "vencido");
    if (lic.length)
      out.push({
        key: "pesv-licenses",
        module: "pesv",
        severity: "critical",
        title: plural(
          lic.length,
          "licencia de conducción vencida",
          "licencias de conducción vencidas",
        ),
        detail: lic.map((d) => d.name).join(", "),
        href: "/pesv",
      });
  }

  const pve = await safe(() => pveSummary(tenantId), null);
  if (pve) {
    if (pve.followUpsOverdue)
      out.push({
        key: "pve-followups",
        module: "medical",
        severity: "warning",
        title: plural(
          pve.followUpsOverdue,
          "seguimiento de caso vencido",
          "seguimientos de casos vencidos",
        ),
        href: "/vigilancia",
      });
    if (pve.activitiesOverdue)
      out.push({
        key: "pve-activities",
        module: "medical",
        severity: "warning",
        title: plural(
          pve.activitiesOverdue,
          "actividad de vigilancia vencida",
          "actividades de vigilancia vencidas",
        ),
        href: "/vigilancia",
      });
    if (pve.psychosocial === "vencida" || pve.psychosocial === "por_vencer")
      out.push({
        key: "psychosocial",
        module: "medical",
        severity: pve.psychosocial === "vencida" ? "critical" : "warning",
        title:
          pve.psychosocial === "vencida"
            ? "Batería de riesgo psicosocial vencida"
            : "Batería de riesgo psicosocial por vencer",
        href: "/vigilancia/psicosocial",
      });
  }

  const audits = await safe(() => listAudits(tenantId), []);
  const late = audits.filter((a) => a.overdue);
  if (late.length)
    out.push({
      key: "audits-late",
      module: "audits",
      severity: "warning",
      title: plural(late.length, "auditoría atrasada", "auditorías atrasadas"),
      href: "/auditorias",
    });

  const periodic = await safe(() => periodicStatus(tenantId), []);
  const dueEval = periodic.filter((p) => p.state === "vencida");
  if (dueEval.length)
    out.push({
      key: "medical-periodic",
      module: "medical",
      severity: "warning",
      title: plural(
        dueEval.length,
        "evaluación médica periódica vencida",
        "evaluaciones médicas periódicas vencidas",
      ),
      href: "/medicina",
    });
  const returns = await safe(() => pendingReturnEvaluations(tenantId), []);
  if (returns.length)
    out.push({
      key: "medical-return",
      module: "medical",
      severity: "warning",
      title: plural(
        returns.length,
        "evaluación de retorno laboral pendiente",
        "evaluaciones de retorno laboral pendientes",
      ),
      href: "/medicina",
    });

  return out;
}

/** Fechas de obligaciones y eventos para el calendario unificado. */
export async function collectEvents(tenantId: string): Promise<CalendarEvent[]> {
  const ev: CalendarEvent[] = [];
  const add = (
    uid: string,
    date: string | null | undefined,
    title: string,
    module: string,
    href?: string,
  ) => {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ev.push({ uid, date, title, module, href });
  };
  const { modules } = await safe(() => getEntitlements(tenantId), {
    modules: [] as string[],
  } as never);
  const [
    actions,
    drills,
    plans,
    assets,
    certs,
    equipment,
    audits,
    programs,
    psy,
    periodic,
    incidents,
  ] = await Promise.all([
    safe(() => listActions(tenantId, { status: "open" }), []),
    safe(() => listDrills(tenantId), []),
    safe(() => listPlans(tenantId), []),
    safe(() => listAssets(tenantId), []),
    safe(() => listCertificates(tenantId), []),
    safe(() => listEquipment(tenantId), []),
    safe(() => listAudits(tenantId), []),
    safe(() => listPrograms(tenantId), []),
    safe(() => listPsychosocial(tenantId), null),
    safe(() => periodicStatus(tenantId), []),
    safe(() => listIncidents(tenantId), []),
  ]);
  for (const a of actions)
    add(`action-${a.id}`, a.dueDate, `Acción: ${a.title}`, "actions", `/acciones/${a.id}`);
  for (const d of drills.filter((x) => x.status === "planned"))
    add(`drill-${d.id}`, d.plannedOn, `Simulacro: ${d.scenario}`, "emergencies", "/emergencias");
  for (const p of plans)
    add(
      `plan-${p.id}`,
      p.nextReviewOn,
      `Revisión del plan de emergencias${p.center ? ` (${p.center})` : ""}`,
      "emergencies",
      "/emergencias",
    );
  for (const a of assets)
    add(
      `asset-${a.id}`,
      a.expiresOn,
      `Vence ${a.code} (${a.location})`,
      "emergencies",
      "/emergencias",
    );
  for (const c of certs.filter((x) => x.current))
    add(
      `cert-${c.id}`,
      c.expiresOn,
      `Vence certificado de alturas de ${c.name}`,
      "high_risk",
      "/alto-riesgo",
    );
  for (const e of equipment)
    add(
      `heq-${e.id}`,
      e.certifiedUntil,
      `Vence certificación del equipo ${e.code}`,
      "high_risk",
      "/alto-riesgo",
    );
  for (const a of audits.filter((x) => x.status === "planned" || x.status === "in_progress"))
    add(`audit-${a.id}`, a.plannedOn, `Auditoría: ${a.title}`, "audits", "/auditorias");
  for (const p of programs)
    for (const a of p.activities.filter((x) => !x.performedOn))
      add(`pve-${a.id}`, a.plannedOn, `${p.name}: ${a.description}`, "medical", "/vigilancia");
  add(
    "psychosocial-next",
    psy?.nextDueOn,
    "Próxima aplicación de la batería de riesgo psicosocial",
    "medical",
    "/vigilancia/psicosocial",
  );
  for (const p of periodic)
    add(
      `eval-${p.workerId}`,
      p.due,
      `Evaluación médica periódica de ${p.name}`,
      "medical",
      "/medicina",
    );
  for (const i of incidents)
    if (!i.arlReportedAt)
      add(
        `arl-${i.id}`,
        i.arlDeadline,
        `Plazo de reporte a la ARL/EPS (${i.person})`,
        "incidents",
        `/accidentes/${i.id}`,
      );
  if (modules.includes("pesv")) {
    const [vehicles, drivers] = await Promise.all([
      safe(() => listVehicles(tenantId), []),
      safe(() => listDrivers(tenantId), []),
    ]);
    for (const v of vehicles) {
      add(`soat-${v.id}`, v.soatExpiresOn, `SOAT ${v.plate}`, "pesv", "/pesv");
      add(`rtm-${v.id}`, v.rtmExpiresOn, `Revisión técnico-mecánica ${v.plate}`, "pesv", "/pesv");
    }
    for (const d of drivers)
      add(`lic-${d.id}`, d.licenseExpiresOn, `Vence licencia de ${d.name}`, "pesv", "/pesv");
  }
  return ev.sort((a, b) => a.date.localeCompare(b.date));
}
