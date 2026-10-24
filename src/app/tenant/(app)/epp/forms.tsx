"use client";
import { useState, useTransition } from "react";
import { useActionState } from "@/components/forms/use-form-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SignaturePad } from "@/components/ui/signature-pad";
import type { FormState } from "@/lib/form-state";
import { REASONS } from "@/modules/ppe/rules";
import {
  addStockAction,
  archiveItemAction,
  deliveryAction,
  requirementAction,
  saveItemAction,
} from "./actions";
import { todayYmd } from "@/lib/dates";

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";
const today = () => todayYmd();

export function ActionButton({
  run,
  children,
  confirm: ask,
}: {
  run: () => Promise<FormState>;
  children: React.ReactNode;
  confirm?: string;
}) {
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.message}</Alert>}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => (!ask || window.confirm(ask)) && start(async () => setMsg(await run()))}
      >
        {pending ? "Procesando…" : children}
      </Button>
    </div>
  );
}
export const ArchiveButton = ({ id }: { id: string }) => (
  <ActionButton run={() => archiveItemAction(id)} confirm="¿Archivar este EPP?">
    Archivar
  </ActionButton>
);
export const RemoveRequirement = ({
  position,
  itemId,
  label,
}: {
  position: string;
  itemId: string;
  label: string;
}) => <ActionButton run={() => requirementAction(position, itemId, false)}>{label}</ActionButton>;

type I = {
  id: string;
  name: string;
  category: string | null;
  usefulLifeMonths: number | null;
  requiresSize: boolean;
  minStock: number;
};
export function ItemForm({ item }: { item?: I }) {
  const [s, action, pending] = useActionState(saveItemAction, null);
  const pfx = item ? `${item.id}-` : "new-";
  return (
    <form action={action} className="space-y-3">
      {item && <input type="hidden" name="id" value={item.id} />}
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          idPrefix={pfx}
          state={s}
          saved={item?.name}
          name="name"
          label="Nombre del EPP"
          required
        />
        <Field idPrefix={pfx} state={s} saved={item?.category} name="category" label="Categoría" />
        <Field
          idPrefix={pfx}
          state={s}
          saved={item?.usefulLifeMonths}
          name="usefulLifeMonths"
          label="Vida útil (meses; vacío = no vence)"
          inputMode="numeric"
        />
        <Field
          idPrefix={pfx}
          state={s}
          saved={item?.minStock ?? 0}
          name="minStock"
          label="Inventario mínimo"
          inputMode="numeric"
        />
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="requiresSize"
          defaultChecked={item?.requiresSize}
          className="size-5"
        />{" "}
        Requiere talla
      </label>
      <Button type="submit" disabled={pending}>
        {item ? "Guardar" : "Crear EPP"}
      </Button>
    </form>
  );
}

export function StockForm({ items }: { items: { id: string; name: string }[] }) {
  const [s, action, pending] = useActionState(addStockAction, null);
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="stock-item">EPP</Label>
          <Select
            id="stock-item"
            name="itemId"
            className={sel}
            defaultValue={
              typeof s?.values?.itemId === "string" ? s.values.itemId : (items[0]?.id ?? "")
            }
          >
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </div>
        <Field
          idPrefix="stock-"
          state={s}
          name="quantity"
          label="Cantidad"
          inputMode="numeric"
          required
        />
        <Field
          idPrefix="stock-"
          state={s}
          saved={today()}
          name="entryDate"
          label="Fecha"
          type="date"
          required
        />
        <Field idPrefix="stock-" state={s} name="supplier" label="Proveedor" />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending || items.length === 0}>
        Registrar ingreso
      </Button>
    </form>
  );
}

export function AddRequirement({ items }: { items: { id: string; name: string }[] }) {
  const [position, setPosition] = useState("");
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="rq-position">Cargo (igual que en la ficha)</Label>
          <Input id="rq-position" value={position} onChange={(e) => setPosition(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rq-item">EPP exigido</Label>
          <Select
            id="rq-item"
            className={sel}
            defaultValue={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Button
        size="sm"
        disabled={pending || !position.trim() || !itemId}
        onClick={() => start(async () => setMsg(await requirementAction(position, itemId, true)))}
      >
        Agregar a la matriz
      </Button>
    </div>
  );
}

export function DeliveryForm({
  people,
  items,
  initial,
}: {
  people: { id: string; name: string }[];
  items: { id: string; name: string; requiresSize: boolean }[];
  initial?: { workerId?: string; itemId?: string };
}) {
  const [s, action, pending] = useActionState(deliveryAction, null);
  const [sig, setSig] = useState<string | null>(null);
  const [itemId, setItemId] = useState(initial?.itemId ?? items[0]?.id ?? "");
  const needsSize = items.find((i) => i.id === itemId)?.requiresSize;
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <input type="hidden" name="signature" value={sig ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="d-worker">Persona</Label>
          <Select
            id="d-worker"
            name="workerId"
            className={sel}
            defaultValue={
              typeof s?.values?.workerId === "string"
                ? s.values.workerId
                : (initial?.workerId ?? people[0]?.id ?? "")
            }
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="d-item">EPP</Label>
          <Select
            id="d-item"
            name="itemId"
            className={sel}
            defaultValue={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </div>
        <Field
          idPrefix="d-"
          state={s}
          saved={1}
          name="quantity"
          label="Cantidad"
          inputMode="numeric"
        />
        <Field
          idPrefix="d-"
          state={s}
          name="size"
          label={needsSize ? "Talla (obligatoria)" : "Talla"}
        />
        <div className="space-y-1">
          <Label htmlFor="d-reason">Motivo</Label>
          <Select
            id="d-reason"
            name="reason"
            className={sel}
            defaultValue={typeof s?.values?.reason === "string" ? s.values.reason : "first"}
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        <Field
          idPrefix="d-"
          state={s}
          saved={today()}
          name="deliveredAt"
          label="Fecha de entrega"
          type="date"
          required
        />
      </div>
      <div className="space-y-1">
        <Label>Firma del trabajador (recibe conforme)</Label>
        <SignaturePad onChange={setSig} />
      </div>
      <Button type="submit" disabled={pending || !sig || people.length === 0 || items.length === 0}>
        {pending ? "Registrando…" : "Registrar entrega"}
      </Button>
    </form>
  );
}
