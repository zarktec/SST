import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedHolidays } from "@/core/calendar/service";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import {
  PrivacyError,
  acceptConsent,
  consentStatus,
  createRequest,
  listRequests,
  resolveRequest,
} from "./service";
import { todayYmd } from "@/lib/dates";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`pr-${++n}`).then((t) => t.id);
const user = { id: "u1", name: "Ana Pérez", email: "ana@demo.test" };
const year = new Date().getUTCFullYear();

describe.skipIf(!hasTestDb)("protección de datos (Ley 1581)", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
    await seedHolidays([year, year + 1]);
  });

  it("la autorización general es obligatoria; la de datos sensibles es opcional y separada", async () => {
    const t = await mk();
    expect(await consentStatus(t, "u1")).toMatchObject({ accepted: false, sensitive: false });
    await expect(acceptConsent(t, "u1", { sensitive: "on" })).rejects.toBeInstanceOf(PrivacyError);
    await acceptConsent(t, "u1", { general: "on" }, { ip: "10.0.0.1" });
    expect(await consentStatus(t, "u1")).toMatchObject({ accepted: true, sensitive: false });
    await acceptConsent(t, "u1", { general: "on", sensitive: "on" });
    expect(await consentStatus(t, "u1")).toMatchObject({ accepted: true, sensitive: true });
    expect((await consentStatus(t, "u2")).accepted).toBe(false);
  });

  it("solicitudes del titular: plazo en días hábiles, respuesta única y visibilidad propia", async () => {
    const t = await mk();
    const q = await createRequest(t, user, {
      type: "query",
      detail: "Quiero conocer qué datos míos tienen registrados",
    });
    const r = await createRequest(t, user, {
      type: "rectification",
      detail: "Mi cargo actual es Supervisor de bodega",
    });
    expect(q.dueOn > todayYmd()).toBe(true);
    expect(r.dueOn >= q.dueOn).toBe(true); // el reclamo tiene más plazo que la consulta
    await createRequest(
      t,
      { ...user, id: "u2", email: "luis@demo.test" },
      { type: "deletion", detail: "Solicito suprimir mis datos de contacto" },
    );
    expect(await listRequests(t, { userId: "u1" })).toHaveLength(2);
    expect(await listRequests(t)).toHaveLength(3);
    await expect(
      resolveRequest(t, "admin", q.id, { decision: "resolved", resolution: "corta" }),
    ).rejects.toThrow();
    await resolveRequest(t, "admin", q.id, {
      decision: "resolved",
      resolution: "Se envió la copia de tus datos a tu correo.",
    });
    await expect(
      resolveRequest(t, "admin", q.id, {
        decision: "rejected",
        resolution: "Respuesta duplicada del titular",
      }),
    ).rejects.toBeInstanceOf(PrivacyError);
    expect((await listRequests(t, { userId: "u1" })).find((x) => x.id === q.id)).toMatchObject({
      status: "resolved",
      resolvedBy: "admin",
    });
    await expect(createRequest(t, user, { type: "query", detail: "corto" })).rejects.toThrow();
  });
});
