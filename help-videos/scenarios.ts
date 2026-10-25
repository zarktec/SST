import { ACCOUNT } from "./scenarios/account";
import { PLAN_PEOPLE } from "./scenarios/plan-people";
import { START } from "./scenarios/start";
import type { Scenario } from "./types";

export const SCENARIOS: Scenario[] = [...START, ...ACCOUNT, ...PLAN_PEOPLE];
