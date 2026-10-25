import type { Page } from "@playwright/test";
import type { Rec } from "./lib";

export type Scenario = {
  /** Coincide con el `slug` de la guía de ayuda a la que pertenece el video. */
  slug: string;
  title: string;
  /** Quién inicia sesión antes de grabar: la empresa demo, el panel de administración o nadie (el video muestra el ingreso). */
  as: "tenant" | "admin" | "anon";
  /** Carga el catálogo mínimo de estándares (autoevaluación). */
  catalog?: boolean;
  /** Clasificación de la empresa demo ya definida (trabajadores, grupo de estándares, clase de riesgo). */
  onboarded?: boolean;
  /** Prepara datos sin grabar. */
  setup?: (page: Page) => Promise<void>;
  run: (r: Rec) => Promise<void>;
};

export const TENANT = "http://localhost:3000/demo";
export const ADMIN = "http://admin.localhost:3000";
