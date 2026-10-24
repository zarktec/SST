"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { inviteSchema } from "@/modules/users/rules";
import {
  UserAdminError,
  changeRole,
  inviteUser,
  revokeInvitation,
  setMemberStatus,
} from "@/modules/users/service";

const known = (e: unknown) =>
  e instanceof UserAdminError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): FormState => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo completar. Intenta de nuevo.",
  values: f ? formValues(f) : undefined,
});

export async function inviteAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("users", "create");
  const parsed = inviteSchema.safeParse(Object.fromEntries(f));
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    await inviteUser(ctx.tenant.tenantId, ctx.user.id, parsed.data);
    revalidatePath("/usuarios");
    return { ok: true, message: "Invitación enviada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function revokeInvitationAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("users", "edit");
  try {
    await revokeInvitation(ctx.tenant.tenantId, ctx.user.id, id);
    revalidatePath("/usuarios");
    return { ok: true, message: "Invitación revocada." };
  } catch (e) {
    return fail(e);
  }
}

export async function changeRoleAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("users", "edit");
  try {
    await changeRole(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("memberId")),
      String(f.get("roleId")),
    );
    revalidatePath("/usuarios");
    return { ok: true, message: "Rol actualizado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function disableMemberAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("users", "edit");
  try {
    await setMemberStatus(ctx.tenant.tenantId, ctx.user.id, id, "disabled");
    revalidatePath("/usuarios");
    return { ok: true, message: "Usuario desactivado." };
  } catch (e) {
    return fail(e);
  }
}

export async function enableMemberAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("users", "edit");
  try {
    await setMemberStatus(ctx.tenant.tenantId, ctx.user.id, id, "active");
    revalidatePath("/usuarios");
    return { ok: true, message: "Usuario activado." };
  } catch (e) {
    return fail(e);
  }
}
