"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import {
  HighRiskError,
  addCertificate,
  addEquipment,
  authorizePermit,
  cancelPermit,
  closePermit,
  ensureDefaultTypes,
  listTypes,
  requestPermit,
  saveType,
  setTypeActive,
  updateEquipment,
} from "@/modules/high-risk/service";

const known = (e: unknown) =>
  e instanceof HighRiskError ||
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
const done = () => revalidatePath("/alto-riesgo", "layout");
const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const evidence = async () => {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
};
const prefixed = (f: FormData, p: string) =>
  [...f.entries()]
    .filter(([k]) => k.startsWith(p))
    .map(([k, v]) => [k.slice(p.length), String(v)] as const);

export async function defaultTypesAction(arg: string): Promise<FormState> {
  void arg;
  const ctx = await requirePermission("high_risk", "edit");
  try {
    await ensureDefaultTypes(ctx.tenant.tenantId, ctx.user.id);
    done();
    return { ok: true, message: "Tipos de permiso creados." };
  } catch (e) {
    return fail(e);
  }
}
export async function typeAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("high_risk", "edit");
  try {
    await saveType(
      ctx.tenant.tenantId,
      ctx.user.id,
      Object.fromEntries(f),
      str(f, "id") || undefined,
    );
    done();
    return { ok: true, message: "Tipo de permiso guardado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function toggleTypeAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("high_risk", "edit");
  const cur = (await listTypes(ctx.tenant.tenantId)).find((x) => x.id === id);
  await setTypeActive(ctx.tenant.tenantId, id, !(cur?.active ?? true));
  done();
  return { ok: true, message: "Tipo actualizado." };
}
export async function certificateAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("high_risk", "create");
  try {
    await addCertificate(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Certificado registrado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function equipmentAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("high_risk", "create");
  try {
    await addEquipment(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Equipo registrado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function equipmentUpdateAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("high_risk", "edit");
  try {
    await updateEquipment(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), {
      certifiedUntil: str(f, "certifiedUntil") || undefined,
      lastInspectedOn: str(f, "lastInspectedOn") || undefined,
    });
    done();
    return { ok: true, message: "Equipo actualizado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function retireEquipmentAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("high_risk", "edit");
  await updateEquipment(ctx.tenant.tenantId, ctx.user.id, id, { active: false });
  done();
  return { ok: true, message: "Equipo retirado." };
}
export async function requestAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("high_risk", "create");
  try {
    await requestPermit(
      ctx.tenant.tenantId,
      ctx.user.id,
      ctx.user.name || ctx.user.email,
      Object.fromEntries(f),
      {
        answers: Object.fromEntries(prefixed(f, "c_")),
        workerIds: prefixed(f, "w_").map(([id]) => id),
        signature: str(f, "signature"),
      },
      await evidence(),
    );
    done();
    return { ok: true, message: "Permiso solicitado. Queda pendiente de autorización." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function authorizeAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("high_risk", "approve");
  try {
    await authorizePermit(
      ctx.tenant.tenantId,
      ctx.user.id,
      ctx.user.name || ctx.user.email,
      str(f, "id"),
      str(f, "signature"),
      await evidence(),
    );
    done();
    return { ok: true, message: "Permiso autorizado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function closeAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("high_risk", "edit");
  try {
    await closePermit(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), str(f, "note"));
    done();
    return { ok: true, message: "Permiso cerrado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function cancelAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("high_risk", "edit");
  try {
    await cancelPermit(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), str(f, "reason"));
    done();
    return { ok: true, message: "Permiso cancelado." };
  } catch (e) {
    return fail(e, f);
  }
}
