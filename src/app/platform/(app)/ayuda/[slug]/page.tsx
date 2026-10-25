import { notFound } from "next/navigation";
import { HelpArticle } from "@/components/help/help-pages";
import { PLATFORM_ARTICLES, PLATFORM_GROUPS } from "@/modules/help/content";

export async function generateMetadata({ params }: PageProps<"/platform/ayuda/[slug]">) {
  const { slug } = await params;
  return { title: PLATFORM_ARTICLES.find((a) => a.slug === slug)?.title ?? "Ayuda" };
}

export default async function PlatformHelpArticle({ params }: PageProps<"/platform/ayuda/[slug]">) {
  const { slug } = await params;
  const article = PLATFORM_ARTICLES.find((a) => a.slug === slug);
  if (!article) notFound();
  const ordered = PLATFORM_GROUPS.flatMap((g) => PLATFORM_ARTICLES.filter((a) => a.group === g));
  return <HelpArticle article={article} all={ordered} canOpen />;
}
