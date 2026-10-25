import { BrandLogo } from "@/components/ui/brand-logo";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

/** Contenedor centrado para pantallas de acceso. */
export function AuthCard({
  title,
  description,
  brandName,
  logoUrl,
  children,
}: {
  title: string;
  description?: string;
  brandName: string;
  logoUrl?: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandName} className="h-12" />
          ) : (
            <BrandLogo variant="auto" height={44} />
          )}
          <p className="text-muted-foreground text-sm">
            {logoUrl
              ? brandName
              : brandName === "SST"
                ? "Seguridad y Salud en el Trabajo"
                : brandName}
          </p>
        </div>
        <Card>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
          <div className="mt-4">{children}</div>
        </Card>
      </div>
    </main>
  );
}
