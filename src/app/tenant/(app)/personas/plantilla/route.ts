import { NextResponse } from "next/server";
import { requirePermission } from "@/core/auth/session";
import { IMPORT_TEMPLATE } from "@/modules/workers/rules";

export async function GET() {
  await requirePermission("workers", "create");
  const example =
    "Trabajador,CC,1032456789,Ana Pérez,ana@empresa.co,3001234567,Operaria,Producción,Sede principal,indefinido,01/03/2024,,Sura,Porvenir,Sura,1,Comfama,";
  return new NextResponse(`﻿${IMPORT_TEMPLATE}\r\n${example}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-personas.csv"',
    },
  });
}
