export const metadata = { title: "Sin conexión" };

export default function Offline() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-bold">Sin conexión</h1>
        <p className="text-muted-foreground text-sm">
          No hay internet. Los reportes, inspecciones y listas de asistencia que registres se
          guardan en tu dispositivo y se envían al reconectar.
        </p>
      </div>
    </main>
  );
}
