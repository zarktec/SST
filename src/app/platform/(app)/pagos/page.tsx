import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePlatformStaff } from "@/core/auth/session";
import { formatCOP, formatDate } from "@/lib/format";
import { listBillingOverview } from "@/modules/billing/invoicing";
import { creditNoteAction, retryInvoiceAction } from "./actions";

export const metadata = { title: "Pagos y facturas" };

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  processing: "Emitiendo",
  issued: "Emitida (DIAN pendiente)",
  accepted: "Aceptada DIAN",
  rejected: "Rechazada DIAN",
  error: "Error",
};

export default async function PaymentsPage() {
  const staff = await requirePlatformStaff();
  const rows = await listBillingOverview();
  const canAct = staff.role === "SUPER_ADMIN";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pagos y facturas</h1>
      <Card>
        <CardTitle>Últimos pagos</CardTitle>
        {rows.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Aún no hay pagos.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {rows.map((r) => (
              <li key={r.paymentId} className="space-y-2 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.tenantName}</p>
                    <p className="text-muted-foreground">
                      {formatDate(r.createdAt)} · {formatCOP(r.totalCents)} · {r.reference}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.paymentStatus === "approved" ? "success" : "default"}>
                      {r.paymentStatus}
                    </Badge>
                    {r.invoiceStatus && (
                      <Badge variant={r.invoiceStatus === "accepted" ? "success" : "default"}>
                        {r.number ? `${r.number} · ` : ""}
                        {STATUS_LABEL[r.invoiceStatus]}
                      </Badge>
                    )}
                  </div>
                </div>
                {r.errors && r.errors.length > 0 && (
                  <p className="text-destructive">{r.errors.join(" · ")}</p>
                )}
                {r.invoiceId && (
                  <div className="flex flex-wrap items-center gap-2">
                    {r.hasPdf ? (
                      <a className="text-primary underline" href={`/facturas/${r.invoiceId}/pdf`}>
                        Descargar PDF
                      </a>
                    ) : null}
                    {canAct && (r.invoiceStatus === "error" || r.invoiceStatus === "rejected") && (
                      <form action={retryInvoiceAction.bind(null, r.invoiceId)}>
                        <Button type="submit" variant="outline" size="sm">
                          Reintentar
                        </Button>
                      </form>
                    )}
                    {canAct && (r.invoiceStatus === "issued" || r.invoiceStatus === "accepted") && (
                      <form
                        action={creditNoteAction.bind(null, r.invoiceId)}
                        className="flex gap-2"
                      >
                        <input
                          name="reason"
                          placeholder="Motivo del reembolso"
                          className="border-input rounded-md border px-2 text-sm"
                        />
                        <Button type="submit" variant="outline" size="sm">
                          Nota crédito
                        </Button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
