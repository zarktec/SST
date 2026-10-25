import type { Article } from "../types";
import { HEALTH_PREVENTION } from "./health-prevention";
import { IMPROVE } from "./improve";
import { PLAN_PEOPLE } from "./plan-people";
import { PLATFORM } from "./platform";
import { START } from "./start";

/** Orden de los grupos en el índice de la ayuda de las empresas. */
export const TENANT_GROUPS = [
  "Empezar",
  "Planear",
  "Personas",
  "Salud",
  "Prevención y respuesta",
  "Mejora y gestión",
  "Cuenta y datos",
  "Referencia",
];
export const PLATFORM_GROUPS = ["Empezar", "Administración"];

export const TENANT_ARTICLES: Article[] = [
  ...START,
  ...PLAN_PEOPLE,
  ...HEALTH_PREVENTION,
  ...IMPROVE,
];
export const PLATFORM_ARTICLES: Article[] = PLATFORM;
