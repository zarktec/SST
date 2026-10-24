import { ActionForm, RunButton, type FieldSpec } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { getEntitlements } from "@/core/plans/limits";
import { can } from "@/core/rbac/can";
import { todayYmd } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { LICENSE_CATEGORIES, OWNERSHIP, PREOP_ITEMS, VEHICLE_KINDS } from "@/modules/pesv/rules";
import {
  annualStats,
  listCrashes,
  listDrivers,
  listPreops,
  listVehicles,
} from "@/modules/pesv/service";
import { listWorkers } from "@/modules/workers/service";
import {
  crashAction,
  driverAction,
  preopAction,
  retireDriverAction,
  retireVehicleAction,
  vehicleAction,
} from "./actions";

export const metadata = { title: "PESV" };
const EXP = {
  vigente: "success",
  por_vencer: "warning",
  vencido: "destructive",
  sin_fecha: "default",
} as const;
const EXP_TXT = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  sin_fecha: "Sin fecha",
} as const;
const label = (l: readonly { value: string; label: string }[], v: string) =>
  l.find((x) => x.value === v)?.label ?? v;

export default async function PesvPage() {
  const ctx = await requirePermission("pesv", "view");
  const t = ctx.tenant.tenantId;
  const { modules } = await getEntitlements(t);
  if (!modules.includes("pesv"))
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Plan Estratégico de Seguridad Vial (PESV)</h1>
        <Alert variant="warning">
          Este módulo no está incluido en tu plan. Actualiza tu plan desde Facturación para usarlo.
        </Alert>
      </div>
    );
  const create = can(ctx.permissions, "pesv", "create");
  const edit = can(ctx.permissions, "pesv", "edit");
  const today = todayYmd();
  const year = Number(today.slice(0, 4));
  const [vehicles, drivers, preops, crashes, stats, people] = await Promise.all([
    listVehicles(t),
    listDrivers(t),
    listPreops(t, 15),
    listCrashes(t),
    annualStats(t, year),
    create && can(ctx.permissions, "workers", "view")
      ? listWorkers(t, { status: "active" })
      : Promise.resolve([]),
  ]);
  const vehicleOpts = vehicles.map((v) => ({
    value: v.id,
    label: `${v.plate} · ${label(VEHICLE_KINDS, v.kind)}`,
  }));
  const vehicleFields = (v?: (typeof vehicles)[number]): FieldSpec[] => [
    { name: "plate", label: "Placa", saved: v?.plate, required: true },
    { name: "kind", label: "Tipo", type: "select", options: [...VEHICLE_KINDS], saved: v?.kind },
    {
      name: "ownership",
      label: "Propiedad",
      type: "select",
      options: [...OWNERSHIP],
      saved: v?.ownership,
    },
    { name: "description", label: "Descripción (marca, línea, modelo)", saved: v?.description },
    { name: "soatExpiresOn", label: "SOAT vence", type: "date", saved: v?.soatExpiresOn },
    {
      name: "rtmExpiresOn",
      label: "Revisión técnico-mecánica vence",
      type: "date",
      saved: v?.rtmExpiresOn,
    },
  ];
  const preopFields: FieldSpec[] = [
    { name: "vehicleId", label: "Vehículo", type: "select", options: vehicleOpts },
    { name: "odometer", label: "Kilometraje", type: "number" },
    ...PREOP_ITEMS.flatMap((i, idx) => [
      {
        name: `ok_${idx}`,
        label: `${i.item}${i.critical ? " (crítico)" : ""}: en buen estado`,
        type: "checkbox" as const,
        saved: true,
      },
      { name: `note_${idx}`, label: `Si falla, describe: ${i.item}` },
    ]),
    { name: "notes", label: "Observaciones", type: "textarea" },
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Plan Estratégico de Seguridad Vial (PESV)</h1>
      <Card>
        <CardTitle>Datos {year} para el reporte anual de autogestión</CardTitle>
        <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <li>
            Vehículos con SOAT y revisión vigentes:{" "}
            <strong>
              {stats.vehiclesDocsOk} de {stats.vehicles}
            </strong>
          </li>
          <li>
            Conductores con licencia vigente:{" "}
            <strong>
              {stats.driversLicenseOk} de {stats.drivers}
            </strong>
          </li>
          <li>
            Vehículos con preoperacional en 30 días:{" "}
            <strong>
              {stats.preopVehiclesLast30} de {stats.vehicles}
            </strong>
          </li>
          <li>
            Siniestros viales: <strong>{stats.crashes}</strong> · lesionados {stats.injured} ·
            muertos {stats.fatalities}
          </li>
          <li>
            Siniestros por vehículo: <strong>{stats.crashesPerVehicle ?? "—"}</strong>
          </li>
        </ul>
        <p className="text-muted-foreground mt-2 text-xs">
          Conteos base: las fórmulas oficiales de los indicadores del PESV están pendientes de
          validación con el experto.
        </p>
      </Card>

      {create && vehicles.length > 0 && (
        <Card>
          <CardTitle>Inspección preoperacional</CardTitle>
          <div className="mt-3">
            <ActionForm
              action={preopAction}
              idPrefix="po-"
              submit="Registrar preoperacional"
              fields={preopFields}
            />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Lista provisional: ajústala con tu responsable del PESV.
          </p>
        </Card>
      )}

      <Card>
        <CardTitle>Vehículos</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {vehicles.map((v) => (
            <li key={v.id} className="space-y-2 py-3">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{v.plate}</span>
                <span className="text-muted-foreground">
                  {label(VEHICLE_KINDS, v.kind)} · {label(OWNERSHIP, v.ownership)}
                  {v.description ? ` · ${v.description}` : ""}
                </span>
                <Badge variant={EXP[v.docs.soat]}>
                  SOAT: {EXP_TXT[v.docs.soat]}
                  {v.soatExpiresOn ? ` · ${formatDate(v.soatExpiresOn)}` : ""}
                </Badge>
                <Badge variant={EXP[v.docs.rtm]}>
                  RTM: {EXP_TXT[v.docs.rtm]}
                  {v.rtmExpiresOn ? ` · ${formatDate(v.rtmExpiresOn)}` : ""}
                </Badge>
              </p>
              {edit && (
                <details>
                  <summary className="text-primary min-h-11 cursor-pointer py-2">
                    Editar o retirar
                  </summary>
                  <ActionForm
                    action={vehicleAction}
                    idPrefix={`v-${v.id}-`}
                    hidden={{ id: v.id }}
                    submit="Guardar vehículo"
                    fields={vehicleFields(v)}
                  />
                  <RunButton
                    action={retireVehicleAction}
                    arg={v.id}
                    confirm="¿Retirar este vehículo?"
                  >
                    Retirar vehículo
                  </RunButton>
                </details>
              )}
            </li>
          ))}
          {vehicles.length === 0 && <li className="text-muted-foreground py-2">Sin vehículos.</li>}
        </ul>
        {create && (
          <details className="mt-3">
            <summary className="text-primary min-h-11 cursor-pointer py-2">
              Agregar vehículo
            </summary>
            <ActionForm
              action={vehicleAction}
              idPrefix="nv-"
              submit="Agregar vehículo"
              fields={vehicleFields()}
            />
          </details>
        )}
      </Card>

      <Card>
        <CardTitle>Conductores</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {drivers.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-semibold">{d.name}</span>
              <Badge>Categoría {d.licenseCategory}</Badge>
              <Badge variant={EXP[d.license]}>
                Licencia {EXP_TXT[d.license].toLowerCase()} · {formatDate(d.licenseExpiresOn)}
              </Badge>
              {edit && (
                <RunButton
                  action={retireDriverAction}
                  arg={d.id}
                  confirm="¿Retirar a este conductor?"
                >
                  Retirar
                </RunButton>
              )}
            </li>
          ))}
          {drivers.length === 0 && <li className="text-muted-foreground py-2">Sin conductores.</li>}
        </ul>
        {create && people.length > 0 && (
          <details className="mt-3">
            <summary className="text-primary min-h-11 cursor-pointer py-2">
              Agregar o actualizar licencia
            </summary>
            <ActionForm
              action={driverAction}
              idPrefix="nd-"
              submit="Guardar conductor"
              fields={[
                {
                  name: "workerId",
                  label: "Persona",
                  type: "select",
                  options: people.map((p) => ({ value: p.id, label: p.fullName })),
                },
                {
                  name: "licenseCategory",
                  label: "Categoría de la licencia",
                  type: "select",
                  options: LICENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
                },
                { name: "licenseExpiresOn", label: "Vence", type: "date", required: true },
              ]}
            />
          </details>
        )}
      </Card>

      <Card>
        <CardTitle>Últimas inspecciones preoperacionales</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {preops.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-semibold">{p.plate}</span>
              <span className="text-muted-foreground">
                {formatDate(p.performedAt.toISOString().slice(0, 10))} · {p.driverName}
              </span>
              <Badge variant={p.failCount ? "destructive" : "success"}>
                {p.failCount ? `${p.failCount} falla(s)` : "Sin fallas"}
              </Badge>
            </li>
          ))}
          {preops.length === 0 && <li className="text-muted-foreground py-2">Sin inspecciones.</li>}
        </ul>
      </Card>

      <Card>
        <CardTitle>Siniestros viales</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {crashes.map((c) => (
            <li key={c.id} className="space-y-1 py-2">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {formatDate(c.occurredAt.toISOString().slice(0, 10))}
                </span>
                {c.plate && <Badge>{c.plate}</Badge>}
                <span className="text-muted-foreground">
                  {c.driverName} · {c.place} · {c.injured} lesionado(s) · {c.fatalities} muerto(s)
                </span>
              </p>
              <p>{c.description}</p>
            </li>
          ))}
          {crashes.length === 0 && <li className="text-muted-foreground py-2">Sin siniestros.</li>}
        </ul>
        {create && (
          <details className="mt-3">
            <summary className="text-primary min-h-11 cursor-pointer py-2">
              Registrar siniestro
            </summary>
            <ActionForm
              action={crashAction}
              idPrefix="cr-"
              submit="Registrar siniestro"
              fields={[
                ...(vehicleOpts.length
                  ? [
                      {
                        name: "vehicleId",
                        label: "Vehículo",
                        type: "select" as const,
                        options: vehicleOpts,
                        empty: "No aplica",
                      },
                    ]
                  : []),
                { name: "driverName", label: "Conductor", required: true },
                { name: "date", label: "Fecha", type: "date", saved: today, required: true },
                { name: "time", label: "Hora", type: "time", saved: "08:00" },
                { name: "place", label: "Lugar", required: true },
                { name: "injured", label: "Lesionados", type: "number", saved: 0 },
                { name: "fatalities", label: "Muertos", type: "number", saved: 0 },
                {
                  name: "atFault",
                  label: "Responsabilidad del conductor",
                  type: "select",
                  options: [
                    { value: "unknown", label: "Por establecer" },
                    { value: "yes", label: "Sí" },
                    { value: "no", label: "No" },
                  ],
                },
                { name: "description", label: "Qué pasó", type: "textarea" },
              ]}
            />
          </details>
        )}
      </Card>
    </div>
  );
}
