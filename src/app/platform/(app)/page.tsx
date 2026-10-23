import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Resumen" };

export default function PlatformHome() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Panel de plataforma</h1>
      <Card>
        <CardTitle>Integraciones</CardTitle>
        <CardDescription className="mt-1">
          Configura Wompi, Siigo, AUCO, Google y Microsoft desde la sección Integraciones.
        </CardDescription>
      </Card>
    </div>
  );
}
