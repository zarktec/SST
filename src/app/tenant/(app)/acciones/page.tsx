import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { Pager } from "@/components/ui/pager";
import { formatDate } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { SOURCES, STATUS_LABEL, type Status } from "@/modules/capa/rules";
import { capaSummary, countActions, listActions } from "@/modules/capa/service";
import { CreateForm } from "./forms";

export const metadata = { title: "Acciones" };
const V: Record<string, "default" | "warning" | "success" | "destructive"> = {
  open: "warning",
  in_progress: "warning",
  done: "default",
  verified: "success",
  cancelled: "default",
};

export default async function ActionsPage({ searchParams }: PageProps<"/tenant/acciones">) {
  const ctx = await requirePermission("actions", "view");
  const sp = await searchParams;
  const showAll = sp.todas === "1";
  const pg = parsePage(sp);
  const status = showAll ? "all" : "open";
  const [rows, total, sum] = await Promise.all([
    listActions(ctx.tenant.tenantId, { status, limit: pg.limit, offset: pg.offset }),
    countActions(ctx.tenant.tenantId, { status }),
    capaSummary(ctx.tenant.tenantId),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Acciones correctivas, preventivas y de mejora</h1>
      <Card>
        <p className="text-sm">
          {sum.open} abiertas ·{" "}
          <span className={sum.overdue ? "text-destructive font-semibold" : ""}>
            {sum.overdue} vencidas
          </span>{" "}
          · {sum.awaitingVerification} por verificar
        </p>
        <p className="mt-2 text-sm">
          <Link
            className="text-primary underline"
            href={showAll ? "/acciones" : "/acciones?todas=1"}
          >
            {showAll ? "Ver solo las pendientes" : "Ver también las cerradas"}
          </Link>
        </p>
      </Card>
      {can(ctx.permissions, "actions", "create") && (
        <Card>
          <CardTitle>Nueva acción</CardTitle>
          <div className="mt-3">
            <CreateForm />
          </div>
        </Card>
      )}
      <Card>
        <CardTitle>Acciones</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {rows.map((a) => (
            <li key={a.id}>
              <Link
                href={`/acciones/${a.id}`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3"
              >
                <span>
                  <span className="font-semibold">{a.title}</span>
                  <span className="text-muted-foreground block">
                    {SOURCES[a.source]} · {a.responsibleName ?? "sin responsable"} ·{" "}
                    {formatDate(a.dueDate)}
                  </span>
                </span>
                <span className="flex gap-2">
                  {a.overdueDays > 0 && (
                    <Badge variant="destructive">
                      {a.overdueDays} d de mora
                      {a.escalationLevel ? ` · nivel ${a.escalationLevel}` : ""}
                    </Badge>
                  )}
                  <Badge variant={V[a.status]}>{STATUS_LABEL[a.status as Status]}</Badge>
                </span>
              </Link>
            </li>
          ))}
          {rows.length === 0 && <li className="text-muted-foreground py-2">No hay acciones.</li>}
        </ul>
        <Pager
          base="/acciones"
          params={{ todas: showAll ? "1" : undefined }}
          page={pg.page}
          total={total}
          size={pg.size}
        />
      </Card>
    </div>
  );
}
