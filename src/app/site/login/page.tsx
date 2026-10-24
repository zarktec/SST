import Link from "next/link";
import { rootDomain } from "@/core/tenancy/hosts";
import { CompanyLoginForm } from "./login-form";

export const metadata = { title: "Ingresar" };

export default function LoginEntry() {
  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-bold">Ingresar a tu empresa</h1>
      <p className="text-muted-foreground text-sm">
        Cada empresa tiene su propia dirección. Escríbela para ir a su pantalla de ingreso.
      </p>
      <CompanyLoginForm root={rootDomain()} />
      <p className="text-sm">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="text-primary underline">
          Empieza tu prueba gratuita
        </Link>
      </p>
    </main>
  );
}
