"use client";
import { createContext, useCallback, useContext } from "react";
import { withBase } from "@/core/tenancy/hosts";

const BasePathContext = createContext("");

/** Ruta base de la empresa (`/acme` o ""): la provee el layout de la empresa. */
export function BasePathProvider({ base, children }: { base: string; children: React.ReactNode }) {
  return <BasePathContext.Provider value={base}>{children}</BasePathContext.Provider>;
}

export const useBasePath = () => useContext(BasePathContext);

/** `const tp = useTenantPath(); router.push(tp("/personas"))` */
export function useTenantPath() {
  const base = useBasePath();
  // Estable entre renders mientras no cambie la base: se puede usar en dependencias de efectos.
  return useCallback((path: string) => withBase(base, path), [base]);
}
