import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requirePermission } from "@/core/auth/session";
import { InspectionError, submitInspection } from "@/modules/inspections/service";

/**
 * Recepción de inspecciones hechas en el celular (en línea o desde la cola sin conexión). Es idempotente por `offlineId`.
 * Sin sesión o sin permiso la respuesta es una redirección (el cliente conserva el elemento en la cola y reintenta tras iniciar
 * sesión). Un error de validación responde 422: el elemento no se reintenta.
 */
export async function POST(req: Request) {
  const ctx = await requirePermission("inspections", "create");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Solicitud inválida" }, { status: 400 });
  }
  try {
    const r = await submitInspection(
      ctx.tenant.tenantId,
      ctx.user.id,
      ctx.user.name || ctx.user.email,
      body as never,
    );
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json(
        { ok: false, message: e.issues.map((i) => i.message).join(". ") },
        { status: 422 },
      );
    if (e instanceof InspectionError)
      return NextResponse.json({ ok: false, message: e.message }, { status: 422 });
    if (
      e instanceof Error &&
      ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code))
    )
      return NextResponse.json({ ok: false, message: e.message }, { status: 422 });
    throw e;
  }
}
