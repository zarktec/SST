"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { PREOP_ITEMS } from "@/modules/pesv/rules";
import {
  PesvError,
  registerCrash,
  retireDriver,
  retireVehicle,
  saveDriver,
  saveVehicle,
  submitPreop,
} from "@/modules/pesv/service";

const known = (e: unknown) =>
  e instanceof PesvError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY", "MODULE_DISABLED"].includes(String((e as { code?: string }).code)));
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
const done = () => revalidatePath("/pesv", "layout");
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function vehicleAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("pesv", str(f, "id") ? "edit" : "create");
  try {
    await saveVehicle(
      ctx.tenant.tenantId,
      ctx.user.id,
      Object.fromEntries(f),
      str(f, "id") || undefined,
    );
    done();
    return { ok: true, message: "Vehículo guardado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function retireVehicleAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("pesv", "edit");
  await retireVehicle(ctx.tenant.tenantId, ctx.user.id, id);
  done();
  return { ok: true, message: "Vehículo retirado." };
}
export async function driverAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("pesv", "create");
  try {
    await saveDriver(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Conductor guardado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function retireDriverAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("pesv", "edit");
  await retireDriver(ctx.tenant.tenantId, ctx.user.id, id);
  done();
  return { ok: true, message: "Conductor retirado." };
}
export async function preopAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("pesv", "create");
  try {
    const failed: Record<string, string> = {};
    PREOP_ITEMS.forEach((_i, idx) => {
      if (f.get(`ok_${idx}`) !== "on") failed[PREOP_ITEMS[idx].item] = str(f, `note_${idx}`);
    });
    const r = await submitPreop(
      ctx.tenant.tenantId,
      ctx.user.id,
      ctx.user.name || ctx.user.email,
      Object.fromEntries(f),
      failed,
    );
    done();
    return {
      ok: true,
      message: r.criticalFailures
        ? `Preoperacional registrado con ${r.criticalFailures} falla(s) crítica(s): el vehículo no debe operar hasta corregirlas.`
        : "Preoperacional registrado.",
    };
  } catch (e) {
    return fail(e, f);
  }
}
export async function crashAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("pesv", "create");
  try {
    await registerCrash(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Siniestro registrado." };
  } catch (e) {
    return fail(e, f);
  }
}
