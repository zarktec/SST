import { eq } from "drizzle-orm";
import { schema, systemDb, withPlatform } from "@/core/db";
import { createTenantWithSubscription } from "@/core/db/test-utils";
import type {
  ChargeInput,
  PaymentProvider,
  PaymentStatus,
  ProviderTransaction,
} from "@/integrations/payments/types";
import { createPlan } from "@/modules/platform/plans/service";

export const d = (s: string) => new Date(s);

export class FakeProvider implements PaymentProvider {
  readonly name = "fake";
  calls: ChargeInput[] = [];
  constructor(public script: (PaymentStatus | "throw")[] = []) {}
  async getAcceptanceTokens() {
    return {
      acceptanceToken: "a",
      acceptanceUrl: "u",
      personalAuthToken: "b",
      personalAuthUrl: "v",
    };
  }
  async createPaymentSource(): Promise<never> {
    throw new Error("no usado");
  }
  async getTransaction(): Promise<never> {
    throw new Error("no usado");
  }
  async verifyEvent() {
    return null;
  }
  async charge(input: ChargeInput): Promise<ProviderTransaction> {
    this.calls.push(input);
    const next = this.script.shift() ?? "approved";
    if (next === "throw") throw new Error("timeout");
    return {
      providerTxId: `tx-${this.calls.length}-${input.reference}`,
      reference: input.reference,
      status: next,
      amountCents: input.amountCents,
      message: next === "declined" ? "Fondos insuficientes" : undefined,
    };
  }
}

let n = 0;
export const lastSetupIndex = () => n;
export async function setup(
  opts: { backup?: boolean; defaultSource?: boolean; plan?: boolean; coupon?: boolean } = {},
) {
  n++;
  const t = await createTenantWithSubscription(`cobro-${n}`);
  const planId = await createPlan({
    key: `pro-${n}`,
    name: "Pro",
    description: "",
    isTrial: false,
    trialDays: null,
    vatEnabled: true,
    vatIncluded: false,
    vatRatePercent: 19,
    limits: { workers: null, users: null, centers: null, storageMb: null },
    modules: [],
    visible: true,
    sortOrder: 1,
    active: true,
    monthlyPesos: 200_000,
    annualPesos: null,
    monthlySiigoCode: null,
    annualSiigoCode: null,
  });
  const mk = async (id: string, last4: string) =>
    (
      await withPlatform({ actorId: "t", action: "t", tenantId: t.id, audit: false }, (tx) =>
        tx
          .insert(schema.paymentSource)
          .values({ tenantId: t.id, providerSourceId: id, type: "CARD", brand: "VISA", last4 })
          .returning(),
      )
    )[0];
  if (opts.plan === false) {
    // Una suscripción en prueba sin plan de pago elegido está sobre el plan de prueba gratuita.
    const { getTrialPlan } = await import("@/modules/platform/plans/service");
    const trialId =
      (await getTrialPlan())?.id ??
      (await createPlan({
        key: "trial-x",
        name: "Trial",
        description: "",
        isTrial: true,
        trialDays: 30,
        vatEnabled: false,
        vatIncluded: false,
        vatRatePercent: 0,
        limits: { workers: null, users: null, centers: null, storageMb: null },
        modules: [],
        visible: false,
        sortOrder: 0,
        active: true,
        monthlyPesos: null,
        annualPesos: null,
        monthlySiigoCode: null,
        annualSiigoCode: null,
      }));
    await systemDb()
      .update(schema.subscription)
      .set({ planId: trialId })
      .where(eq(schema.subscription.tenantId, t.id));
  }
  const def = opts.defaultSource === false ? null : await mk(`ps-${n}-1`, "4242");
  const bak = opts.backup ? await mk(`ps-${n}-2`, "1111") : null;
  await withPlatform({ actorId: "t", action: "t", tenantId: t.id, audit: false }, (tx) =>
    tx
      .update(schema.subscription)
      .set({
        trialEndsAt: d("2026-12-01T05:00:00Z"),
        scheduledPlanId: opts.plan === false ? null : planId,
        scheduledPeriod: opts.plan === false ? null : "monthly",
        defaultPaymentSourceId: def?.id ?? null,
        backupPaymentSourceId: bak?.id ?? null,
        ...(opts.coupon ? { couponKind: "percent" as const, couponValue: 1000n } : {}),
      })
      .where(eq(schema.subscription.tenantId, t.id)),
  );
  if (opts.coupon) {
    const [c] = await systemDb()
      .insert(schema.coupon)
      .values({ code: `C${n}`, kind: "percent", value: 1000n })
      .returning();
    await withPlatform({ actorId: "t", action: "t", tenantId: t.id, audit: false }, (tx) =>
      tx
        .update(schema.subscription)
        .set({ couponId: c.id })
        .where(eq(schema.subscription.tenantId, t.id)),
    );
  }
  return { t, planId, def, bak };
}
export const sub = async (tenantId: string) =>
  (
    await systemDb()
      .select()
      .from(schema.subscription)
      .where(eq(schema.subscription.tenantId, tenantId))
  )[0];
export const pays = async (tenantId: string) =>
  await systemDb()
    .select()
    .from(schema.payment)
    .where(eq(schema.payment.tenantId, tenantId))
    .orderBy(schema.payment.attempt);
