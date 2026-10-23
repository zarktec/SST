import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatCOP } from "@/lib/format";
import { listPlans } from "@/modules/platform/plans/service";

export const metadata = { title: "Planes y precios" };
export const dynamic = "force-dynamic"; // los precios los edita el SUPER ADMIN

export default async function Pricing() {
  const plans = (await listPlans({ onlyVisible: true })).filter((p) => !p.isTrial);
  const trial = (await listPlans()).find((p) => p.isTrial && p.active);
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Planes y precios</h1>
        {trial?.trialDays ? (
          <p className="text-muted-foreground">
            Prueba gratis {trial.trialDays} días, sin restricciones y sin tarjeta.
          </p>
        ) : null}
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardTitle>{p.name}</CardTitle>
            {p.description && <CardDescription className="mt-1">{p.description}</CardDescription>}
            <ul className="mt-3 space-y-1 text-sm">
              {(["monthly", "annual"] as const).map(
                (per) =>
                  p.prices[per]?.active && (
                    <li key={per}>
                      <span className="text-lg font-semibold">
                        {formatCOP(p.prices[per]!.amountCents)}
                      </span>{" "}
                      / {per === "monthly" ? "mes" : "año"}
                    </li>
                  ),
              )}
              <li className="text-muted-foreground">
                {!p.vatEnabled
                  ? "Sin IVA"
                  : p.vatIncluded
                    ? `IVA ${p.vatRateBp / 100}% incluido`
                    : `+ IVA ${p.vatRateBp / 100}%`}
              </li>
            </ul>
            <Link href={`/registro?plan=${p.key}`} className="mt-4 block">
              <Button className="w-full">Probar gratis</Button>
            </Link>
          </Card>
        ))}
        {plans.length === 0 && (
          <p className="text-muted-foreground">Pronto publicaremos nuestros planes.</p>
        )}
      </div>
    </main>
  );
}
