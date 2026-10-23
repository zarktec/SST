"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { courseSchema, parseQuizText, sessionSchema } from "@/modules/training/rules";
import {
  TrainingError,
  archiveCourse,
  closeSession,
  createSession,
  openSession,
  registerManualAttendance,
  saveCourse,
  setQuestions,
  setRequirement,
} from "@/modules/training/service";

const known = (e: unknown) =>
  e instanceof TrainingError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): FormState => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
  values: f ? formValues(f) : undefined,
});
const done = () => revalidatePath("/capacitacion", "layout");

export async function saveCourseAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("training", String(f.get("id") ?? "") ? "edit" : "create");
  const raw = Object.fromEntries(f);
  const parsed = courseSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    await saveCourse(
      ctx.tenant.tenantId,
      ctx.user.id,
      raw as never,
      String(f.get("id") ?? "") || undefined,
    );
    done();
    return { ok: true, message: "Curso guardado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function saveQuizAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("training", "edit");
  const { questions, errors } = parseQuizText(String(f.get("quiz") ?? ""));
  if (errors.length) return { ok: false, message: errors.join(" · "), values: formValues(f) };
  try {
    await setQuestions(ctx.tenant.tenantId, ctx.user.id, String(f.get("courseId")), questions);
    done();
    return { ok: true, message: `Evaluación guardada (${questions.length} preguntas).` };
  } catch (e) {
    return fail(e, f);
  }
}

export async function archiveCourseAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("training", "delete");
  await archiveCourse(ctx.tenant.tenantId, ctx.user.id, id);
  done();
  return { ok: true, message: "Curso archivado." };
}

export async function createSessionAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("training", "create");
  const raw = Object.fromEntries(f);
  const parsed = sessionSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    await createSession(ctx.tenant.tenantId, ctx.user.id, raw as never);
    done();
    return { ok: true, message: "Sesión programada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function openSessionAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("training", "edit");
  try {
    await openSession(ctx.tenant.tenantId, ctx.user.id, id);
    done();
    return { ok: true, message: "Sesión abierta: muestra el QR a los asistentes." };
  } catch (e) {
    return fail(e);
  }
}

export async function closeSessionAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("training", "edit");
  try {
    await closeSession(ctx.tenant.tenantId, ctx.user.id, id);
    done();
    return { ok: true, message: "Sesión cerrada." };
  } catch (e) {
    return fail(e);
  }
}

export async function manualAttendanceAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("training", "edit");
  try {
    await registerManualAttendance(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("sessionId")),
      String(f.get("workerId")),
      f.get("passed") !== "no",
    );
    done();
    return { ok: true, message: "Asistencia registrada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function requirementAction(
  position: string,
  courseId: string,
  on: boolean,
): Promise<FormState> {
  const ctx = await requirePermission("training", "edit");
  try {
    await setRequirement(ctx.tenant.tenantId, ctx.user.id, position, courseId, on);
    done();
    return { ok: true, message: on ? "Requisito agregado." : "Requisito quitado." };
  } catch (e) {
    return fail(e);
  }
}
