import { currentTenant } from "@/core/auth/session";
import { ballotByToken } from "@/modules/committees/service";
import { VoteForm } from "./vote-form";

export const metadata = { title: "Votación", robots: { index: false } };

export default async function VotePage({ params }: PageProps<"/tenant/votar/[token]">) {
  const { token } = await params;
  const tenant = await currentTenant();
  const info =
    tenant && /^[0-9a-f]{48}$/.test(token) ? await ballotByToken(tenant.tenantId, token) : null;
  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-xl font-bold">{tenant?.tradeName}</h1>
      {!info ? (
        <p className="text-sm">
          Este enlace de votación no es válido o la votación no está abierta.
        </p>
      ) : info.alreadyVoted ? (
        <p className="text-sm">Ya votaste en esta elección. ¡Gracias!</p>
      ) : (
        <>
          <p className="text-sm">
            Elección de representantes de los trabajadores al{" "}
            {info.kind === "copasst" ? "COPASST" : "Vigía SST"}.
          </p>
          <VoteForm token={token} candidates={info.candidates} max={info.principalSeats} />
        </>
      )}
    </main>
  );
}
