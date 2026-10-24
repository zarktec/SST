"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import {
  EmergencyError,
  addAsset,
  addBrigadeMember,
  cancelDrill,
  completeDrill,
  inspectAsset,
  renewAsset,
  retireAsset,
  savePlan,
  scheduleDrill,
  updateBrigadeMember,
} from "@/modules/emergencies/service";

const known = (e: unknown) =>
  e instanceof EmergencyError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): NonNullable<FormState> =>
  e instanceof ZodError
    ? {
        ok: false,
        message: "Revisa los campos marcados.",
        fieldErrors: zodFieldErrors(e.issues),
        values: f ? formValues(f) : undefined,
      }
    : {
        ok: false,
        message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
        values: f ? formValues(f) : undefined,
      };
const done = () => revalidatePath("/emergencias", "layout");
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function assetAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("emergencies", "create");
  try {
    await addAsset(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Equipo registrado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function inspectAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("emergencies", "edit");
  try {
    await inspectAsset(
      ctx.tenant.tenantId,
      ctx.user.id,
      ctx.user.name || ctx.user.email,
      str(f, "id"),
      {
        performedOn: str(f, "performedOn"),
        ok: str(f, "ok") === "on",
        note: str(f, "note"),
      },
    );
    done();
    return { ok: true, message: "Inspección registrada." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function renewAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("emergencies", "edit");
  try {
    await renewAsset(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), str(f, "expiresOn"));
    done();
    return { ok: true, message: "Vigencia actualizada." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function retireAssetAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("emergencies", "edit");
  await retireAsset(ctx.tenant.tenantId, ctx.user.id, id);
  done();
  return { ok: true, message: "Equipo retirado." };
}
export async function brigadeAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("emergencies", "create");
  try {
    await addBrigadeMember(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Integrante agregado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function trainingAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("emergencies", "edit");
  try {
    await updateBrigadeMember(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), {
      lastTrainingOn: str(f, "lastTrainingOn"),
    });
    done();
    return { ok: true, message: "Capacitación registrada." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function removeMemberAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("emergencies", "edit");
  await updateBrigadeMember(ctx.tenant.tenantId, ctx.user.id, id, { active: false });
  done();
  return { ok: true, message: "Integrante retirado." };
}
export async function planAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("emergencies", "edit");
  try {
    await savePlan(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Plan guardado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function drillAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("emergencies", "create");
  try {
    await scheduleDrill(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Simulacro programado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function drillResultAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("emergencies", "edit");
  try {
    await completeDrill(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), Object.fromEntries(f));
    done();
    return { ok: true, message: "Simulacro registrado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function cancelDrillAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("emergencies", "edit");
  await cancelDrill(ctx.tenant.tenantId, ctx.user.id, id);
  done();
  return { ok: true, message: "Simulacro cancelado." };
}
