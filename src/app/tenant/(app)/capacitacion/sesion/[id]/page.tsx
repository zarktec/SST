import Link from "next/link";
import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { currentHost, requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { originFor } from "@/core/tenancy/hosts";
import { formatDate, formatDateTime } from "@/lib/format";
import { getSession } from "@/modules/training/service";
import { listWorkers } from "@/modules/workers/service";
import { CloseButton, ManualForm, OpenButton } from "../../forms";

export const metadata = { title: "Sesión de capacitación" };

export default async function SessionPage({
  params,
}: PageProps<"/tenant/capacitacion/sesion/[id]">) {
  const ctx = await requirePermission("training", "view");
  const data = await getSession(ctx.tenant.tenantId, (await params).id);
  if (!data) notFound();
  const { session: s, course, attendees } = data;
  const canEdit = can(ctx.permissions, "training", "edit");
  let qr: string | null = null;
  let url: string | null = null;
  if (s.status === "open" && s.attendanceToken) {
    url = `${originFor(await currentHost())}/asistencia/${s.attendanceToken}`;
    qr = await QRCode.toDataURL(url, { margin: 1, width: 320 });
  }
  const have = new Set(attendees.map((a) => a.workerId));
  const people =
    canEdit && s.status !== "closed"
      ? (await listWorkers(ctx.tenant.tenantId, { status: "active" }))
          .filter((p) => !have.has(p.id))
          .map((p) => ({ id: p.id, name: p.fullName }))
      : [];
  return (
    <div className="space-y-4">
      <Link href="/capacitacion" className="text-primary text-sm underline">
        ← Capacitación
      </Link>
      <h1 className="text-2xl font-bold">{course.name}</h1>
      <p className="text-muted-foreground text-sm">
        {formatDate(s.date)}
        {s.location ? ` · ${s.location}` : ""}
        {s.trainer ? ` · ${s.trainer}` : ""} ·{" "}
        <Badge>
          {s.status === "open" ? "Abierta" : s.status === "closed" ? "Cerrada" : "Programada"}
        </Badge>
      </p>
      {canEdit && s.status !== "closed" && (
        <Card>
          <div className="flex flex-wrap gap-3">
            {s.status === "scheduled" && <OpenButton id={s.id} />}
            {s.status === "open" && <CloseButton id={s.id} />}
          </div>
          {qr && url && (
            <div className="mt-4 space-y-2">
              <p className="text-sm">
                Los asistentes escanean este código, escriben su documento y firman con el dedo
                {course.passScore ? " y responden la evaluación" : ""}.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="Código QR de asistencia"
                width={320}
                height={320}
                className="rounded-md border bg-white"
              />
              <p className="text-muted-foreground text-xs break-all">{url}</p>
            </div>
          )}
        </Card>
      )}
      <Card>
        <CardTitle>Asistentes ({attendees.length})</CardTitle>
        {attendees.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Aún no hay asistentes.</p>
        ) : (
          <ul className="mt-2 divide-y text-sm">
            {attendees.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-semibold">{a.name}</span>{" "}
                  <span className="text-muted-foreground">
                    ••••{a.last4} · {a.method === "qr" ? "firma QR" : "registro manual"} ·{" "}
                    {formatDateTime(a.signedAt)}
                    {a.score !== null ? ` · ${a.score}/100` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {a.passed === false ? (
                    <Badge variant="destructive">No aprobó</Badge>
                  ) : (
                    <Badge variant="success">Aprobó</Badge>
                  )}
                  {a.passed !== false && (
                    <a
                      className="text-primary underline"
                      href={`/capacitacion/certificado/${a.id}`}
                    >
                      Certificado
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {canEdit && s.status !== "closed" && people.length > 0 && (
        <Card>
          <CardTitle>Asistencia manual</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Para quien no pudo firmar con el celular. Queda marcada como registro manual.
          </p>
          <div className="mt-3">
            <ManualForm sessionId={s.id} people={people} />
          </div>
        </Card>
      )}
      {s.status === "closed" && <Alert>Sesión cerrada: el QR ya no funciona.</Alert>}
    </div>
  );
}
