import Link from "@/components/ui/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { listCourses, listSessions } from "@/modules/training/service";
import { SessionForm } from "./forms";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Capacitación" };
const ST: Record<string, [string, "default" | "warning" | "success"]> = {
  scheduled: ["Programada", "default"],
  open: ["Abierta", "warning"],
  closed: ["Cerrada", "success"],
};

export default async function TrainingPage() {
  const ctx = await requirePermission("training", "view");
  const [sessions, courses] = await Promise.all([
    listSessions(ctx.tenant.tenantId),
    listCourses(ctx.tenant.tenantId),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Capacitación</h1>
      <nav className="flex flex-wrap gap-2" aria-label="Secciones">
        <Link href="/capacitacion/cursos" className="min-h-11 rounded-md border px-3 py-2 text-sm">
          Cursos y evaluaciones
        </Link>
        <Link href="/capacitacion/matriz" className="min-h-11 rounded-md border px-3 py-2 text-sm">
          Matriz de competencias
        </Link>
      </nav>
      {can(ctx.permissions, "training", "create") && (
        <Card>
          <CardTitle>Programar sesión</CardTitle>
          <div className="mt-3">
            {courses.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Primero crea un curso en “Cursos y evaluaciones”.
              </p>
            ) : (
              <FormModal
                title="Programar sesión"
                trigger="Programar sesión"
                triggerVariant="default"
              >
                <SessionForm courses={courses} />
              </FormModal>
            )}
          </div>
        </Card>
      )}
      <Card>
        <CardTitle>Sesiones</CardTitle>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Aún no hay sesiones.</p>
        ) : (
          <ul className="mt-2 divide-y text-sm">
            {sessions.map(({ session: s, courseName }) => (
              <li key={s.id}>
                <Link
                  href={`/capacitacion/sesion/${s.id}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span>
                    <span className="font-semibold">{courseName}</span> · {formatDate(s.date)}
                    {s.trainer ? ` · ${s.trainer}` : ""}
                  </span>
                  <Badge variant={ST[s.status][1]}>{ST[s.status][0]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
