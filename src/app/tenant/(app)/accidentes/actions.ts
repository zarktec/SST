"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import type { TeamMember } from "@/core/db/schema/incidents";
import { diseaseSchema, incidentSchema, parseWhys } from "@/modules/incidents/rules";
import {
  IncidentError,
  addDisease,
  addInvestigationAction,
  completeInvestigation,
  discloseLessons,
  markReported,
  qualifyDisease,
  remitToArl,
  reportIncident,
  saveInvestigation,
  startInvestigation,
} from "@/modules/incidents/service";

const known = (e: unknown) =>
  e instanceof IncidentError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): NonNullable<FormState> => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
  values: f ? formValues(f) : undefined,
});
const done = () => revalidatePath("/accidentes", "layout");
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function reportAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("incidents", "create");
  const raw = Object.fromEntries(f);
  const parsed = incidentSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    const r = await reportIncident(ctx.tenant.tenantId, ctx.user.id, raw as never);
    done();
    return {
      ok: true,
      message: `Evento reportado. Plazo para informar a la ARL y a la EPS: ${r.arlDeadline}.`,
      details: [r.id],
    };
  } catch (e) {
    return fail(e, f);
  }
}

export async function markReportedAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("incidents", "edit");
  try {
    await markReported(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), {
      arlReportedAt: str(f, "arlReportedAt"),
      epsReportedAt: str(f, "epsReportedAt"),
      reportNumber: str(f, "reportNumber"),
    });
    done();
    return { ok: true, message: "Reporte registrado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function startAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("incidents", "edit");
  try {
    await startInvestigation(ctx.tenant.tenantId, ctx.user.id, id);
    done();
    return { ok: true, message: "Investigación abierta." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveInvestigationAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("incidents", "edit");
  const roles: [string, TeamMember["role"]][] = [
    ["copasst", "copasst"],
    ["sst", "sst"],
    ["boss", "boss"],
    ["licensed", "licensed"],
  ];
  const team: TeamMember[] = roles
    .map(([k, role]) => ({ name: str(f, k).trim(), role }))
    .filter((m) => m.name);
  for (const line of str(f, "others").split("\n"))
    if (line.trim()) team.push({ name: line.trim(), role: "other" });
  const method = str(f, "method") === "cause_tree" ? "cause_tree" : "five_whys";
  const lines = parseWhys(str(f, "analysis"));
  const analysis =
    method === "five_whys"
      ? lines
      : lines.map((text, i) => ({ id: String(i + 1), text, parentId: i ? String(i) : null }));
  try {
    await saveInvestigation(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), {
      team,
      method,
      analysis,
      immediateCauses: str(f, "immediateCauses"),
      basicCauses: str(f, "basicCauses"),
      conclusions: str(f, "conclusions"),
    });
    done();
    return { ok: true, message: "Investigación guardada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function addActionAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("actions", "create");
  try {
    await addInvestigationAction(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), {
      title: str(f, "title"),
      responsibleName: str(f, "responsibleName"),
      dueDate: str(f, "dueDate"),
      type: str(f, "type") === "preventive" ? "preventive" : "corrective",
    });
    done();
    return { ok: true, message: "Acción creada en el plan de acción." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function remitAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("incidents", "edit");
  try {
    await remitToArl(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), str(f, "date"));
    done();
    return { ok: true, message: "Remisión a la ARL registrada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function completeAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("incidents", "approve");
  try {
    await completeInvestigation(ctx.tenant.tenantId, ctx.user.id, id);
    done();
    return { ok: true, message: "Investigación cerrada." };
  } catch (e) {
    return fail(e);
  }
}

export async function lessonsAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("incidents", "edit");
  try {
    await discloseLessons(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), str(f, "lessons"));
    done();
    return { ok: true, message: "Lecciones aprendidas divulgadas." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function diseaseAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("incidents", "create");
  const raw = Object.fromEntries(f);
  const parsed = diseaseSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    await addDisease(ctx.tenant.tenantId, ctx.user.id, raw as never);
    done();
    return { ok: true, message: "Caso registrado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function qualifyAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("incidents", "edit");
  try {
    await qualifyDisease(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), {
      qualification: str(f, "qualification") === "common" ? "common" : "occupational",
      qualifiedOn: str(f, "qualifiedOn"),
      qualifiedBy: str(f, "qualifiedBy"),
      followUp: str(f, "followUp"),
    });
    done();
    return { ok: true, message: "Calificación registrada." };
  } catch (e) {
    return fail(e, f);
  }
}
