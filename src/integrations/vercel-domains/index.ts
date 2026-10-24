import "server-only";

/**
 * Dominios de las empresas en el proyecto de Vercel (spec 3.2). Credenciales de infraestructura en
 * variables de entorno: VERCEL_API_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID.
 * Sin token (desarrollo/CI) se usa un proveedor nulo que da por verificados los dominios.
 */
export type DnsInstruction = { type: "CNAME" | "A" | "TXT"; name: string; value: string };
export type DomainState = {
  host: string;
  /** Vercel reconoce la propiedad del dominio en el proyecto. */
  verified: boolean;
  /** DNS apuntando a Vercel. */
  configured: boolean;
  instructions: DnsInstruction[];
  error?: string;
};

export interface DomainProvider {
  add(host: string): Promise<DomainState>;
  check(host: string): Promise<DomainState>;
  remove(host: string): Promise<void>;
}

const FALLBACK_CNAME = "cname.vercel-dns.com";

type FetchFn = typeof fetch;

export class VercelDomains implements DomainProvider {
  constructor(
    private cfg: { token: string; projectId: string; teamId?: string },
    private f: FetchFn = fetch,
  ) {}

  private url(path: string, extra: Record<string, string> = {}) {
    const q = new URLSearchParams(extra);
    if (this.cfg.teamId) q.set("teamId", this.cfg.teamId);
    return `https://api.vercel.com${path}${q.size ? `?${q}` : ""}`;
  }
  private headers() {
    return { Authorization: `Bearer ${this.cfg.token}`, "Content-Type": "application/json" };
  }

  async add(host: string): Promise<DomainState> {
    const res = await this.f(this.url(`/v10/projects/${this.cfg.projectId}/domains`), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ name: host }),
    });
    // 409 = ya estaba agregado al proyecto: se trata como éxito idempotente.
    if (!res.ok && res.status !== 409) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return {
        host,
        verified: false,
        configured: false,
        instructions: [],
        error: body.error?.message ?? `Vercel respondió ${res.status}`,
      };
    }
    return this.check(host);
  }

  async check(host: string): Promise<DomainState> {
    const pRes = await this.f(
      this.url(`/v9/projects/${this.cfg.projectId}/domains/${encodeURIComponent(host)}`),
      { headers: this.headers() },
    );
    if (!pRes.ok)
      return {
        host,
        verified: false,
        configured: false,
        instructions: [],
        error:
          pRes.status === 404
            ? "El dominio no está en el proyecto"
            : `Vercel respondió ${pRes.status}`,
      };
    const p = (await pRes.json()) as {
      verified?: boolean;
      verification?: { type: string; domain: string; value: string }[];
    };
    const cRes = await this.f(
      this.url(`/v6/domains/${encodeURIComponent(host)}/config`, {
        projectIdOrName: this.cfg.projectId,
      }),
      { headers: this.headers() },
    );
    const c = cRes.ok
      ? ((await cRes.json()) as {
          misconfigured?: boolean;
          recommendedCNAME?: { rank: number; value: string }[];
          recommendedIPv4?: { rank: number; value: string[] }[];
        })
      : { misconfigured: true };
    const cname =
      c.recommendedCNAME?.sort((a, b) => a.rank - b.rank)[0]?.value?.replace(/\.$/, "") ??
      FALLBACK_CNAME;
    const ip = c.recommendedIPv4?.sort((a, b) => a.rank - b.rank)[0]?.value?.[0];
    const label = host.split(".")[0];
    const isApex = host.split(".").length <= 2;
    const instructions: DnsInstruction[] = [
      isApex && ip
        ? { type: "A", name: "@", value: ip }
        : { type: "CNAME", name: label, value: cname },
      ...(p.verification ?? []).map((v) => ({
        type: v.type as "TXT",
        name: v.domain,
        value: v.value,
      })),
    ];
    return { host, verified: Boolean(p.verified), configured: !c.misconfigured, instructions };
  }

  async remove(host: string): Promise<void> {
    const res = await this.f(
      this.url(`/v9/projects/${this.cfg.projectId}/domains/${encodeURIComponent(host)}`),
      { method: "DELETE", headers: this.headers() },
    );
    if (!res.ok && res.status !== 404)
      throw new Error(`No se pudo quitar el dominio (${res.status})`);
  }
}

/** Proveedor nulo: no llama a ninguna API (desarrollo, CI y entornos sin token). */
export class NullDomains implements DomainProvider {
  async add(host: string): Promise<DomainState> {
    return { host, verified: true, configured: true, instructions: [] };
  }
  check = this.add;
  async remove(): Promise<void> {}
}

export function domainProvider(): DomainProvider {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  return token && projectId
    ? new VercelDomains({ token, projectId, teamId: process.env.VERCEL_TEAM_ID })
    : new NullDomains();
}
