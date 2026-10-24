import Link from "@/components/ui/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { competenceMatrix, listCourses } from "@/modules/training/service";
import { RequirementButton } from "../forms";
import { AddRequirement } from "./add-requirement";

export const metadata = { title: "Matriz de competencias" };
const ST: Record<string, ["success" | "destructive" | "warning", string]> = {
  cumple: ["success", "Cumple"],
  vencido: ["destructive", "Vencido"],
  pendiente: ["warning", "Pendiente"],
};

export default async function MatrixPage() {
  const ctx = await requirePermission("training", "view");
  const [m, courses] = await Promise.all([
    competenceMatrix(ctx.tenant.tenantId),
    listCourses(ctx.tenant.tenantId),
  ]);
  const canEdit = can(ctx.permissions, "training", "edit");
  const positions = [...new Set(m.requirements.map((r) => r.position))].sort();
  const name = new Map(courses.map((c) => [c.id, c.name]));
  const bad = m.rows.flatMap((r) => r.items).filter((i) => i.state !== "cumple").length;
  return (
    <div className="space-y-4">
      <Link href="/capacitacion" className="text-primary text-sm underline">
        ← Capacitación
      </Link>
      <h1 className="text-2xl font-bold">Matriz de competencias</h1>
      <p className="text-muted-foreground text-sm">
        {bad} competencias pendientes o vencidas entre {m.rows.length} personas con requisitos.
      </p>
      <Card>
        <CardTitle>Cursos exigidos por cargo</CardTitle>
        {positions.length === 0 && (
          <p className="text-muted-foreground mt-2 text-sm">
            Aún no has definido requisitos. Escribe el cargo (igual que en la ficha de la persona) y
            elige el curso.
          </p>
        )}
        <ul className="mt-2 divide-y text-sm">
          {positions.map((p) => (
            <li key={p} className="py-2">
              <span className="font-semibold">{p}</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {m.requirements
                  .filter((r) => r.position === p)
                  .map((r) => (
                    <RequirementButton
                      key={r.id}
                      position={p}
                      courseId={r.courseId}
                      on={false}
                      label={`Quitar: ${name.get(r.courseId) ?? "curso"}`}
                    />
                  ))}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {canEdit && courses.length > 0 && <AddRequirement courses={courses} />}
      {m.rows.map((r) => (
        <Card key={r.workerId}>
          <p className="font-semibold">
            {r.name} <span className="text-muted-foreground font-normal">· {r.position}</span>
          </p>
          <ul className="mt-1 text-sm">
            {r.items.map((i) => (
              <li
                key={i.courseId}
                className="flex flex-wrap items-center justify-between gap-2 py-1"
              >
                <span>
                  {i.courseName}
                  {i.dueDate ? ` · vence ${formatDate(i.dueDate)}` : ""}
                </span>
                <Badge variant={ST[i.state][0]}>{ST[i.state][1]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
