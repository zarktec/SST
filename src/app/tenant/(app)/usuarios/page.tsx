import { ActionForm, RunButton } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { formatDate } from "@/lib/format";
import { listRoles, listTeam } from "@/modules/users/service";
import {
  changeRoleAction,
  disableMemberAction,
  enableMemberAction,
  inviteAction,
  revokeInvitationAction,
} from "./actions";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const ctx = await requirePermission("users", "view");
  const [{ members, invites }, roles] = await Promise.all([
    listTeam(ctx.tenant.tenantId),
    listRoles(ctx.tenant.tenantId),
  ]);
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Usuarios y roles</h1>

      <Card>
        <CardTitle>Invitar a una persona</CardTitle>
        <p className="text-muted-foreground mb-3 text-sm">
          Recibirá un correo y entra con enlace de acceso usando ese mismo correo. Cuenta para el
          límite de usuarios de tu plan.
        </p>
        <FormModal title="Invitar persona" trigger="Invitar persona" triggerVariant="default">
          <ActionForm
            action={inviteAction}
            submit="Enviar invitación"
            idPrefix="inv-"
            fields={[
              { name: "email", label: "Correo", type: "text", required: true },
              { name: "roleId", label: "Rol", type: "select", options: roleOptions },
            ]}
          />
        </FormModal>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardTitle>Invitaciones pendientes</CardTitle>
          <ul className="mt-2 divide-y text-sm">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {i.email} · {i.roleName}
                  <span className="text-muted-foreground block">
                    Vence {formatDate(i.expiresAt)}
                  </span>
                </span>
                <RunButton
                  action={revokeInvitationAction}
                  arg={i.id}
                  confirm="¿Revocar invitación?"
                >
                  Revocar
                </RunButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardTitle>Miembros ({members.length})</CardTitle>
        <ul className="mt-2 divide-y">
          {members.map((m) => {
            const self = m.userId === ctx.user.id;
            return (
              <li key={m.id} className="space-y-2 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold">{m.name}</span>
                    {self && " (tú)"}
                    <span className="text-muted-foreground block">{m.email}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge>{m.roleName}</Badge>
                    {m.status !== "active" && <Badge variant="warning">Desactivado</Badge>}
                    {!self &&
                      (m.status === "active" ? (
                        <RunButton
                          action={disableMemberAction}
                          arg={m.id}
                          confirm={`¿Desactivar a ${m.name}?`}
                        >
                          Desactivar
                        </RunButton>
                      ) : (
                        <RunButton action={enableMemberAction} arg={m.id}>
                          Activar
                        </RunButton>
                      ))}
                  </span>
                </div>
                {!self && (
                  <FormModal title="Cambiar rol" trigger="Cambiar rol">
                    <ActionForm
                      action={changeRoleAction}
                      submit="Guardar rol"
                      variant="outline"
                      idPrefix={`rol-${m.id}-`}
                      hidden={{ memberId: m.id }}
                      fields={[
                        {
                          name: "roleId",
                          label: "Rol",
                          type: "select",
                          options: roleOptions,
                          saved: m.roleId,
                        },
                      ]}
                    />
                  </FormModal>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
