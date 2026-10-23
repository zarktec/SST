import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/core/auth/session";
import { HarassmentForm } from "../forms";

export const metadata = { title: "Reportar acoso sexual o violencia de género" };

export default async function ReportPage() {
  await requireTenantMember();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reportar acoso sexual o violencia de género</h1>
      <Card>
        <CardTitle>Canal confidencial</CardTitle>
        <CardDescription className="mt-1">
          Estos reportes los recibe la alta dirección o talento humano. No pasan por el Comité de
          Convivencia Laboral.
        </CardDescription>
        <div className="mt-3">
          <HarassmentForm />
        </div>
      </Card>
    </div>
  );
}
