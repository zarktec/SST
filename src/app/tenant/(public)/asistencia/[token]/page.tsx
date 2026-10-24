import { currentTenant } from "@/core/auth/session";
import { formatDate } from "@/lib/format";
import { publicSessionByToken } from "@/modules/training/service";
import { AttendanceForm } from "./attendance-form";

export const metadata = { title: "Registro de asistencia", robots: { index: false } };

export default async function AttendancePage({ params }: PageProps<"/tenant/asistencia/[token]">) {
  const { token } = await params;
  const tenant = await currentTenant();
  const info =
    tenant && /^[0-9a-f]{48}$/.test(token)
      ? await publicSessionByToken(tenant.tenantId, token)
      : null;
  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-xl font-bold">{tenant?.tradeName}</h1>
      {info ? (
        <>
          <p className="text-sm">
            Registro de asistencia: <strong>{info.courseName}</strong> · {formatDate(info.date)}
          </p>
          <AttendanceForm token={token} questions={info.questions} />
        </>
      ) : (
        <p className="text-sm">
          Este código no está activo. Pide al capacitador que abra la sesión.
        </p>
      )}
    </main>
  );
}
