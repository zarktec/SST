import { PLAN_MODULE_KEYS } from "@/core/plans/modules";
import { createPlanAction } from "../actions";
import { PlanForm } from "../plan-form";

export const metadata = { title: "Nuevo plan" };

export default function NewPlan() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nuevo plan</h1>
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
    </div>
  );
}
