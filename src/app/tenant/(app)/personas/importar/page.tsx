import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { IMPORT_TEMPLATE } from "@/modules/workers/rules";
import { ImportForm } from "../import-form";

export const metadata = { title: "Carga masiva de personas" };

export default async function ImportPage() {
  await requirePermission("workers", "create");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Carga masiva</h1>
      <Card>
        <CardTitle>1. Descarga la plantilla</CardTitle>
        <CardDescription className="mt-1">
          <a className="text-primary underline" href="/personas/plantilla">
            plantilla-personas.csv
          </a>
          . Obligatorias: vinculacion (Trabajador, Aprendiz o Contratista), tipo_documento (CC, CE,
          TI, PEP, pasaporte), documento, nombre y fecha_ingreso (AAAA-MM-DD o DD/MM/AAAA). La sede
          se escribe con el mismo nombre registrado.
        </CardDescription>
        <p className="text-muted-foreground mt-2 text-xs break-all">Columnas: {IMPORT_TEMPLATE}</p>
      </Card>
      <Card>
        <CardTitle>2. Sube el archivo</CardTitle>
        <div className="mt-3">
          <ImportForm />
        </div>
      </Card>
    </div>
  );
}
