import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { quizToText } from "@/modules/training/rules";
import { listCourses, listQuestions } from "@/modules/training/service";
import { ArchiveButton, CourseForm, QuizForm } from "../forms";

export const metadata = { title: "Cursos" };

export default async function CoursesPage() {
  const ctx = await requirePermission("training", "view");
  const courses = await listCourses(ctx.tenant.tenantId);
  const canEdit = can(ctx.permissions, "training", "edit");
  const quizzes = await Promise.all(courses.map((c) => listQuestions(ctx.tenant.tenantId, c.id)));
  return (
    <div className="space-y-4">
      <Link href="/capacitacion" className="text-primary text-sm underline">
        ← Capacitación
      </Link>
      <h1 className="text-2xl font-bold">Cursos y evaluaciones</h1>
      {courses.map((c, i) => (
        <Card key={c.id}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{c.name}</p>
            {c.validityMonths && <Badge>Vigencia {c.validityMonths} meses</Badge>}
            {quizzes[i].length > 0 && (
              <Badge variant="success">
                {quizzes[i].length} preguntas · mín. {c.passScore}
              </Badge>
            )}
          </div>
          {canEdit && (
            <details className="mt-2">
              <summary className="text-primary min-h-11 cursor-pointer py-2 text-sm">
                Editar
              </summary>
              <div className="space-y-4">
                <CourseForm
                  course={
                    {
                      ...c,
                      createdAt: undefined,
                      updatedAt: undefined,
                      deletedAt: undefined,
                      tenantId: undefined,
                    } as never
                  }
                />
                <QuizForm courseId={c.id} text={quizToText(quizzes[i])} />
                {can(ctx.permissions, "training", "delete") && <ArchiveButton id={c.id} />}
              </div>
            </details>
          )}
        </Card>
      ))}
      {can(ctx.permissions, "training", "create") && (
        <Card>
          <CardTitle>Nuevo curso</CardTitle>
          <div className="mt-3">
            <CourseForm />
          </div>
        </Card>
      )}
    </div>
  );
}
