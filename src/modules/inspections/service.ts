import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { bogotaDate } from "@/core/calendar/business-days";
import { assertWritable } from "@/core/plans/limits";
import { addDays } from "@/lib/dates";
import { createAction } from "@/modules/capa/service";
import { getActiveItems, getParameter } from "@/modules/platform/catalogs/service";
import {
  parseItems,
  submissionErrors,
  submissionSchema,
  summarize,
  templateSchema,
  type Submission,
  type TemplateInput,
} from "./rules";

const { inspection, inspectionTemplate } = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });

export class InspectionError extends Error {}

export async function saveTemplate(
  tenantId: string,
  userId: string,
  input: TemplateInput,
  id?: string,
) {
  const d = templateSchema.parse(input);
  await assertWritable(tenantId);
  const items = parseItems(d.itemsText);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    if (id) {
      const r = await tx
        .update(inspectionTemplate)
        .set({ name: d.name, category: d.category, items, updatedAt: new Date() })
        .where(and(eq(inspectionTemplate.id, id), eq(inspectionTemplate.tenantId, tenantId)))
        .returning({ id: inspectionTemplate.id });
      if (!r.length) throw new InspectionError("Plantilla no encontrada");
      return id;
    }
    const [t] = await tx
      .insert(inspectionTemplate)
      .values({ tenantId, name: d.name, category: d.category, items })
      .returning({ id: inspectionTemplate.id });
    return t.id;
  });
}

export async function setTemplateActive(tenantId: string, id: string, active: boolean) {
  await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .update(inspectionTemplate)
      .set({ active, updatedAt: new Date() })
      .where(and(eq(inspectionTemplate.id, id), eq(inspectionTemplate.tenantId, tenantId))),
  );
}

export async function listTemplates(tenantId: string, opts: { activeOnly?: boolean } = {}) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(inspectionTemplate)
      .where(
        opts.activeOnly
          ? and(eq(inspectionTemplate.tenantId, tenantId), eq(inspectionTemplate.active, true))
          : eq(inspectionTemplate.tenantId, tenantId),
      )
      .orderBy(asc(inspectionTemplate.name)),
  );
}

export async function getTemplate(tenantId: string, id: string) {
  const [t] = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(inspectionTemplate)
      .where(and(eq(inspectionTemplate.id, id), eq(inspectionTemplate.tenantId, tenantId))),
  );
  return t ?? null;
}

type CatalogTemplate = {
  name: string;
  category: string;
  items: { id: string; text: string; required: boolean }[];
};
/** Plantillas de la plataforma (catálogo `checklist_templates`) que la empresa aún no importó. */
export async function availableCatalogTemplates(tenantId: string) {
  const active = await getActiveItems<CatalogTemplate>("checklist_templates");
  const mine = await listTemplates(tenantId);
  const taken = new Set(mine.map((m) => m.catalogCode).filter(Boolean));
  return (active?.items ?? []).filter((i) => !taken.has(i.code));
}

export async function importCatalogTemplate(tenantId: string, userId: string, code: string) {
  await assertWritable(tenantId);
  const active = await getActiveItems<CatalogTemplate>("checklist_templates");
  const c = active?.items.find((i) => i.code === code);
  if (!c) throw new InspectionError("Plantilla no encontrada en el catálogo");
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [dup] = await tx
      .select({ id: inspectionTemplate.id })
      .from(inspectionTemplate)
      .where(
        and(eq(inspectionTemplate.tenantId, tenantId), eq(inspectionTemplate.catalogCode, code)),
      );
    if (dup) return dup.id;
    const [t] = await tx
      .insert(inspectionTemplate)
      .values({
        tenantId,
        name: c.name,
        category: c.category,
        items: c.items,
        catalogCode: code,
      })
      .returning({ id: inspectionTemplate.id });
    return t.id;
  });
}

/**
 * Registra una inspección (desde la web o desde la cola sin conexión). Es idempotente por `offlineId`: reenviarla no la duplica
 * ni repite las acciones. Cada ítem "no cumple" crea una acción correctiva en el módulo CAPA, con plazo parametrizable.
 */
export async function submitInspection(
  tenantId: string,
  userId: string,
  inspectorName: string,
  input: Submission,
) {
  const d = submissionSchema.parse(input);
  await assertWritable(tenantId);
  const performedAt = new Date(d.performedAt);
  if (performedAt.getTime() > Date.now() + 3_600_000)
    throw new InspectionError("La fecha de la inspección no puede ser futura");
  const t = await getTemplate(tenantId, d.templateId);
  if (!t) throw new InspectionError("Plantilla no encontrada");
  const errors = submissionErrors(t.items, d.results);
  if (errors.length) throw new InspectionError(errors.join(". "));
  const byId = new Map(t.items.map((i) => [i.id, i]));
  const results = d.results.map((r) => ({
    itemId: r.itemId,
    text: byId.get(r.itemId)!.text,
    result: r.result,
    note: r.note?.trim() || null,
  }));
  const sum = summarize(results);
  const { id, created } = await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [dup] = await tx
      .select({ id: inspection.id })
      .from(inspection)
      .where(and(eq(inspection.tenantId, tenantId), eq(inspection.offlineId, d.offlineId)));
    if (dup) return { id: dup.id, created: false };
    // Dos reenvíos simultáneos del mismo offlineId: gana uno y el otro lee el existente (sin error de unicidad).
    const [r] = await tx
      .insert(inspection)
      .values({
        tenantId,
        offlineId: d.offlineId,
        templateId: t.id,
        templateName: t.name,
        category: t.category,
        place: d.place,
        workCenterId: d.workCenterId ?? null,
        inspectorName,
        inspectorId: userId,
        performedAt,
        results,
        okCount: sum.ok,
        failCount: sum.fail,
        notes: d.notes?.trim() || null,
      })
      .onConflictDoNothing({ target: [inspection.tenantId, inspection.offlineId] })
      .returning({ id: inspection.id });
    if (!r) {
      const [again] = await tx
        .select({ id: inspection.id })
        .from(inspection)
        .where(and(eq(inspection.tenantId, tenantId), eq(inspection.offlineId, d.offlineId)));
      return { id: again.id, created: false };
    }
    return { id: r.id, created: true };
  });
  // Los hallazgos van a CAPA; createAction es idempotente por (origen, ítem), así que un reintento no duplica.
  const days = await getParameter("inspecciones.plazo_accion_dias", 15);
  const due = addDays(bogotaDate(performedAt), days);
  for (const r of results.filter((x) => x.result === "fail"))
    await createAction(
      tenantId,
      userId,
      {
        type: "corrective",
        title: `Corregir hallazgo: ${r.text}`.slice(0, 200),
        description: `${t.name} en ${d.place}. ${r.note ?? ""}`.trim(),
        responsibleName: d.responsibleName?.trim() || inspectorName,
        dueDate: due,
      },
      { source: "inspection", sourceId: `${id}:${r.itemId}` },
    );
  return { id, created, failCount: sum.fail };
}

export async function listInspections(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(inspection)
      .where(eq(inspection.tenantId, tenantId))
      .orderBy(desc(inspection.performedAt)),
  );
}

export async function getInspection(tenantId: string, id: string) {
  const [i] = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(inspection)
      .where(and(eq(inspection.id, id), eq(inspection.tenantId, tenantId))),
  );
  if (!i) return null;
  const actions = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(schema.correctiveAction)
      .where(
        and(
          eq(schema.correctiveAction.tenantId, tenantId),
          eq(schema.correctiveAction.source, "inspection"),
        ),
      ),
  );
  return { inspection: i, actions: actions.filter((a) => a.sourceId?.startsWith(`${id}:`)) };
}
