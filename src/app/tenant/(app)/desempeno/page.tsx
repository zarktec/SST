import { ActionForm, type FieldSpec } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import Link from "@/components/ui/link";
import { FormModal } from "@/components/ui/modal";
import { requirePermission } from "@/core/auth/session";
import { getEntitlements } from "@/core/plans/limits";
import { can } from "@/core/rbac/can";
import { addDays, todayYmd } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { levelLabel } from "@/modules/performance/rules";
import {
  getSettings,
  listCycles,
  myClosedCycles,
  myPending,
  workerOfUser,
} from "@/modules/performance/service";
import { cycleAction, settingsAction } from "./actions";

export const metadata = { title: "Evaluación de desempeño 360" };

export default async function PerformancePage() {
  const ctx = await requirePermission("performance", "view");
  const t = ctx.tenant.tenantId;
  const { modules } = await getEntitlements(t);
  if (!modules.includes("evaluacion_360"))
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Evaluación de desempeño 360</h1>
        <Alert variant="warning">
          Este módulo no está incluido en tu plan. Actualiza tu plan desde Facturación para usarlo.
        </Alert>
      </div>
    );
  // Ver todo = administra el módulo; el resto solo responde lo suyo y ve su propio resultado.
  const manage = ctx.scope === "all";
  const create = can(ctx.permissions, "performance", "create");
  const edit = can(ctx.permissions, "performance", "edit");
  const me = await workerOfUser(t, ctx.user.email);
  const [pending, mine, cycles, settings] = await Promise.all([
    myPending(t, ctx.user.email),
    me ? myClosedCycles(t, me.id) : Promise.resolve([]),
    manage ? listCycles(t) : Promise.resolve([]),
    manage ? getSettings(t) : Promise.resolve({ anonymous: true }),
  ]);
  const today = todayYmd();
  const cycleFields: FieldSpec[] = [
    { name: "name", label: "Nombre del ciclo (p. ej. Evaluación 2026)", required: true },
    {
      name: "dueOn",
      label: "Fecha límite para responder",
      type: "date",
      saved: addDays(today, 30),
      required: true,
    },
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Evaluación de desempeño 360</h1>

      <Card className="space-y-2">
        <CardTitle>Mis evaluaciones por responder</CardTitle>
        {pending.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tienes evaluaciones pendientes.</p>
        ) : (
          <ul className="divide-y text-sm">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong>{p.subject}</strong>
                  {p.position ? ` · ${p.position}` : ""}
                  <span className="text-muted-foreground">
                    {" "}
                    · {p.cycle} · como {levelLabel(p.level)} · límite {formatDate(p.dueOn)}
                  </span>{" "}
                  <Badge variant={p.anonymous ? "default" : "warning"}>
                    {p.anonymous ? "Anónima" : "Identificada"}
                  </Badge>
                </span>
                <Link
                  href={`/desempeno/responder/${p.id}`}
                  className="text-primary underline"
                  aria-label={`Responder la evaluación de ${p.subject}`}
                >
                  Responder
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!me && (
          <p className="text-muted-foreground text-xs">
            Tu usuario no está vinculado a una ficha de Personas (se vincula por correo), por eso no
            aparecen evaluaciones asignadas a ti.
          </p>
        )}
      </Card>

      {mine.length > 0 && (
        <Card className="space-y-2">
          <CardTitle>Mis resultados</CardTitle>
          <ul className="space-y-1 text-sm">
            {mine.map((c) => (
              <li key={c.id}>
                <Link href={`/desempeno/ciclos/${c.id}`} className="text-primary underline">
                  {c.name}
                </Link>{" "}
                <span className="text-muted-foreground">· cerrado el {formatDate(c.closedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {manage && (
        <>
          <Card className="space-y-2">
            <CardTitle>Anonimato</CardTitle>
            <p className="text-muted-foreground text-sm">
              Define si los ciclos nuevos son anónimos. Cada ciclo conserva el valor con que se
              creó: cambiarlo aquí no afecta ciclos ya creados.
            </p>
            {edit ? (
              <ActionForm
                action={settingsAction}
                submit="Guardar"
                idPrefix="set-"
                fields={[
                  {
                    name: "anonymous",
                    label:
                      "Evaluaciones anónimas (nadie, ni la empresa, ve quién calificó a quién)",
                    type: "checkbox",
                    saved: settings.anonymous,
                  },
                ]}
              />
            ) : (
              <Badge>{settings.anonymous ? "Anónimas" : "Identificadas"}</Badge>
            )}
          </Card>

          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Ciclos de evaluación</h2>
            {create && (
              <FormModal
                title="Nuevo ciclo de evaluación"
                trigger="Nuevo ciclo"
                triggerVariant="default"
              >
                <ActionForm
                  action={cycleAction}
                  submit="Crear ciclo"
                  fields={cycleFields}
                  idPrefix="cy-"
                />
              </FormModal>
            )}
          </div>
          {cycles.length === 0 && (
            <p className="text-muted-foreground text-sm">Aún no hay ciclos de evaluación.</p>
          )}
          {cycles.map((c) => (
            <Card key={c.id} className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/desempeno/ciclos/${c.id}`}
                  className="text-primary font-semibold underline"
                >
                  {c.name}
                </Link>
                <span className="flex gap-2">
                  <Badge variant={c.status === "open" ? "warning" : "success"}>
                    {c.status === "open" ? "Abierto" : "Cerrado"}
                  </Badge>
                  <Badge>{c.anonymous ? "Anónimo" : "Identificado"}</Badge>
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                {c.subjects} persona(s) evaluada(s) · {c.done} de {c.total} evaluaciones respondidas
                · límite {formatDate(c.dueOn)}
              </p>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
