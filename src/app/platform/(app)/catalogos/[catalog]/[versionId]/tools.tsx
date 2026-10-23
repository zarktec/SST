"use client";
import { useActionState, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import {
  deleteItemAction,
  discardAction,
  importAction,
  publishAction,
  saveItemAction,
  type CatalogState,
} from "../../actions";

function Result({ s }: { s: CatalogState }) {
  if (!s) return null;
  return (
    <div className="space-y-1">
      <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>
      {s.report?.errors.slice(0, 10).map((e) => (
        <p key={e.row} className="text-destructive text-xs">
          Fila {e.row}: {e.message}
        </p>
      ))}
      {(s.report?.errors.length ?? 0) > 10 && (
        <p className="text-muted-foreground text-xs">
          … y {(s.report?.errors.length ?? 0) - 10} errores más.
        </p>
      )}
    </div>
  );
}

export function DraftTools({ versionId, fields }: { versionId: string; fields: string[] }) {
  const [saveState, saveAction, saving] = useActionState(
    saveItemAction.bind(null, versionId),
    null,
  );
  const [importState, importFormAction, importing] = useActionState(
    importAction.bind(null, versionId),
    null,
  );
  const [pubState, pubAction, publishing] = useActionState(
    publishAction.bind(null, versionId),
    null,
  );
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <CardTitle>Agregar o editar un elemento</CardTitle>
        <p className="text-muted-foreground text-xs">
          Campos: <code>{fields.join(", ")}</code>. Si el código ya existe, se actualiza.
        </p>
        <form action={saveAction} className="space-y-2">
          <textarea
            name="json"
            required
            rows={6}
            spellCheck={false}
            aria-label="Elemento en JSON"
            className="border-input bg-background w-full rounded-md border p-3 font-mono text-sm"
            placeholder='{"key": "…"}'
          />
          <Button type="submit" disabled={saving}>
            Guardar elemento
          </Button>
          <Result s={saveState} />
        </form>
      </Card>
      <Card className="space-y-3">
        <CardTitle>Importar CSV o JSON</CardTitle>
        <p className="text-muted-foreground text-xs">
          CSV con encabezado (columnas = campos). Listas y objetos en JSON dentro de la celda.
          Acepta separador coma o punto y coma.
        </p>
        <form action={importFormAction} className="space-y-2">
          <Input
            name="file"
            type="file"
            accept=".csv,.json,text/csv,application/json"
            required
            aria-label="Archivo"
          />
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="strict" className="size-5" /> Todo o nada (no importar nada
            si alguna fila tiene errores)
          </label>
          <Button type="submit" variant="secondary" disabled={importing}>
            Importar
          </Button>
          <Result s={importState} />
        </form>
      </Card>
      <Card className="space-y-3">
        <CardTitle>Publicar versión</CardTitle>
        <p className="text-muted-foreground text-xs">
          Al publicar, la versión queda inmutable y retira la anterior. Los cálculos pasados siguen
          usando la versión con la que se hicieron.
        </p>
        <form action={pubAction} className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="effectiveFrom">Vigente desde</Label>
            <Input id="effectiveFrom" name="effectiveFrom" type="date" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sourceNorm">Norma fuente</Label>
            <Input
              id="sourceNorm"
              name="sourceNorm"
              required
              placeholder="Resolución 0312 de 2019, art. …"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notas</Label>
            <Input id="notes" name="notes" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={publishing}>
              Publicar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                confirm("¿Descartar este borrador y todos sus elementos?") &&
                start(() => discardAction(versionId))
              }
            >
              Descartar borrador
            </Button>
          </div>
          <Result s={pubState} />
        </form>
      </Card>
    </div>
  );
}

export function ItemRow({
  versionId,
  code,
  summary,
  json,
  editable,
  todo,
}: {
  versionId: string;
  code: string;
  summary: string;
  json: string;
  editable: boolean;
  todo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <li className="py-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="min-h-11 flex-1 text-left"
          aria-expanded={open}
        >
          <span className="font-mono font-medium">{code}</span>{" "}
          {todo && <Badge variant="warning">Pendiente de validar</Badge>}
          <span className="text-muted-foreground block text-xs">{summary}</span>
        </button>
        {editable && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => start(() => deleteItemAction(versionId, code))}
          >
            Eliminar
          </Button>
        )}
      </div>
      {open && <pre className="bg-muted mt-2 overflow-x-auto rounded-md p-3 text-xs">{json}</pre>}
    </li>
  );
}
