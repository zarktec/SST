import { describe, expect, it } from "vitest";
import {
  competence,
  courseSchema,
  evidenceHash,
  isValidSignature,
  newAttendanceToken,
  questionSchema,
  scoreQuiz,
} from "./rules";

const png = (n: number) =>
  `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(n, 1)]).toString("base64")}`;

describe("firma táctil", () => {
  it("acepta un PNG de tamaño razonable", () => expect(isValidSignature(png(500))).toBe(true));
  it("rechaza no-PNG, muy pequeño, enorme o con formato inválido", () => {
    expect(
      isValidSignature(`data:image/png;base64,${Buffer.alloc(500, 1).toString("base64")}`),
    ).toBe(false);
    expect(isValidSignature(png(10))).toBe(false);
    expect(isValidSignature(png(300_000))).toBe(false);
    expect(isValidSignature("data:image/jpeg;base64,AAAA")).toBe(false);
    expect(isValidSignature("<script>")).toBe(false);
  });
});

describe("evaluación y token", () => {
  it("puntaje por respuestas correctas; sin responder = incorrecta; sin preguntas = 100", () => {
    expect(scoreQuiz([0, 1, 2], [0, 1, 0])).toBe(67);
    expect(scoreQuiz([0, 1], [null, undefined])).toBe(0);
    expect(scoreQuiz([], [])).toBe(100);
  });
  it("tokens largos y distintos", () => {
    const a = newAttendanceToken();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(newAttendanceToken()).not.toBe(a);
  });
  it("la huella cambia con cualquier dato de la evidencia", () => {
    const e = {
      sessionId: "s",
      workerId: "w",
      signedAt: "2026-01-01T00:00:00Z",
      signature: "sig",
      ip: "1.1.1.1",
      userAgent: "ua",
    };
    expect(evidenceHash(e)).toMatch(/^[0-9a-f]{64}$/);
    expect(evidenceHash({ ...e, ip: "2.2.2.2" })).not.toBe(evidenceHash(e));
  });
  it("validación de pregunta: respuesta correcta existente", () => {
    expect(
      questionSchema.safeParse({ question: "¿Qué es EPP?", options: ["a", "b"], correctIndex: 1 })
        .success,
    ).toBe(true);
    expect(
      questionSchema.safeParse({ question: "¿Qué es EPP?", options: ["a", "b"], correctIndex: 2 })
        .success,
    ).toBe(false);
    expect(
      questionSchema.safeParse({ question: "¿Qué es EPP?", options: ["a"], correctIndex: 0 })
        .success,
    ).toBe(false);
  });
});

describe("curso y competencias", () => {
  it("convierte vacíos a null", () => {
    expect(
      courseSchema.parse({
        name: "Inducción SST",
        kind: "induction",
        durationHours: "",
        validityMonths: "12",
        passScore: "",
      }),
    ).toMatchObject({ durationHours: null, validityMonths: 12, passScore: null });
  });
  it("pendiente, cumple sin vigencia, vigente y vencido; los reprobados no cuentan", () => {
    expect(competence([], 12, "2026-10-23")).toMatchObject({ state: "pendiente" });
    expect(competence([{ date: "2020-01-01", passed: true }], null, "2026-10-23")).toMatchObject({
      state: "cumple",
      dueDate: null,
    });
    expect(competence([{ date: "2026-01-31", passed: true }], 12, "2026-10-23")).toEqual({
      state: "cumple",
      lastDate: "2026-01-31",
      dueDate: "2027-01-31",
    });
    expect(competence([{ date: "2025-01-31", passed: true }], 12, "2026-10-23").state).toBe(
      "vencido",
    );
    expect(competence([{ date: "2026-10-01", passed: false }], 12, "2026-10-23").state).toBe(
      "pendiente",
    );
    expect(
      competence(
        [
          { date: "2026-01-31", passed: true },
          { date: "2026-10-01", passed: false },
        ],
        12,
        "2026-10-23",
      ).lastDate,
    ).toBe("2026-01-31");
  });
  it("vigencia desde el 31 de enero: fin de mes", () => {
    expect(competence([{ date: "2026-01-31", passed: true }], 1, "2026-02-27").dueDate).toBe(
      "2026-02-28",
    );
  });
});

import { parseQuizText, quizToText } from "./rules";
describe("editor de preguntas en texto", () => {
  it("parsea bloques con la correcta marcada y hace ida y vuelta", () => {
    const text =
      "¿Qué es un EPP?\n* Equipo de protección personal\nUn juego\n\n¿Cuándo usar casco?\nNunca\n* En obra";
    const r = parseQuizText(text);
    expect(r.errors).toEqual([]);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[1]).toMatchObject({ correctIndex: 1, options: ["Nunca", "En obra"] });
    expect(
      parseQuizText(
        quizToText(
          r.questions.map((q) => ({
            question: q.question,
            options: q.options.map((text) => ({ text })),
            correctIndex: q.correctIndex,
          })),
        ),
      ).questions,
    ).toEqual(r.questions);
  });
  it("reporta bloques sin correcta, con varias o con pocas opciones", () => {
    expect(parseQuizText("¿Pregunta uno?\na\nb").errors[0]).toMatch(/exactamente una/);
    expect(parseQuizText("¿Pregunta uno?\n*a\n*b").errors[0]).toMatch(/exactamente una/);
    expect(parseQuizText("¿Pregunta uno?\n*a").errors[0]).toMatch(/Mínimo 2/);
    expect(parseQuizText("").questions).toEqual([]);
  });
});
