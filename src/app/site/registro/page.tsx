import { rootDomain } from "@/core/tenancy/hosts";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Crear mi empresa" };

export default async function Signup({ searchParams }: PageProps<"/site/registro">) {
  const sp = await searchParams;
  const plan = typeof sp.plan === "string" ? sp.plan : undefined;
  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-bold">Empieza tu prueba gratuita</h1>
      <p className="text-muted-foreground text-sm">
        Sin tarjeta. Te enviaremos un enlace para entrar.
      </p>
      <SignupForm plan={plan} root={rootDomain()} />
    </main>
  );
}
