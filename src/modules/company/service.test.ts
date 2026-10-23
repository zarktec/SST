import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import {
  completeOnboarding,
  getOnboardingState,
  openAlerts,
  removeWorkCenter,
  resolveAlert,
  saveBrandColors,
  saveCompanyData,
  saveResponsible,
  saveWorkCenter,
} from "./service";

pointToTestDb();

const company = {
  nit: "900123456",
  nitDv: "8",
  legalName: "ACME SAS",
  tradeName: "ACME",
  ciiu: "4711",
  riskClass: 1,
  arl: "Sura",
  legalRepresentative: "Ana Pérez",
  workersCount: 8,
};
const resp = {
  fullName: "Luis Gómez",
  idType: "13" as const,
  idNumber: "1032456789",
  email: "Luis@acme.co",
  profile: "profesional" as const,
  licenseNumber: "L-1",
  licenseValidUntil: "2030-01-01",
  course50hDate: "2025-06-01",
};
let n = 0;
const mk = async () => {
  const t = await createTenantWithSubscription(`onb-${++n}`);
  await withPlatform({ actorId: "t", action: "t", tenantId: t.id, audit: false }, (tx) =>
    tx.insert(schema.tenantBranding).values({ tenantId: t.id }).onConflictDoNothing(),
  );
  return t.id;
};

describe.skipIf(!hasTestDb)("onboarding de la empresa", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("clasifica por trabajadores y riesgo", async () => {
    const id = await mk();
    expect(await saveCompanyData(id, "u", company)).toBe(7);
    expect(await saveCompanyData(id, "u", { ...company, workersCount: 30 })).toBe(21);
    expect(await saveCompanyData(id, "u", { ...company, workersCount: 80 })).toBe(60);
  });

  it("al cambiar el grupo deja un aviso hasta resolverlo; la primera clasificación no avisa", async () => {
    const id = await mk();
    await saveCompanyData(id, "u", company);
    expect(await openAlerts(id)).toHaveLength(0);
    await saveCompanyData(id, "u", { ...company, workersCount: 25 });
    const [a] = await openAlerts(id);
    expect(a).toMatchObject({ kind: "standards_group_changed", data: { from: 7, to: 21 } });
    await resolveAlert(id, "u", a.id);
    expect(await openAlerts(id)).toHaveLength(0);
  });

  it("una sede de mayor riesgo reclasifica a 60 estándares; borrarla revierte", async () => {
    const id = await mk();
    await saveCompanyData(id, "u", company);
    await saveWorkCenter(id, "u", { name: "Planta", riskClass: 5, workersCount: 3 });
    expect((await getOnboardingState(id)).tenant.standardsGroup).toBe(60);
    const [c] = (await getOnboardingState(id)).centers;
    await removeWorkCenter(id, "u", c.id);
    const s = await getOnboardingState(id);
    expect(s.tenant.standardsGroup).toBe(7);
    expect(s.centers).toHaveLength(0);
  });

  it("no se completa sin datos, sede y responsable; luego sí", async () => {
    const id = await mk();
    await expect(completeOnboarding(id, "u")).rejects.toThrow(/Completa/);
    await saveCompanyData(id, "u", company);
    await saveWorkCenter(id, "u", { name: "Sede principal", workersCount: 8 });
    await saveResponsible(id, "u", resp);
    const s = await getOnboardingState(id);
    expect(s.responsibleStatus).toMatchObject({ ok: true });
    await completeOnboarding(id, "u");
    expect((await getOnboardingState(id)).tenant.onboardingCompletedAt).toBeTruthy();
  });

  it("el responsable anterior queda en histórico y solo hay uno activo", async () => {
    const id = await mk();
    await saveResponsible(id, "u", resp);
    await saveResponsible(id, "u", { ...resp, fullName: "Marta Ruiz", idNumber: "52123456" });
    const s = await getOnboardingState(id);
    expect(s.responsible?.fullName).toBe("Marta Ruiz");
    const all = await withPlatform(
      { actorId: "t", action: "t", tenantId: id, audit: false },
      (tx) => tx.select().from(schema.sstResponsible),
    );
    expect(all.filter((r) => r.tenantId === id)).toHaveLength(2);
  });

  it("colores de marca: rechaza contraste insuficiente y acepta los accesibles", async () => {
    const id = await mk();
    await expect(
      saveBrandColors(id, "u", { primary: "#ffff00", secondary: "#ffffff", accent: "#eeeeee" }),
    ).rejects.toThrow(/Contraste/);
    await saveBrandColors(id, "u", { primary: "#0f766e", secondary: "#1e293b", accent: "#b45309" });
  });
});
