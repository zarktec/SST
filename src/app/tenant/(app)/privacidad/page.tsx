import Link from "next/link";
import { ActionForm } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/core/auth/session";
import { withTenant } from "@/core/db";
import { can, loadPermissions } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { PRIVACY_NOTICE, REQUEST_TYPES } from "@/modules/privacy/rules";
import { consentStatus, listRequests } from "@/modules/privacy/service";
import { consentAction, requestAction } from "./actions";

export const metadata = { title: "Privacidad y datos personales" };

export default async function PrivacyPage() {
  const ctx = await requireTenantMember();
  const t = ctx.tenant.tenantId;
  const perms = await withTenant({ tenantId: t }, (tx) => loadPermissions(tx, ctx.roleId));
  const [c, mine] = await Promise.all([
    consentStatus(t, ctx.user.id),
    listRequests(t, { userId: ctx.user.id }),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Privacidad y datos personales</h1>
      <Card>
        <CardTitle>Aviso de privacidad (versión {c.version})</CardTitle>
        <div className="mt-2 space-y-2 text-sm">
          {PRIVACY_NOTICE.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </Card>
      <Card>
        <CardTitle>Tu autorización</CardTitle>
        <p className="mt-1 text-sm">
          {c.accepted ? (
            <>
              <Badge variant="success">Autorizado</Badge> el{" "}
              {c.acceptedAt ? formatDate(c.acceptedAt.toISOString().slice(0, 10)) : ""}
              {c.sensitive ? " · incluye datos de salud" : " · sin datos de salud"}
            </>
          ) : (
            <Badge variant="warning">Pendiente</Badge>
          )}
        </p>
        <div className="mt-3">
          <ActionForm
            action={consentAction}
            idPrefix="co-"
            submit={c.accepted ? "Actualizar mi autorización" : "Guardar mi autorización"}
            fields={[
              {
                name: "general",
                label:
                  "Autorizo el tratamiento de mis datos personales para la gestión del SG-SST (obligatoria)",
                type: "checkbox",
                saved: c.accepted,
              },
              {
                name: "sensitive",
                label:
                  "Autorizo el tratamiento de mis datos sensibles de salud para el SG-SST (opcional)",
                type: "checkbox",
                saved: c.sensitive,
              },
            ]}
          />
        </div>
      </Card>
      <Card>
        <CardTitle>Ejercer mis derechos</CardTitle>
        <div className="mt-3">
          <ActionForm
            action={requestAction}
            idPrefix="rq-"
            submit="Radicar solicitud"
            fields={[
              {
                name: "type",
                label: "Tipo de solicitud",
                type: "select",
                options: [...REQUEST_TYPES],
              },
              { name: "detail", label: "Describe tu solicitud", type: "textarea" },
            ]}
          />
        </div>
        <ul className="mt-3 divide-y text-sm">
          {mine.map((r) => (
            <li key={r.id} className="py-2">
              <p className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    r.status === "open" ? (r.overdue ? "destructive" : "warning") : "success"
                  }
                >
                  {r.status === "open"
                    ? r.overdue
                      ? "Vencida"
                      : "En trámite"
                    : r.status === "resolved"
                      ? "Respondida"
                      : "Rechazada"}
                </Badge>
                {REQUEST_TYPES.find((x) => x.value === r.type)?.label} · responder antes del{" "}
                {formatDate(r.dueOn)}
              </p>
              {r.resolution && <p className="text-muted-foreground">{r.resolution}</p>}
            </li>
          ))}
        </ul>
      </Card>
      {can(perms, "company", "edit") && (
        <p className="text-sm">
          <Link
            href="/privacidad/solicitudes"
            className="text-primary inline-block min-h-11 py-2 underline"
          >
            Gestionar las solicitudes de los titulares (administración)
          </Link>
        </p>
      )}
    </div>
  );
}
