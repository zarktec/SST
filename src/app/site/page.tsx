import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold sm:text-4xl">Tu SG-SST listo para una inspección</h1>
      <p className="text-muted-foreground text-lg">
        Monta, administra y demuestra el cumplimiento de tu Sistema de Gestión de Seguridad y Salud
        en el Trabajo, con la evidencia lista desde la app.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/registro">
          <Button>Empieza tu prueba gratuita</Button>
        </Link>
        <Link href="/precios">
          <Button variant="outline">Ver planes y precios</Button>
        </Link>
      </div>
    </main>
  );
}
