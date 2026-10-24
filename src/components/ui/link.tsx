"use client";
import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useBasePath } from "@/components/layout/base-path";
import { withBase } from "@/core/tenancy/hosts";

/** `next/link` que antepone la ruta base de la empresa a los destinos de la app (`/personas` → `/acme/personas`). */
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const base = useBasePath();
  return <NextLink href={typeof href === "string" ? withBase(base, href) : href} {...props} />;
}

/** `<a>` base-aware para descargas y rutas que no deben navegarse en cliente (CSV, PDF). */
export function A({ href, ...props }: ComponentProps<"a">) {
  const base = useBasePath();
  return <a href={href ? withBase(base, href) : href} {...props} />;
}
