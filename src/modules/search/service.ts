import "server-only";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";

const {
  worker,
  document,
  correctiveAction,
  incident,
  chemicalSubstance,
  pesvVehicle,
  emergencyAsset,
  unsafeReport,
} = schema;
type Perms = { module: string; action: string }[];
const canView = (p: Perms, m: string) => p.some((x) => x.module === m && x.action === "view");
export type SearchHit = { group: string; title: string; detail?: string; href: string };

/** Escapa los comodines de LIKE para que el texto buscado sea literal. */
export const likePattern = (q: string) => `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Búsqueda global por palabra clave (insensible a mayúsculas) en los módulos que el usuario puede ver, hasta 6 resultados por
 * grupo. No busca en datos de salud ni en quejas. La búsqueda por documento de identidad no está disponible (cifrado).
 */
export async function searchAll(tenantId: string, q: string, perms: Perms): Promise<SearchHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const like = likePattern(term);
  const hits: SearchHit[] = [];
  await withTenant({ tenantId }, async (tx) => {
    if (canView(perms, "workers")) {
      const rows = await tx
        .select({ id: worker.id, name: worker.fullName, position: worker.position })
        .from(worker)
        .where(
          and(
            eq(worker.tenantId, tenantId),
            isNull(worker.deletedAt),
            or(ilike(worker.fullName, like), ilike(worker.position, like)),
          ),
        )
        .limit(6);
      hits.push(
        ...rows.map((r) => ({
          group: "Personas",
          title: r.name,
          detail: r.position ?? undefined,
          href: `/personas/${r.id}`,
        })),
      );
    }
    if (canView(perms, "documents")) {
      const rows = await tx
        .select({ code: document.code, title: document.title })
        .from(document)
        .where(
          and(
            eq(document.tenantId, tenantId),
            or(ilike(document.title, like), ilike(document.code, like)),
          ),
        )
        .limit(6);
      hits.push(
        ...rows.map((r) => ({
          group: "Documentos",
          title: `${r.code} · ${r.title}`,
          href: "/documentos",
        })),
      );
    }
    if (canView(perms, "actions")) {
      const rows = await tx
        .select({
          id: correctiveAction.id,
          title: correctiveAction.title,
          status: correctiveAction.status,
        })
        .from(correctiveAction)
        .where(
          and(
            eq(correctiveAction.tenantId, tenantId),
            or(ilike(correctiveAction.title, like), ilike(correctiveAction.responsibleName, like)),
          ),
        )
        .orderBy(desc(correctiveAction.createdAt))
        .limit(6);
      hits.push(
        ...rows.map((r) => ({
          group: "Acciones",
          title: r.title,
          detail: r.status,
          href: `/acciones/${r.id}`,
        })),
      );
    }
    if (canView(perms, "incidents")) {
      const rows = await tx
        .select({
          id: incident.id,
          place: incident.place,
          description: incident.description,
          kind: incident.kind,
        })
        .from(incident)
        .where(
          and(
            eq(incident.tenantId, tenantId),
            or(
              ilike(incident.description, like),
              ilike(incident.place, like),
              ilike(incident.affectedName, like),
            ),
          ),
        )
        .orderBy(desc(incident.occurredAt))
        .limit(6);
      hits.push(
        ...rows.map((r) => ({
          group: "Accidentes e incidentes",
          title: `${r.kind === "accident" ? "Accidente" : "Incidente"} · ${r.place}`,
          detail: r.description.slice(0, 80),
          href: `/accidentes/${r.id}`,
        })),
      );
    }
    if (canView(perms, "unsafe_reports")) {
      const rows = await tx
        .select({ description: unsafeReport.description, place: unsafeReport.place })
        .from(unsafeReport)
        .where(
          and(
            eq(unsafeReport.tenantId, tenantId),
            or(ilike(unsafeReport.description, like), ilike(unsafeReport.place, like)),
          ),
        )
        .limit(6);
      hits.push(
        ...rows.map((r) => ({
          group: "Reportes de condiciones y actos",
          title: r.description.slice(0, 80),
          detail: r.place ?? undefined,
          href: "/reportes",
        })),
      );
    }
    if (canView(perms, "chemicals")) {
      const rows = await tx
        .select({ name: chemicalSubstance.name, location: chemicalSubstance.location })
        .from(chemicalSubstance)
        .where(
          and(
            eq(chemicalSubstance.tenantId, tenantId),
            eq(chemicalSubstance.active, true),
            or(ilike(chemicalSubstance.name, like), ilike(chemicalSubstance.casNumber, like)),
          ),
        )
        .limit(6);
      hits.push(
        ...rows.map((r) => ({
          group: "Sustancias químicas",
          title: r.name,
          detail: r.location,
          href: "/quimicos",
        })),
      );
    }
    if (canView(perms, "pesv")) {
      const rows = await tx
        .select({ plate: pesvVehicle.plate, description: pesvVehicle.description })
        .from(pesvVehicle)
        .where(
          and(
            eq(pesvVehicle.tenantId, tenantId),
            eq(pesvVehicle.active, true),
            or(ilike(pesvVehicle.plate, like), ilike(pesvVehicle.description, like)),
          ),
        )
        .limit(6);
      hits.push(
        ...rows.map((r) => ({
          group: "Vehículos",
          title: r.plate,
          detail: r.description ?? undefined,
          href: "/pesv",
        })),
      );
    }
    if (canView(perms, "emergencies")) {
      const rows = await tx
        .select({ code: emergencyAsset.code, location: emergencyAsset.location })
        .from(emergencyAsset)
        .where(
          and(
            eq(emergencyAsset.tenantId, tenantId),
            eq(emergencyAsset.active, true),
            or(ilike(emergencyAsset.code, like), ilike(emergencyAsset.location, like)),
          ),
        )
        .limit(6);
      hits.push(
        ...rows.map((r) => ({
          group: "Equipos de emergencia",
          title: r.code,
          detail: r.location,
          href: "/emergencias",
        })),
      );
    }
  });
  return hits;
}
