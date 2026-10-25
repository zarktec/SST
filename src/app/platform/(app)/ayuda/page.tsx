import { HelpIndex } from "@/components/help/help-pages";
import { PLATFORM_ARTICLES, PLATFORM_GROUPS } from "@/modules/help/content";

export const metadata = { title: "Ayuda del administrador" };

export default async function PlatformHelp({ searchParams }: PageProps<"/platform/ayuda">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : undefined;
  return (
    <HelpIndex
      articles={PLATFORM_ARTICLES}
      groups={PLATFORM_GROUPS}
      q={q || undefined}
      intro="Guía del panel de administración de la plataforma: empresas, planes, pagos, integraciones y catálogos."
      canOpen={() => true}
    />
  );
}
