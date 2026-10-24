import { FormModal } from "@/components/ui/modal";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getPlan } from "@/modules/platform/plans/service";
import { archivePlanAction, updatePlanAction } from "../actions";
import { PlanForm } from "../plan-form";

export default async function EditPlan({ params }: PageProps<"/platform/planes/[id]">) {
  const { id } = await params;
  const p = await getPlan(id);
  if (!p) notFound();
  const pesos = (c: bigint | undefined, active: boolean | undefined) =>
    c !== undefined && active ? Number(c / 100n) : null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{p.name}</h1>
      <p className="text-muted-foreground text-sm">
        Clave: <code>{p.key}</code>
      </p>
      <FormModal
        title={`Editar plan: ${p.name}`}
        trigger="Editar plan"
        triggerVariant="default"
        size="lg"
      >
        <PlanForm
          isNew={false}
          action={updatePlanAction.bind(null, p.id, p.key)}
          initial={{
            key: p.key,
            name: p.name,
            description: p.description,
            isTrial: p.isTrial,
            trialDays: p.trialDays,
            vatEnabled: p.vatEnabled,
            vatIncluded: p.vatIncluded,
            vatRatePercent: p.vatRateBp / 100,
            limits: p.limits,
            modules: p.modules,
            visible: p.visible,
            sortOrder: p.sortOrder,
            active: p.active,
            monthlyPesos: pesos(p.prices.monthly?.amountCents, p.prices.monthly?.active),
            annualPesos: pesos(p.prices.annual?.amountCents, p.prices.annual?.active),
            monthlySiigoCode: p.prices.monthly?.siigoProductCode ?? null,
            annualSiigoCode: p.prices.annual?.siigoProductCode ?? null,
          }}
          extra={
            <form action={archivePlanAction.bind(null, p.id)}>
              <Button type="submit" variant="destructive">
                Archivar plan
              </Button>
            </form>
          }
        />
      </FormModal>
    </div>
  );
}
