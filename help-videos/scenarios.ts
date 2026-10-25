import { ACCOUNT } from "./scenarios/account";
import { HEALTH_IMPROVE } from "./scenarios/health-improve";
import { PLATFORM } from "./scenarios/platform";
import { PLAN_PEOPLE } from "./scenarios/plan-people";
import { RISK_SYSTEMS } from "./scenarios/risk-systems";
import { START } from "./scenarios/start";
import type { Scenario } from "./types";

export const SCENARIOS: Scenario[] = [
  ...START,
  ...ACCOUNT,
  ...PLAN_PEOPLE,
  ...HEALTH_IMPROVE,
  ...RISK_SYSTEMS,
  ...PLATFORM,
];
