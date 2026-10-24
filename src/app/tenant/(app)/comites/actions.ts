"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { electionSchema, minutesSchema, type MemberDraft } from "@/modules/committees/rules";
import {
  CommitteeError,
  addCandidate,
  addMinutes,
  applyElection,
  closeCommitment,
  closeVoting,
  conformCommittee,
  createElection,
  openVoting,
  resolveTie,
} from "@/modules/committees/service";

const known = (e: unknown) =>
  e instanceof CommitteeError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): NonNullable<FormState> => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
  values: f ? formValues(f) : undefined,
});
const done = () => revalidatePath("/comites", "layout");

export async function conformAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("committees", "create");
  const members: MemberDraft[] = [];
  for (const [k, v] of f.entries()) {
    const m = k.match(/^member:(.+)$/);
    if (m && v) {
      const [representation, seat] = String(v).split(":");
      members.push({
        workerId: m[1],
        representation: representation as "employer" | "workers",
        seat: seat as "principal" | "alternate",
      });
    }
  }
  try {
    await conformCommittee(ctx.tenant.tenantId, ctx.user.id, {
      kind: String(f.get("kind")) as "copasst" | "vigia",
      periodStart: String(f.get("periodStart")),
      members,
    });
    done();
    return { ok: true, message: "Comité conformado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function minutesAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("committees", "edit");
  const commitments = String(f.get("commitments") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [description, responsibleName, dueDate] = l.split("|").map((x) => x.trim());
      return { description, responsibleName, dueDate };
    });
  const raw = {
    committeeId: f.get("committeeId"),
    date: f.get("date"),
    agenda: f.get("agenda"),
    content: f.get("content"),
    attendeeIds: f.getAll("attendeeIds"),
    commitments,
  };
  const parsed = minutesSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    await addMinutes(ctx.tenant.tenantId, ctx.user.id, raw as never);
    done();
    return { ok: true, message: "Acta registrada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function closeCommitmentAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("committees", "edit");
  try {
    await closeCommitment(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("id")),
      String(f.get("note") ?? ""),
    );
    done();
    return { ok: true, message: "Compromiso cerrado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function createElectionAction(
  _p: FormState,
  f: FormData,
): Promise<FormState & { id?: string }> {
  const ctx = await requirePermission("committees", "create");
  const raw = Object.fromEntries(f);
  const parsed = electionSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    const id = await createElection(ctx.tenant.tenantId, ctx.user.id, raw as never);
    // Sin revalidar aquí: el formulario debe seguir montado para navegar a la elección creada.
    return { ok: true, message: "Elección creada.", details: [id] };
  } catch (e) {
    return fail(e, f);
  }
}

export async function addCandidateAction(electionId: string, workerId: string): Promise<FormState> {
  const ctx = await requirePermission("committees", "edit");
  try {
    await addCandidate(ctx.tenant.tenantId, ctx.user.id, electionId, workerId);
    done();
    return { ok: true, message: "Candidato inscrito." };
  } catch (e) {
    return fail(e);
  }
}

export async function openVotingAction(
  electionId: string,
): Promise<FormState & { links?: { name: string; email: string | null; url: string }[] }> {
  const ctx = await requirePermission("committees", "edit");
  try {
    const links = await openVoting(ctx.tenant.tenantId, ctx.user.id, electionId);
    // Sin revalidar: los enlaces solo se muestran una vez y el componente debe seguir montado hasta que los descarguen.
    return {
      ok: true,
      message: `Votación abierta. Se generaron ${links.length} enlaces personales.`,
      links,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function closeVotingAction(electionId: string): Promise<FormState> {
  const ctx = await requirePermission("committees", "edit");
  try {
    const r = await closeVoting(ctx.tenant.tenantId, ctx.user.id, electionId);
    done();
    return {
      ok: true,
      message: r.tie
        ? "Escrutinio hecho: hay un empate por resolver."
        : `Escrutinio hecho: ${r.voted} de ${r.eligible} votaron.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function resolveTieAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("committees", "edit");
  try {
    await resolveTie(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("electionId")),
      String(f.get("order")).split(",").filter(Boolean),
      String(f.get("note") ?? ""),
    );
    done();
    return { ok: true, message: "Empate resuelto." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function applyElectionAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("committees", "create");
  try {
    await applyElection(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("electionId")),
      {
        principal: f.getAll("employerPrincipal").map(String),
        alternate: f.getAll("employerAlternate").map(String),
      },
      String(f.get("periodStart")),
    );
    done();
    return { ok: true, message: "Comité conformado con el resultado de la elección." };
  } catch (e) {
    return fail(e, f);
  }
}
