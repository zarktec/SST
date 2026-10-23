"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { deliverySchema, itemSchema, stockSchema, type DeliveryInput } from "@/modules/ppe/rules";
import {
  PpeError,
  addStock,
  archiveItem,
  registerDelivery,
  saveItem,
  setRequirement,
} from "@/modules/ppe/service";

const known = (e: unknown) =>
  e instanceof PpeError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): FormState => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
  values: f ? formValues(f) : undefined,
});
const done = () => revalidatePath("/epp", "layout");
const invalid = (f: FormData, issues: Parameters<typeof zodFieldErrors>[0]): FormState => ({
  ok: false,
  message: "Revisa los campos marcados.",
  fieldErrors: zodFieldErrors(issues),
  values: formValues(f),
});

export async function saveItemAction(_p: FormState, f: FormData): Promise<FormState> {
  const id = String(f.get("id") ?? "");
  const ctx = await requirePermission("ppe", id ? "edit" : "create");
  const raw = Object.fromEntries(f);
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return invalid(f, parsed.error.issues);
  try {
    await saveItem(ctx.tenant.tenantId, ctx.user.id, raw as never, id || undefined);
    done();
    return { ok: true, message: "EPP guardado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function archiveItemAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("ppe", "delete");
  await archiveItem(ctx.tenant.tenantId, ctx.user.id, id);
  done();
  return { ok: true, message: "EPP archivado." };
}

export async function addStockAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("ppe", "edit");
  const raw = Object.fromEntries(f);
  const parsed = stockSchema.safeParse(raw);
  if (!parsed.success) return invalid(f, parsed.error.issues);
  try {
    await addStock(ctx.tenant.tenantId, ctx.user.id, raw as never);
    done();
    return { ok: true, message: "Ingreso registrado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function requirementAction(
  position: string,
  itemId: string,
  on: boolean,
): Promise<FormState> {
  const ctx = await requirePermission("ppe", "edit");
  try {
    await setRequirement(ctx.tenant.tenantId, ctx.user.id, position, itemId, on);
    done();
    return { ok: true, message: on ? "Requisito agregado." : "Requisito quitado." };
  } catch (e) {
    return fail(e);
  }
}

export async function deliveryAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("ppe", "create");
  const raw = Object.fromEntries(f);
  const parsed = deliverySchema.safeParse(raw);
  if (!parsed.success) return invalid(f, parsed.error.issues);
  const h = await headers();
  try {
    await registerDelivery(
      ctx.tenant.tenantId,
      ctx.user.id,
      { ...(raw as unknown as DeliveryInput), signature: String(f.get("signature") ?? "") },
      {
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: h.get("user-agent"),
      },
    );
    done();
    return { ok: true, message: "Entrega registrada." };
  } catch (e) {
    return fail(e, f);
  }
}
