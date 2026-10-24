import "server-only";
import { randomBytes } from "node:crypto";
import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { schema, systemDb, withPlatform } from "@/core/db";
import { sendMail } from "@/core/mail";
import { seedTenantRoles } from "@/core/rbac/seed-roles";
import { isValidSlug, normalizeHost, originFor, rootDomain } from "@/core/tenancy/hosts";
import { invalidateTenantHostCache } from "@/core/tenancy/resolve";
import {
  domainProvider,
  type DomainProvider,
  type DomainState,
} from "@/integrations/vercel-domains";
import { createTrialSubscription } from "@/modules/billing/subscriptions";
import { priceBreakdown } from "../plans/rules";
import { getPlan, getTrialPlan, vatOf } from "../plans/service";

const { tenant, tenantDomain, tenantBranding, role, invitation, membership, subscription, plan } =
  schema;

export const createTenantSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      isValidSlug,
      "Identificador inválido (3-63 caracteres: letras, números y guion; no puede ser una palabra reservada)",
    ),
  legalName: z.string().trim().min(2).max(160),
  tradeName: z.string().trim().min(2).max(80),
  nit: z
    .string()
    .trim()
    .regex(/^\d{5,12}$/, "NIT sin dígito de verificación ni puntos")
    .optional(),
  /** Persona que administrará la empresa: ya existe (registro) o se invita por correo. */
  owner: z.union([
    z.object({ userId: z.string().min(1) }),
    z.object({ email: z.email().transform((e) => e.toLowerCase()) }),
  ]),
  /** Plan inicial: por defecto el plan de prueba gratuita. */
  planId: z.uuid().optional(),
});
export type CreateTenantInput = z.input<typeof createTenantSchema>;

export class TenantError extends Error {
  constructor(
    public code: "slug_taken" | "no_trial_plan" | "plan_not_found",
    message: string,
  ) {
    super(message);
  }
}

const domainStatus = (s: DomainState) =>
  s.error
    ? ("error" as const)
    : s.verified && s.configured
      ? ("verified" as const)
      : ("pending" as const);

export async function isSlugAvailable(slug: string): Promise<boolean> {
  if (!isValidSlug(slug)) return false;
  const [t] = await systemDb().select({ id: tenant.id }).from(tenant).where(eq(tenant.slug, slug));
  return !t;
}

/**
 * Crea una empresa con su suscripción de prueba (o el plan indicado): roles, marca y administrador
 * (membresía o invitación). La empresa vive en `{dominio raíz}/{slug}`; el dominio propio se conecta después
 * (`requestCustomDomain`).
 */
export async function createTenantWithTrial(
  input: CreateTenantInput,
  actorId: string,
  opts: { now?: Date } = {},
) {
  const data = createTenantSchema.parse(input);
  const now = opts.now ?? new Date();
  const p = data.planId ? await getPlan(data.planId) : await getTrialPlan();
  if (!p)
    throw new TenantError(
      data.planId ? "plan_not_found" : "no_trial_plan",
      data.planId ? "Plan no encontrado" : "No hay un plan de prueba gratuita configurado",
    );

  const created = await withPlatform(
    { actorId, action: "tenant.create", reason: data.slug },
    async (tx) => {
      const exists = await tx
        .select({ id: tenant.id })
        .from(tenant)
        .where(eq(tenant.slug, data.slug));
      if (exists.length) throw new TenantError("slug_taken", "Ese identificador ya está en uso");
      const [t] = await tx
        .insert(tenant)
        .values({
          slug: data.slug,
          legalName: data.legalName,
          tradeName: data.tradeName,
          nit: data.nit ?? null,
        })
        .returning();
      await seedTenantRoles(tx, t.id);
      await tx.insert(tenantBranding).values({ tenantId: t.id });

      const price = p.isTrial
        ? null
        : p.prices.monthly?.active
          ? p.prices.monthly
          : p.prices.annual;
      await createTrialSubscription(
        tx,
        t.id,
        {
          planId: p.id,
          period: price?.period ?? null,
          amountCents: price?.amountCents ?? null,
          vat: { enabled: p.vatEnabled, included: p.vatIncluded, rateBp: p.vatRateBp },
          trialDays: p.trialDays ?? 0,
        },
        now,
      );

      const [adminRole] = await tx
        .select()
        .from(role)
        .where(and(eq(role.tenantId, t.id), eq(role.systemKey, "ADMIN_EMPRESA")));
      if ("userId" in data.owner) {
        await tx.insert(membership).values({
          tenantId: t.id,
          userId: data.owner.userId,
          roleId: adminRole.id,
          status: "active",
        });
      } else {
        await tx.insert(invitation).values({
          tenantId: t.id,
          email: data.owner.email,
          roleId: adminRole.id,
          tokenHash: randomBytes(16).toString("hex"),
          invitedBy: null,
          expiresAt: new Date(now.getTime() + 14 * 86_400_000),
        });
      }
      return t;
    },
  );

  const url = `${originFor(rootDomain())}/${data.slug}`;
  invalidateTenantHostCache();

  // Fuera de la transacción: el correo. Un fallo aquí no deshace la empresa.
  if ("email" in data.owner) {
    await sendMail({
      to: data.owner.email,
      subject: `Te invitaron a administrar ${data.tradeName} en SST`,
      html: `<p>Hola,</p><p>Te invitaron a administrar <strong>${data.tradeName}</strong>. Ingresa en <a href="${url}/login">${url}/login</a> con este correo (te enviaremos un enlace de acceso).</p>`,
    }).catch(() => undefined);
  }
  return { tenantId: created.id, slug: data.slug, url };
}

export type TenantListRow = {
  id: string;
  slug: string;
  tradeName: string;
  legalName: string;
  status: (typeof tenant.$inferSelect)["status"];
  planName: string | null;
  planKey: string | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  users: number;
  createdAt: Date;
};

export async function listTenants(
  opts: {
    search?: string;
    status?: string;
    planId?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const pageSize = Math.min(opts.pageSize ?? 20, 100);
  const page = Math.max(opts.page ?? 1, 1);
  return withPlatform({ actorId: "platform", action: "tenant.list", audit: false }, async (tx) => {
    const where = and(
      isNull(tenant.deletedAt),
      opts.status
        ? eq(tenant.status, opts.status as (typeof tenant.$inferSelect)["status"])
        : undefined,
      opts.planId ? eq(subscription.planId, opts.planId) : undefined,
      opts.search
        ? or(
            ilike(tenant.tradeName, `%${opts.search}%`),
            ilike(tenant.legalName, `%${opts.search}%`),
            ilike(tenant.slug, `%${opts.search}%`),
            ilike(tenant.nit, `%${opts.search}%`),
          )
        : undefined,
    );
    const base = tx
      .select({ n: count() })
      .from(tenant)
      .leftJoin(subscription, eq(subscription.tenantId, tenant.id))
      .where(where);
    const [{ n: total }] = await base;
    const rows = await tx
      .select({
        id: tenant.id,
        slug: tenant.slug,
        tradeName: tenant.tradeName,
        legalName: tenant.legalName,
        status: tenant.status,
        createdAt: tenant.createdAt,
        planName: plan.name,
        planKey: plan.key,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        users: sql<number>`(SELECT count(*)::int FROM membership m WHERE m.tenant_id = ${tenant.id} AND m.status = 'active')`,
      })
      .from(tenant)
      .leftJoin(subscription, eq(subscription.tenantId, tenant.id))
      .leftJoin(plan, eq(plan.id, subscription.planId))
      .where(where)
      .orderBy(desc(tenant.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return { rows: rows as TenantListRow[], total, page, pageSize };
  });
}

export async function getTenantDetail(id: string) {
  return withPlatform(
    { actorId: "platform", action: "tenant.detail", tenantId: id, audit: false },
    async (tx) => {
      const [t] = await tx.select().from(tenant).where(eq(tenant.id, id));
      if (!t) return null;
      const [sub] = await tx.select().from(subscription).where(eq(subscription.tenantId, id));
      const [pl] = sub ? await tx.select().from(plan).where(eq(plan.id, sub.planId)) : [];
      const domains = await tx.select().from(tenantDomain).where(eq(tenantDomain.tenantId, id));
      const [{ n: users }] = await tx
        .select({ n: count() })
        .from(membership)
        .where(and(eq(membership.tenantId, id), eq(membership.status, "active")));
      const events = await tx
        .select()
        .from(schema.subscriptionEvent)
        .where(eq(schema.subscriptionEvent.tenantId, id))
        .orderBy(desc(schema.subscriptionEvent.at))
        .limit(15);
      const net =
        sub?.priceAmountCents != null ? priceBreakdown(sub.priceAmountCents, vatOf(sub)) : null;
      return {
        tenant: t,
        subscription: sub ?? null,
        plan: pl ?? null,
        domains,
        users,
        events,
        price: net,
      };
    },
  );
}

/** Valida un dominio propio: FQDN, fuera de la plataforma y sin dominios ya registrados. */
export function validateCustomHost(raw: string, root = rootDomain()): string {
  const host = normalizeHost(raw);
  if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host))
    throw new Error("Dominio inválido");
  const rootHost = root.split(":")[0];
  if (host === rootHost || host.endsWith(`.${rootHost}`))
    throw new Error("Los dominios de la plataforma no se pueden usar como dominio propio");
  return host;
}

/** La empresa conecta su dominio: se registra en Vercel y se muestran los registros DNS que debe crear. */
export async function requestCustomDomain(
  tenantId: string,
  rawHost: string,
  actorId: string,
  domains: DomainProvider = domainProvider(),
) {
  const host = validateCustomHost(rawHost);
  const taken = await systemDb()
    .select({ id: tenantDomain.id })
    .from(tenantDomain)
    .where(eq(tenantDomain.host, host));
  if (taken.length) throw new Error("Ese dominio ya está registrado");
  const state = await domains.add(host);
  await withPlatform({ actorId, action: "tenant.domain.request", tenantId, reason: host }, (tx) =>
    tx.insert(tenantDomain).values({
      tenantId,
      host,
      kind: "custom",
      status: domainStatus(state),
      dnsRecords: state.instructions,
      lastError: state.error ?? null,
      lastCheckedAt: new Date(),
    }),
  );
  invalidateTenantHostCache();
  return state;
}

/** Dominios de una empresa (para su pantalla de "Dominio propio"). */
export async function listTenantDomains(tenantId: string) {
  return systemDb()
    .select()
    .from(tenantDomain)
    .where(eq(tenantDomain.tenantId, tenantId))
    .orderBy(tenantDomain.createdAt);
}

/**
 * Verificación periódica: estados pendiente / verificado / error. Se usa en el cron (todas las empresas)
 * y a demanda (`tenantId`: solo los dominios de esa empresa).
 */
export async function syncDomains(
  domains: DomainProvider = domainProvider(),
  now = new Date(),
  tenantId?: string,
) {
  const pending = await systemDb()
    .select()
    .from(tenantDomain)
    .where(
      and(
        or(eq(tenantDomain.status, "pending"), eq(tenantDomain.status, "error")),
        tenantId ? eq(tenantDomain.tenantId, tenantId) : undefined,
      ),
    );
  let changed = 0;
  for (const d of pending) {
    const state = await domains.check(d.host).catch((e): DomainState => ({
      host: d.host,
      verified: false,
      configured: false,
      instructions: [],
      error: e instanceof Error ? e.message : "Error",
    }));
    const status = domainStatus(state);
    await systemDb()
      .update(tenantDomain)
      .set({
        status,
        lastError: state.error ?? null,
        lastCheckedAt: now,
        dnsRecords: state.instructions.length ? state.instructions : d.dnsRecords,
      })
      .where(eq(tenantDomain.id, d.id));
    if (status !== d.status) changed++;
  }
  if (changed) invalidateTenantHostCache();
  return { checked: pending.length, changed };
}
