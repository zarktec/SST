import { getAuth } from "@/core/auth/config";
import { classifyHost } from "@/core/tenancy/hosts";
import { resolveTenantByHost } from "@/core/tenancy/resolve";

async function handle(req: Request): Promise<Response> {
  const host = req.headers.get("host") ?? "";
  const kind = classifyHost(host).kind;
  // Un host de empresa desconocido (o un dominio propio sin verificar) no recibe servicio de auth.
  if ((kind === "subdomain" || kind === "custom") && !(await resolveTenantByHost(host))) {
    return new Response("Not found", { status: 404 });
  }
  return (await getAuth(host)).handler(req);
}

export { handle as GET, handle as POST };
