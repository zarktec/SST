import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import Link from "@/components/ui/link";
import { requirePermission } from "@/core/auth/session";
import { levelLabel } from "@/modules/performance/rules";
import { formFor } from "@/modules/performance/service";
import { submitAction } from "../../actions";
import { EvaluationForm } from "../../evaluation-form";

export const metadata = { title: "Responder evaluación" };

export default async function RespondPage({
  params,
}: PageProps<"/tenant/desempeno/responder/[id]">) {
  const ctx = await requirePermission("performance", "view");
  const f = await formFor(ctx.tenant.tenantId, ctx.user.email, (await params).id);
  if (!f) notFound();
  return (
    <div className="space-y-4">
      <Link href="/desempeno" className="text-primary text-sm underline">
        ← Evaluación 360
      </Link>
      <h1 className="text-2xl font-bold">Evaluar a {f.subject}</h1>
      <p className="text-muted-foreground text-sm">
        {f.position ? `${f.position} · ` : ""}
        {f.cycle} · Evalúas como: <strong>{levelLabel(f.level)}</strong>
      </p>
      <Alert variant="warning">
        {f.anonymous
          ? "Esta evaluación es anónima: la persona evaluada y la empresa verán los resultados, pero no quién calificó."
          : "Esta evaluación es identificada: se guarda tu nombre junto con tus calificaciones."}{" "}
        Elige una calificación de 1 a 5 en cada competencia. Una vez enviada no se puede cambiar.
      </Alert>
      <EvaluationForm action={submitAction} assignmentId={f.id} competencies={f.competencies} />
    </div>
  );
}
