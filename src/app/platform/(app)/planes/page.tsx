import { PLAN_MODULE_KEYS } from "@/core/plans/modules";
import { FormModal } from "@/components/ui/modal";
import { createPlanAction } from "./actions";
import { PlanForm } from "./plan-form";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/format";
import { priceBreakdown } from "@/modules/platform/plans/rules";
import { listPlans, vatOf } from "@/modules/platform/plans/service";

export const metadata = { title: "Planes" };

export default async function PlansPage() {
  const plans = await listPlans();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Planes</h1>
        <div className="flex gap-2">
          <Link href="/cupones" className={buttonVariants({ variant: "outline" })}>
            Cupones
          </Link>
          <FormModal title="Nuevo plan" trigger="Nuevo plan" triggerVariant="default" size="lg">
            <PlanForm
              isNew
              action={createPlanAction}
              initial={{
                key: "",
                name: "",
                description: "",
                isTrial: false,
                trialDays: null,
                vatEnabled: true,
                vatIncluded: false,
                vatRatePercent: 19,
                limits: { workers: null, users: null, centers: null, storageMb: null },
                modules: [...PLAN_MODULE_KEYS],
                visible: true,
                sortOrder: 10,
                active: true,
                monthlyPesos: null,
                annualPesos: null,
                monthlySiigoCode: null,
                annualSiigoCode: null,
              }}
            />
          </FormModal>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {plans.map((p) => {
          const vat = vatOf(p);
          return (
            <li key={p.id}>
              <Link href={`/planes/${p.id}`} className="block">
                <Card className="hover:bg-muted h-full space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{p.name}</h2>
                    <div className="flex gap-1">
                      {p.isTrial && <Badge variant="warning">Prueba · {p.trialDays} días</Badge>}
                      <Badge variant={p.active ? "success" : "default"}>
                        {p.active ? "Activo" : "Inactivo"}
                      </Badge>
                      {!p.visible && <Badge>Oculto</Badge>}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm">{p.description}</p>
                  <ul className="text-sm">
                    {(["monthly", "annual"] as const).map((period) => {
                      const price = p.prices[period];
                      if (!price?.active) return null;
                      const b = priceBreakdown(price.amountCents, vat);
                      return (
                        <li key={period}>
                          {period === "monthly" ? "Mensual" : "Anual"}:{" "}
                          <strong>{formatCOP(b.totalCents)}</strong>{" "}
                          <span className="text-muted-foreground text-xs">
                            {vat.enabled
                              ? vat.included
                                ? "IVA incluido"
                                : `+ IVA ${vat.rateBp / 100}%`
                              : "sin IVA"}
                          </span>
                        </li>
                      );
                    })}
                    {p.isTrial && (
                      <li className="text-muted-foreground">Gratuito durante la prueba</li>
                    )}
                  </ul>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
