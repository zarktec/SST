import { getAuth } from "@/core/auth/config";
import { classifyHost } from "@/core/tenancy/hosts";
import { resolveTenantByHost } from "@/core/tenancy/resolve";

async function handle(req: Request): Promise<Response> {
  const host = req.headers.get("host") ?? "";
  const kind = classifyHost(host).kind;
  // Un dominio propio sin verificar (o un subdominio del dominio raíz desconocido) no recibe servicio de auth.
  if (kind === "unknown" || (kind === "custom" && !(await resolveTenantByHost(host)))) {
    return new Response("Not found", { status: 404 });
  }
  return (await getAuth(host)).handler(req);
}

export { handle as GET, handle as POST };
