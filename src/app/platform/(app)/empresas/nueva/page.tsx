import { listPlans } from "@/modules/platform/plans/service";
import { NewTenantForm } from "./form";

export const metadata = { title: "Nueva empresa" };

export default async function NewTenant() {
  const plans = (await listPlans()).filter((p) => p.active);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nueva empresa</h1>
      <NewTenantForm plans={plans.map((p) => ({ id: p.id, name: p.name, isTrial: p.isTrial }))} />
    </div>
  );
}
