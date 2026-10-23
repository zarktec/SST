import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export const KINDS = [
  { value: "induction", label: "Inducción" },
  { value: "reinduction", label: "Reinducción" },
  { value: "specific", label: "Específica" },
  { value: "other", label: "Otra" },
] as const;

const opt = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const intOrNull = (min: number, max: number) =>
  z
    .union([z.literal(""), z.coerce.number().int().min(min).max(max)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v));

export const courseSchema = z.object({
  name: z.string().trim().min(3, "Indica el nombre del curso").max(160),
  kind: z.enum(["induction", "reinduction", "specific", "other"]),
  durationHours: z
    .union([z.literal(""), z.coerce.number().min(0.25).max(1000)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  description: opt(),
  validityMonths: intOrNull(1, 120),
  passScore: intOrNull(1, 100),
});
export type CourseInput = z.input<typeof courseSchema>;

export const sessionSchema = z.object({
  courseId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)"),
  location: opt(160),
  trainer: opt(160),
  notes: opt(),
});
export type SessionInput = z.input<typeof sessionSchema>;

export const questionSchema = z
  .object({
    question: z.string().trim().min(3, "Escribe la pregunta").max(300),
    options: z.array(z.string().trim().min(1).max(200)).min(2, "Mínimo 2 opciones").max(6),
    correctIndex: z.number().int().min(0),
  })
  .superRefine((q, ctx) => {
    if (q.correctIndex >= q.options.length)
      ctx.addIssue({
        code: "custom",
        path: ["correctIndex"],
        message: "La respuesta correcta no existe",
      });
  });
export type QuestionInput = z.input<typeof questionSchema>;

/** Token del QR: aleatorio (192 bits) y de un solo uso por sesión abierta. */
export const newAttendanceToken = () => randomBytes(24).toString("hex");

const MAX_SIGNATURE_BYTES = 200_000;
/** Firma táctil: PNG en data URL, tamaño acotado y con la cabecera PNG real (no se acepta cualquier cadena). */
export function isValidSignature(dataUrl: string): boolean {
  const m = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return false;
  const bytes = Buffer.from(m[1], "base64");
  return (
    bytes.length >= 100 &&
    bytes.length <= MAX_SIGNATURE_BYTES &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  );
}

/** Puntaje (0-100) de la evaluación: respuestas correctas sobre el total; una pregunta sin responder cuenta como incorrecta. */
export function scoreQuiz(correct: number[], answers: (number | null | undefined)[]): number {
  if (!correct.length) return 100;
  const ok = correct.filter((c, i) => answers[i] === c).length;
  return Math.round((ok / correct.length) * 100);
}

/** Huella de la evidencia de asistencia (qué, quién, cuándo, desde dónde, con qué firma). */
export function evidenceHash(e: {
  sessionId: string;
  workerId: string;
  signedAt: string;
  signature: string | null;
  ip: string | null;
  userAgent: string | null;
}): string {
  return createHash("sha256")
    .update(
      [e.sessionId, e.workerId, e.signedAt, e.signature ?? "", e.ip ?? "", e.userAgent ?? ""].join(
        "|",
      ),
    )
    .digest("hex");
}

export type CompetenceState = "cumple" | "vencido" | "pendiente";
export type Competence = {
  state: CompetenceState;
  lastDate: string | null;
  dueDate: string | null;
};

const addMonths = (d: string, n: number) => {
  const [y, m, day] = d.split("-").map(Number);
  const out = new Date(Date.UTC(y, m - 1 + n, day));
  if (out.getUTCDate() !== day) out.setUTCDate(0); // 31 ene + 1 mes → 28/29 feb
  return out.toISOString().slice(0, 10);
};

/**
 * Estado de una competencia: vale la asistencia aprobada más reciente; si el curso tiene vigencia, vence a los N meses.
 * (Reinducción: Decreto 1072 de 2015, art. 2.2.4.6.11 — periodicidad parametrizable por curso.)
 */
export function competence(
  attendances: { date: string; passed: boolean | null }[],
  validityMonths: number | null,
  today: string,
): Competence {
  const ok = attendances
    .filter((a) => a.passed !== false)
    .map((a) => a.date)
    .sort();
  const last = ok.at(-1) ?? null;
  if (!last) return { state: "pendiente", lastDate: null, dueDate: null };
  if (!validityMonths) return { state: "cumple", lastDate: last, dueDate: null };
  const due = addMonths(last, validityMonths);
  return { state: due < today ? "vencido" : "cumple", lastDate: last, dueDate: due };
}

/**
 * Editor de preguntas en texto: bloques separados por una línea en blanco; la primera línea es la pregunta y cada línea
 * siguiente una opción; la correcta lleva `*` al inicio. Devuelve las preguntas y los errores por bloque.
 */
export function parseQuizText(text: string): {
  questions: { question: string; options: string[]; correctIndex: number }[];
  errors: string[];
} {
  const questions: { question: string; options: string[]; correctIndex: number }[] = [];
  const errors: string[] = [];
  const blocks = text
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  blocks.forEach((block, i) => {
    const [question, ...opts] = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const correct = opts.map((o, idx) => (o.startsWith("*") ? idx : -1)).filter((x) => x >= 0);
    if (correct.length !== 1)
      return errors.push(`Pregunta ${i + 1}: marca exactamente una opción correcta con *`);
    const options = opts.map((o) => o.replace(/^\*\s*/, ""));
    const parsed = questionSchema.safeParse({ question, options, correctIndex: correct[0] });
    if (!parsed.success) return errors.push(`Pregunta ${i + 1}: ${parsed.error.issues[0].message}`);
    questions.push(parsed.data);
  });
  return { questions, errors };
}

export const quizToText = (
  qs: { question: string; options: { text: string }[]; correctIndex: number }[],
) =>
  qs
    .map((q) =>
      [q.question, ...q.options.map((o, i) => `${i === q.correctIndex ? "* " : ""}${o.text}`)].join(
        "\n",
      ),
    )
    .join("\n\n");
