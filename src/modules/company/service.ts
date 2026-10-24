import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { schema, withTenant, type Tx } from "@/core/db";
import { checkBrand } from "@/core/branding/contrast";
import { getActiveItems, getParameter } from "@/modules/platform/catalogs/service";
import {
  classifyStandards,
  companyDataSchema,
  effectiveRiskClass,
  evaluateResponsible,
  responsibleSchema,
  workCenterSchema,
  type CompanyDataInput,
  type ResponsibleInput,
  type SizeRiskRule,
} from "./rules";
import { todayYmd } from "@/lib/dates";

const { tenant, workCenter, sstResponsible, tenantAlert, tenantBranding } = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
const today = () => todayYmd();

export class CompanyError extends Error {}

async function sizeRules(): Promise<SizeRiskRule[]> {
  const active = await getActiveItems<SizeRiskRule>("size_risk_groups");
  return (active?.items ?? []).map(({ group, priority, minWorkers, maxWorkers, riskClasses }) => ({
    group,
    priority,
    minWorkers,
    maxWorkers,
    riskClasses,
  }));
}

/**
 * Recalcula el grupo de estándares con los datos actuales; si cambia respecto al guardado, deja un aviso visible
 * hasta que alguien lo resuelva (spec 6.0: "recalcula y alerta si estos datos cambian").
 */
async function reclassify(tx: Tx, tenantId: string, rules: SizeRiskRule[]) {
  const [t] = await tx.select().from(tenant).where(eq(tenant.id, tenantId));
  const centers = await tx
    .select({ riskClass: workCenter.riskClass })
    .from(workCenter)
    .where(and(eq(workCenter.tenantId, tenantId), isNull(workCenter.deletedAt)));
  const risk = effectiveRiskClass(
    t.riskClass,
    centers.map((c) => c.riskClass),
  );
  const group =
    t.workersCount && risk
      ? classifyStandards({ workers: t.workersCount, riskClass: risk }, rules)
      : null;
  if (group === t.standardsGroup) return group;
  await tx
    .update(tenant)
    .set({ standardsGroup: group, updatedAt: new Date() })
    .where(eq(tenant.id, tenantId));
  if (t.standardsGroup !== null && group !== null)
    await tx.insert(tenantAlert).values({
      tenantId,
      kind: "standards_group_changed",
      message: `Por el número de trabajadores o la clase de riesgo, ahora te aplican ${group} estándares mínimos (antes ${t.standardsGroup}). Revisa tu autoevaluación.`,
      data: { from: t.standardsGroup, to: group },
    });
  return group;
}

export async function saveCompanyData(tenantId: string, userId: string, input: CompanyDataInput) {
  const data = companyDataSchema.parse(input);
  const rules = await sizeRules();
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    await tx
      .update(tenant)
      .set({
        nit: data.nit,
        nitDv: data.nitDv,
        legalName: data.legalName,
        tradeName: data.tradeName,
        ciiu: data.ciiu,
        riskClass: data.riskClass,
        arl: data.arl,
        legalRepresentative: data.legalRepresentative,
        workersCount: data.workersCount,
        updatedAt: new Date(),
      })
      .where(eq(tenant.id, tenantId));
    return reclassify(tx, tenantId, rules);
  });
}

export async function listWorkCenters(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(workCenter)
      .where(and(eq(workCenter.tenantId, tenantId), isNull(workCenter.deletedAt)))
      .orderBy(asc(workCenter.name)),
  );
}

export async function saveWorkCenter(
  tenantId: string,
  userId: string,
  input: z_WorkCenterInput,
  id?: string,
) {
  const data = workCenterSchema.parse(input);
  const rules = await sizeRules();
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const values = {
      name: data.name,
      address: data.address,
      daneCityCode: data.daneCityCode ?? null,
      riskClass: data.riskClass ?? null,
      workersCount: data.workersCount,
      updatedAt: new Date(),
    };
    if (id) {
      const r = await tx
        .update(workCenter)
        .set(values)
        .where(
          and(
            eq(workCenter.id, id),
            eq(workCenter.tenantId, tenantId),
            isNull(workCenter.deletedAt),
          ),
        )
        .returning({ id: workCenter.id });
      if (!r.length) throw new CompanyError("Sede no encontrada");
    } else await tx.insert(workCenter).values({ tenantId, ...values });
    await reclassify(tx, tenantId, rules);
  });
}
type z_WorkCenterInput = Parameters<typeof workCenterSchema.parse>[0];

/** Borrado lógico de la sede (nunca físico). */
export async function removeWorkCenter(tenantId: string, userId: string, id: string) {
  const rules = await sizeRules();
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    await tx
      .update(workCenter)
      .set({ deletedAt: new Date() })
      .where(and(eq(workCenter.id, id), eq(workCenter.tenantId, tenantId)));
    await reclassify(tx, tenantId, rules);
  });
}

/** Reemplaza al responsable vigente; el anterior queda en el histórico (inactivo). */
export async function saveResponsible(tenantId: string, userId: string, input: ResponsibleInput) {
  const d = responsibleSchema.parse(input);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    await tx
      .update(sstResponsible)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(sstResponsible.tenantId, tenantId), eq(sstResponsible.active, true)));
    await tx.insert(sstResponsible).values({
      tenantId,
      fullName: d.fullName,
      idType: d.idType,
      idNumber: d.idNumber,
      email: d.email,
      phone: d.phone,
      profile: d.profile,
      licenseNumber: d.licenseNumber,
      licenseIssuer: d.licenseIssuer,
      licenseValidUntil: d.licenseValidUntil ?? null,
      course50hDate: d.course50hDate ?? null,
      course50hEntity: d.course50hEntity,
      refresher20hDate: d.refresher20hDate ?? null,
    });
  });
}

/** Colores de marca con verificación de contraste AA; los que no pasan se rechazan con el detalle. */
export async function saveBrandColors(
  tenantId: string,
  userId: string,
  brand: { primary: string; secondary: string; accent: string },
) {
  const hex = /^#[0-9a-fA-F]{6}$/;
  if (![brand.primary, brand.secondary, brand.accent].every((c) => hex.test(c)))
    throw new CompanyError("Los colores deben ser hexadecimales (#RRGGBB)");
  const report = checkBrand(brand);
  const failing = report.filter((r) => !r.passesAA);
  if (failing.length)
    throw new CompanyError(
      `Contraste insuficiente (WCAG AA): ${failing.map((f) => f.label).join(", ")}`,
    );
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(tenantBranding)
      .set({ ...brand, updatedAt: new Date() })
      .where(eq(tenantBranding.tenantId, tenantId)),
  );
}

export async function resolveAlert(tenantId: string, userId: string, id: string) {
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(tenantAlert)
      .set({ resolvedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tenantAlert.id, id), eq(tenantAlert.tenantId, tenantId))),
  );
}

export async function openAlerts(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(tenantAlert)
      .where(and(eq(tenantAlert.tenantId, tenantId), isNull(tenantAlert.resolvedAt)))
      .orderBy(desc(tenantAlert.createdAt)),
  );
}

/** Estado completo del onboarding: datos, sedes, responsable, clasificación y pasos pendientes. */
export async function getOnboardingState(tenantId: string) {
  const [params, snapshot] = await Promise.all([
    Promise.all([
      getParameter("responsable.actualizacion_anios", 3),
      getParameter("responsable.alerta_dias", 90),
    ]),
    withTenant(ctxOf(tenantId), async (tx) => {
      const [t] = await tx.select().from(tenant).where(eq(tenant.id, tenantId));
      const [resp] = await tx
        .select()
        .from(sstResponsible)
        .where(and(eq(sstResponsible.tenantId, tenantId), eq(sstResponsible.active, true)));
      const [brand] = await tx
        .select()
        .from(tenantBranding)
        .where(eq(tenantBranding.tenantId, tenantId));
      return { t, resp: resp ?? null, brand: brand ?? null };
    }),
  ]);
  const centers = await listWorkCenters(tenantId);
  const { t, resp, brand } = snapshot;
  const responsibleStatus = resp
    ? evaluateResponsible(resp, today(), { refresherYears: params[0], warnDays: params[1] })
    : null;
  const dataDone = Boolean(
    t.nit && t.ciiu && t.riskClass && t.arl && t.legalRepresentative && t.workersCount,
  );
  const steps = {
    company: dataDone,
    classification: t.standardsGroup !== null,
    centers: centers.length > 0,
    responsible: Boolean(resp),
    brand: Boolean(brand),
  };
  return {
    tenant: t,
    centers,
    responsible: resp,
    responsibleStatus,
    brand,
    steps,
    effectiveRisk: effectiveRiskClass(
      t.riskClass,
      centers.map((c) => c.riskClass),
    ),
    canComplete: dataDone && steps.classification && steps.centers && steps.responsible,
  };
}

export async function completeOnboarding(tenantId: string, userId: string) {
  const state = await getOnboardingState(tenantId);
  if (!state.canComplete)
    throw new CompanyError(
      "Completa los datos de la empresa, al menos una sede y el responsable del SG-SST",
    );
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx.update(tenant).set({ onboardingCompletedAt: new Date() }).where(eq(tenant.id, tenantId)),
  );
}
