import { redirect } from "next/navigation";
import { AuthCard } from "@/components/layout/auth-card";
import { Alert } from "@/components/ui/alert";
import { listUserTenants } from "@/core/auth/access";
import { getSession } from "@/core/auth/session";
import { originFor } from "@/core/tenancy/hosts";
import { primaryHostForTenant } from "@/core/tenancy/primary-host";

export const metadata = { title: "Elige tu empresa" };

export default async function SelectTenant() {
  const s = await getSession();
  if (!s) redirect("/login");
  const tenants = await listUserTenants(s.user.id);
  const items = (
    await Promise.all(
      tenants.map(async (t) => ({ ...t, host: await primaryHostForTenant(t.tenantId) })),
    )
  ).filter((t): t is typeof t & { host: string } => Boolean(t.host));

  // Una sola empresa: entrar directo.
  if (items.length === 1)
    redirect(`/api/auth/handoff/issue?host=${encodeURIComponent(items[0].host)}`);

  return (
    <AuthCard title="Elige tu empresa" brandName="SST">
      {items.length === 0 ? (
        <Alert variant="warning">
          Tu usuario aún no pertenece a ninguna empresa. Pide una invitación a tu administrador.
        </Alert>
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t.tenantId}>
              <a
                href={`/api/auth/handoff/issue?host=${encodeURIComponent(t.host)}`}
                className="hover:bg-muted flex min-h-11 flex-col justify-center rounded-md border px-3 py-2"
              >
                <span className="font-medium">{t.name}</span>
                <span className="text-muted-foreground text-xs">
                  {originFor(t.host).replace(/^https?:\/\//, "")}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </AuthCard>
  );
}
