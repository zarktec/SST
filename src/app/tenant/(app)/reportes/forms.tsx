"use client";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { KINDS, SEVERITIES } from "@/modules/unsafe-reports/rules";
import { reportAction, reviewAction } from "./actions";

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";
const area = "border-input bg-background w-full rounded-md border p-3 text-base";
type Opt = { id: string; name: string };

export function ReportForm({ centers }: { centers: Opt[] }) {
  const [s, action, pending] = useActionState(reportAction, null);
  const [geo, setGeo] = useState<{ lat: string; lon: string } | null>(null);
  const [geoMsg, setGeoMsg] = useState("");
  const locate = () => {
    if (!navigator.geolocation) return setGeoMsg("Tu dispositivo no permite ubicación.");
    setGeoMsg("Buscando ubicación…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo({ lat: String(p.coords.latitude), lon: String(p.coords.longitude) });
        setGeoMsg("Ubicación adjunta.");
      },
      () => setGeoMsg("No se pudo obtener la ubicación; escribe el lugar."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <input type="hidden" name="latitude" value={geo?.lat ?? ""} />
      <input type="hidden" name="longitude" value={geo?.lon ?? ""} />
      <div className="space-y-1">
        <Label htmlFor="kind">¿Qué viste?</Label>
        <Select
          id="kind"
          name="kind"
          className={sel}
          defaultValue={typeof s?.values?.kind === "string" ? s.values.kind : "condition"}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Descripción</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={typeof s?.values?.description === "string" ? s.values.description : ""}
          className={area}
        />
        {s?.fieldErrors?.description && (
          <p className="text-destructive text-sm" role="alert">
            {s.fieldErrors.description}
          </p>
        )}
      </div>
      <Field state={s} name="place" label="Lugar (opcional)" />
      {centers.length > 1 && (
        <div className="space-y-1">
          <Label htmlFor="workCenterId">Sede</Label>
          <Select id="workCenterId" name="workCenterId" className={sel} defaultValue="">
            <option value="">—</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="severity">Qué tan grave parece</Label>
        <Select id="severity" name="severity" className={sel} defaultValue="medium">
          {SEVERITIES.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={locate}>
          Adjuntar mi ubicación
        </Button>
        <span className="text-muted-foreground text-sm" aria-live="polite">
          {geoMsg}
        </span>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="anonymous" className="size-5" /> Enviar de forma anónima (no se
        guarda quién reporta)
      </label>
      <p className="text-muted-foreground text-xs">
        Las fotos se podrán adjuntar cuando se habilite el almacenamiento de archivos.
      </p>
      <Button type="submit" disabled={pending}>
        Enviar reporte
      </Button>
    </form>
  );
}

export function ReviewForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(reviewAction, null);
  const [decision, setDecision] = useState("action");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="space-y-1">
        <Label htmlFor={`d-${id}`}>Decisión</Label>
        <Select
          id={`d-${id}`}
          name="decision"
          className={sel}
          defaultValue="action"
          onChange={(e) => setDecision(e.target.value)}
        >
          <option value="action">Crear una acción</option>
          <option value="dismiss">Descartar</option>
        </Select>
      </div>
      {decision === "action" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field idPrefix={`${id}-`} state={s} name="title" label="Acción" />
          <Field idPrefix={`${id}-`} state={s} name="responsibleName" label="Responsable" />
          <Field idPrefix={`${id}-`} state={s} name="dueDate" label="Fecha límite" type="date" />
        </div>
      ) : (
        <Field idPrefix={`${id}-`} state={s} name="note" label="Motivo del descarte" />
      )}
      <Button type="submit" size="sm" disabled={pending}>
        Registrar revisión
      </Button>
    </form>
  );
}
