"use client";
import { useActionState, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import type { FormState } from "@/lib/form-state";
import {
  approveAction,
  createDraftAction,
  deleteRowAction,
  participationAction,
  saveRowAction,
} from "./actions";

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";
type Level = { level: string; meaning: string };

export function ActionButton({
  run,
  children,
  confirm: ask,
  variant = "default",
}: {
  run: () => Promise<FormState>;
  children: React.ReactNode;
  confirm?: string;
  variant?: "default" | "outline";
}) {
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.message}</Alert>}
      <Button
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={() => (!ask || window.confirm(ask)) && start(async () => setMsg(await run()))}
      >
        {pending ? "Procesando…" : children}
      </Button>
    </div>
  );
}
export const DraftButton = ({
  reason,
  label,
}: {
  reason: "initial" | "annual" | "serious_accident" | "change";
  label: string;
}) => (
  <ActionButton run={() => createDraftAction(reason)} variant="outline">
    {label}
  </ActionButton>
);
export const ApproveButton = ({ id }: { id: string }) => (
  <ActionButton
    run={() => approveAction(id)}
    confirm="Al aprobar, esta versión queda inmutable. ¿Aprobar?"
  >
    Aprobar matriz
  </ActionButton>
);
export const DeleteRowButton = ({ matrixId, rowId }: { matrixId: string; rowId: string }) => (
  <ActionButton
    run={() => deleteRowAction(matrixId, rowId)}
    variant="outline"
    confirm="¿Eliminar este peligro?"
  >
    Eliminar
  </ActionButton>
);

export function ParticipationForm({ matrixId, saved }: { matrixId: string; saved: string | null }) {
  const [s, action, pending] = useActionState(participationAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="matrixId" value={matrixId} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <Field
        state={s}
        saved={saved}
        name="participation"
        label="Participación de los trabajadores (quiénes y cómo)"
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Guardar
      </Button>
    </form>
  );
}

function LevelSelect({
  name,
  label,
  levels,
  state,
  saved,
}: {
  name: string;
  label: string;
  levels: Level[];
  state: FormState;
  saved?: string;
}) {
  const v = state?.values?.[name];
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        className={sel}
        defaultValue={typeof v === "string" ? v : (saved ?? levels[0]?.level)}
      >
        {levels.map((l) => (
          <option key={l.level} value={l.level} title={l.meaning}>
            {l.level}
          </option>
        ))}
      </select>
    </div>
  );
}

type RowValues = Partial<Record<string, string | number | boolean | null>>;
export function RowForm({
  matrixId,
  centers,
  scales,
  row,
}: {
  matrixId: string;
  centers: { id: string; name: string }[];
  scales: { deficiency: Level[]; exposure: Level[]; consequence: Level[] };
  row?: RowValues;
}) {
  const [s, action, pending] = useActionState(saveRowAction, null);
  const pfx = row?.id ? `${row.id}-` : "new-";
  const f = (name: string, label: string, extra: object = {}) => (
    <Field
      idPrefix={pfx}
      state={s}
      saved={row?.[name] as string | number | null | undefined}
      name={name}
      label={label}
      {...extra}
    />
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="matrixId" value={matrixId} />
      {row?.id && <input type="hidden" name="rowId" value={String(row.id)} />}
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        {f("process", "Proceso", { required: true })}
        {f("activity", "Actividad", { required: true })}
        {f("task", "Tarea", { required: true })}
        {f("hazardFamily", "Familia del peligro", {
          required: true,
          placeholder: "Físico, biomecánico…",
        })}
        {f("hazardName", "Peligro", { required: true })}
        <div className="space-y-1">
          <Label htmlFor={`${pfx}workCenterId`}>Sede</Label>
          <select
            id={`${pfx}workCenterId`}
            name="workCenterId"
            className={sel}
            defaultValue={String(row?.workCenterId ?? "")}
          >
            <option value="">Todas / sin sede</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {f("effects", "Posibles efectos")}
        {f("exposedWorkers", "Trabajadores expuestos", { inputMode: "numeric" })}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="routine"
            defaultChecked={row?.routine !== false}
            className="size-5"
          />{" "}
          Actividad rutinaria
        </label>
      </div>
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-semibold">Valoración (GTC 45)</legend>
        <LevelSelect
          name="deficiency"
          label="Nivel de deficiencia"
          levels={scales.deficiency}
          state={s}
          saved={row?.deficiency as string}
        />
        <LevelSelect
          name="exposure"
          label="Nivel de exposición"
          levels={scales.exposure}
          state={s}
          saved={row?.exposure as string}
        />
        <LevelSelect
          name="consequence"
          label="Nivel de consecuencia"
          levels={scales.consequence}
          state={s}
          saved={row?.consequence as string}
        />
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold">Controles existentes</legend>
        {f("existingSource", "En la fuente")}
        {f("existingMedium", "En el medio")}
        {f("existingPerson", "En la persona")}
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold">Controles propuestos (jerarquía)</legend>
        {f("ctrlElimination", "Eliminación")}
        {f("ctrlSubstitution", "Sustitución")}
        {f("ctrlEngineering", "Controles de ingeniería")}
        {f("ctrlAdmin", "Controles administrativos")}
        {f("ctrlEpp", "EPP")}
        {f("legalRequirement", "Requisito legal aplicable")}
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : row?.id ? "Actualizar peligro" : "Agregar peligro"}
      </Button>
    </form>
  );
}
