"use client";
import { useState, useTransition } from "react";
import { useActionState } from "@/components/forms/use-form-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { FormState } from "@/lib/form-state";
import { KINDS } from "@/modules/training/rules";
import {
  archiveCourseAction,
  closeSessionAction,
  createSessionAction,
  manualAttendanceAction,
  openSessionAction,
  requirementAction,
  saveCourseAction,
  saveQuizAction,
} from "./actions";

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";

export function ActionButton({
  run,
  children,
  confirm: ask,
  variant = "outline",
}: {
  run: () => Promise<FormState>;
  children: React.ReactNode;
  confirm?: string;
  variant?: "default" | "outline";
}) {
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.message}</Alert>}
      <Button
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={() => (!ask || window.confirm(ask)) && start(async () => setMsg(await run()))}
      >
        {pending ? "Procesando…" : children}
      </Button>
    </div>
  );
}
export const OpenButton = ({ id }: { id: string }) => (
  <ActionButton variant="default" run={() => openSessionAction(id)}>
    Abrir sesión (generar QR)
  </ActionButton>
);
export const CloseButton = ({ id }: { id: string }) => (
  <ActionButton
    run={() => closeSessionAction(id)}
    confirm="Al cerrar la sesión el QR deja de funcionar. ¿Cerrar?"
  >
    Cerrar sesión
  </ActionButton>
);
export const ArchiveButton = ({ id }: { id: string }) => (
  <ActionButton run={() => archiveCourseAction(id)} confirm="¿Archivar este curso?">
    Archivar
  </ActionButton>
);
export const RequirementButton = ({
  position,
  courseId,
  on,
  label,
}: {
  position: string;
  courseId: string;
  on: boolean;
  label: string;
}) => <ActionButton run={() => requirementAction(position, courseId, on)}>{label}</ActionButton>;

type C = {
  id: string;
  name: string;
  kind: string;
  durationHours: string | null;
  description: string | null;
  validityMonths: number | null;
  passScore: number | null;
};
export function CourseForm({ course }: { course?: C }) {
  const [s, action, pending] = useActionState(saveCourseAction, null);
  const pfx = course ? `${course.id}-` : "new-";
  const kind = typeof s?.values?.kind === "string" ? s.values.kind : (course?.kind ?? "specific");
  return (
    <form action={action} className="space-y-3">
      {course && <input type="hidden" name="id" value={course.id} />}
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          idPrefix={pfx}
          state={s}
          saved={course?.name}
          name="name"
          label="Nombre del curso"
          required
        />
        <div className="space-y-1">
          <Label htmlFor={`${pfx}kind`}>Tipo</Label>
          <Select id={`${pfx}kind`} name="kind" className={sel} defaultValue={kind}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
        <Field
          idPrefix={pfx}
          state={s}
          saved={course?.durationHours}
          name="durationHours"
          label="Intensidad (horas)"
          inputMode="decimal"
        />
        <Field
          idPrefix={pfx}
          state={s}
          saved={course?.validityMonths}
          name="validityMonths"
          label="Vigencia (meses; vacío = no vence)"
          inputMode="numeric"
        />
        <Field
          idPrefix={pfx}
          state={s}
          saved={course?.passScore}
          name="passScore"
          label="Puntaje mínimo de la evaluación (1-100)"
          inputMode="numeric"
        />
        <Field
          idPrefix={pfx}
          state={s}
          saved={course?.description}
          name="description"
          label="Descripción"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : course ? "Guardar curso" : "Crear curso"}
      </Button>
    </form>
  );
}

export function QuizForm({ courseId, text }: { courseId: string; text: string }) {
  const [s, action, pending] = useActionState(saveQuizAction, null);
  const v = typeof s?.values?.quiz === "string" ? s.values.quiz : text;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <Label htmlFor={`quiz-${courseId}`}>
        Evaluación (una pregunta por bloque; la opción correcta empieza con *)
      </Label>
      <textarea
        key={v}
        id={`quiz-${courseId}`}
        name="quiz"
        defaultValue={v}
        rows={8}
        className="border-input bg-background w-full rounded-md border p-3 text-base"
        placeholder={
          "¿Qué significa EPP?\n* Elemento de protección personal\nEquipo para programar"
        }
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Guardar evaluación
      </Button>
    </form>
  );
}

export function SessionForm({ courses }: { courses: { id: string; name: string }[] }) {
  const [s, action, pending] = useActionState(createSessionAction, null);
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="courseId">Curso</Label>
          <Select
            id="courseId"
            name="courseId"
            className={sel}
            defaultValue={
              typeof s?.values?.courseId === "string" ? s.values.courseId : (courses[0]?.id ?? "")
            }
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Field state={s} name="date" label="Fecha" type="date" required />
        <Field state={s} name="location" label="Lugar" />
        <Field state={s} name="trainer" label="Capacitador" />
      </div>
      <Button type="submit" disabled={pending || courses.length === 0}>
        Programar sesión
      </Button>
    </form>
  );
}

export function ManualForm({
  sessionId,
  people,
}: {
  sessionId: string;
  people: { id: string; name: string }[];
}) {
  const [s, action, pending] = useActionState(manualAttendanceAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sessionId" value={sessionId} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="workerId">Persona</Label>
          <Select id="workerId" name="workerId" className={sel} defaultValue={people[0]?.id ?? ""}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="passed">Resultado</Label>
          <Select id="passed" name="passed" className={sel} defaultValue="yes">
            <option value="yes">Asistió y aprobó</option>
            <option value="no">Asistió, no aprobó</option>
          </Select>
        </div>
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Registrar asistencia manual
      </Button>
    </form>
  );
}
