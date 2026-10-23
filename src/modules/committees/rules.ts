import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export type Kind = "copasst" | "vigia" | "ccl";
export const KIND_LABEL: Record<Kind, string> = {
  copasst: "COPASST",
  vigia: "Vigía SST",
  ccl: "Comité de Convivencia Laboral",
};

/**
 * COPASST si la empresa tiene `threshold` o más trabajadores; Vigía SST si tiene menos (Resolución 2013 de 1986, art. 1;
 * Decreto 1072 de 2015, art. 2.2.4.6.8 par. 2). El umbral es parametrizable. TODO-NORMA: validar con un experto SST.
 */
export const committeeKindFor = (workers: number, threshold = 10): "copasst" | "vigia" =>
  workers >= threshold ? "copasst" : "vigia";

export type MemberDraft = {
  workerId: string;
  representation: "employer" | "workers";
  seat: "principal" | "alternate";
  role?: "presidente" | "secretario" | "miembro";
};

/**
 * Validación de la conformación: representación paritaria de principales entre empleador y trabajadores (Resolución 2013 de
 * 1986, art. 2), sin personas repetidas, y para COPASST/Vigía al menos un principal por parte.
 * Vigía: un principal por parte. TODO-NORMA: tamaños mínimos por número de trabajadores.
 */
export function validateComposition(kind: Kind, members: MemberDraft[]): string[] {
  const errors: string[] = [];
  const ids = members.map((m) => m.workerId);
  if (new Set(ids).size !== ids.length)
    errors.push("Una persona no puede ocupar dos puestos en el mismo comité");
  const count = (rep: string, seat: string) =>
    members.filter((m) => m.representation === rep && m.seat === seat).length;
  const empP = count("employer", "principal");
  const wrkP = count("workers", "principal");
  if (empP === 0 || wrkP === 0)
    errors.push("Debe haber al menos un principal por el empleador y uno por los trabajadores");
  else if (empP !== wrkP)
    errors.push(
      `La representación debe ser paritaria: ${empP} principales del empleador y ${wrkP} de los trabajadores`,
    );
  if (kind === "vigia" && (empP > 1 || wrkP > 1))
    errors.push("El Vigía SST es una sola persona principal por parte");
  return errors;
}

export type Candidate = { id: string; name: string; votes: number };
export type Scrutiny = {
  rows: {
    candidateId: string;
    name: string;
    votes: number;
    seat: "principal" | "alternate" | null;
  }[];
  tie: boolean;
  totalVotes: number;
};

/**
 * Escrutinio: ordena por votos; los primeros `principalSeats` son principales y los siguientes `alternateSeats` suplentes.
 * Hay empate si dos candidatos con los mismos votos quedan a ambos lados de un corte (principal/suplente o suplente/fuera):
 * en ese caso no se asignan los puestos en disputa hasta resolverlo (sorteo u otro criterio del comité).
 */
export function scrutinize(
  candidates: Candidate[],
  principalSeats: number,
  alternateSeats: number,
): Scrutiny {
  const sorted = [...candidates].sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
  const total = sorted.reduce((s, c) => s + c.votes, 0);
  const seatAt = (i: number): "principal" | "alternate" | null =>
    i < principalSeats ? "principal" : i < principalSeats + alternateSeats ? "alternate" : null;
  const tiedAtCut = new Set<number>();
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].votes === sorted[i + 1].votes && seatAt(i) !== seatAt(i + 1)) {
      let a = i;
      while (a > 0 && sorted[a - 1].votes === sorted[i].votes) a--;
      let b = i + 1;
      while (b < sorted.length - 1 && sorted[b + 1].votes === sorted[i].votes) b++;
      for (let k = a; k <= b; k++) tiedAtCut.add(k);
    }
  }
  return {
    rows: sorted.map((c, i) => ({
      candidateId: c.id,
      name: c.name,
      votes: c.votes,
      seat: tiedAtCut.has(i) ? null : seatAt(i),
    })),
    tie: tiedAtCut.size > 0,
    totalVotes: total,
  };
}

/** Token de voto individual: se entrega una vez; en la base solo queda su hash. */
export const newVoteToken = () => randomBytes(24).toString("hex");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export type Renewal = "vigente" | "por_vencer" | "vencido";
export function renewalState(periodEnd: string, today: string, warnDays: number): Renewal {
  if (periodEnd < today) return "vencido";
  const left = Math.round((Date.parse(periodEnd) - Date.parse(today)) / 86_400_000);
  return left <= warnDays ? "por_vencer" : "vigente";
}

/** Meses AAAA-MM, desde el inicio del periodo hasta el mes anterior al actual, sin reunión registrada; y si el actual aún está pendiente. */
export function meetingGaps(
  meetingDates: string[],
  periodStart: string,
  today: string,
): { missing: string[]; currentMonthPending: boolean } {
  const have = new Set(meetingDates.map((d) => d.slice(0, 7)));
  const missing: string[] = [];
  const cur = today.slice(0, 7);
  let [y, m] = periodStart.slice(0, 7).split("-").map(Number);
  // La primera reunión se espera desde el mes siguiente a la conformación.
  m++;
  if (m > 12) {
    m = 1;
    y++;
  }
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key >= cur) break;
    if (!have.has(key)) missing.push(key);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return { missing, currentMonthPending: cur > periodStart.slice(0, 7) && !have.has(cur) };
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");
const opt = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
export const minutesSchema = z.object({
  committeeId: z.uuid(),
  date: ymd,
  agenda: opt(),
  content: z.string().trim().min(10, "Escribe el contenido del acta").max(20000),
  attendeeIds: z.array(z.uuid()).default([]),
  commitments: z
    .array(
      z.object({
        description: z.string().trim().min(3).max(500),
        responsibleName: opt(120),
        dueDate: z
          .union([ymd, z.literal("")])
          .optional()
          .transform((v) => v || null),
      }),
    )
    .default([]),
});
export type MinutesInput = z.input<typeof minutesSchema>;

export const electionSchema = z
  .object({
    kind: z.enum(["copasst", "vigia"]),
    principalSeats: z.coerce.number().int().min(1).max(20),
    alternateSeats: z.coerce.number().int().min(0).max(20),
    votingOpensOn: ymd,
    votingClosesOn: ymd,
  })
  .superRefine((e, ctx) => {
    if (e.votingClosesOn < e.votingOpensOn)
      ctx.addIssue({
        code: "custom",
        path: ["votingClosesOn"],
        message: "El cierre no puede ser anterior a la apertura",
      });
  });
export type ElectionInput = z.input<typeof electionSchema>;
