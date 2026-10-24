import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/ui/modal";
import { Card, CardTitle } from "@/components/ui/card";
import { formatCOP, formatDate } from "@/lib/format";
import { listCoupons, listPlans } from "@/modules/platform/plans/service";
import { toggleCouponAction } from "../planes/actions";
import { CouponForm } from "./coupon-form";

export const metadata = { title: "Cupones" };

export default async function CouponsPage() {
  const [coupons, plans] = await Promise.all([listCoupons(), listPlans()]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Cupones</h1>
        <FormModal title="Nuevo cupón" trigger="Nuevo cupón" triggerVariant="default">
          <CouponForm
            plans={plans.filter((p) => !p.isTrial).map((p) => ({ id: p.id, name: p.name }))}
          />
        </FormModal>
      </div>
      <Card>
        <CardTitle>Cupones creados</CardTitle>
        {coupons.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Aún no hay cupones.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {coupons.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-mono font-semibold">{c.code}</p>
                  <p className="text-muted-foreground">
                    {c.kind === "percent" ? `${Number(c.value) / 100}%` : formatCOP(c.value)} · usos{" "}
                    {c.usedCount}
                    {c.maxUses ? `/${c.maxUses}` : ""}
                    {c.validTo ? ` · hasta ${formatDate(c.validTo)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.active ? "success" : "default"}>
                    {c.active ? "Activo" : "Inactivo"}
                  </Badge>
                  <form action={toggleCouponAction.bind(null, c.id, !c.active)}>
                    <Button type="submit" variant="outline" size="sm">
                      {c.active ? "Desactivar" : "Activar"}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
