import { A } from "@/components/ui/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getPaymentProvider } from "@/integrations/payments";
import { getClientSafeConfig } from "@/integrations/registry/service";
import { formatCOP, formatDate } from "@/lib/format";
import { getBillingProfile, listInvoices } from "@/modules/billing/invoicing";
import { isExpiringSoon } from "@/modules/billing/payment-sources";
import { getPortalOverview } from "@/modules/billing/portal";
import { listPlans } from "@/modules/platform/plans/service";
import { CardForm } from "./card-form";
import {
  BackupSourceButton,
  CancelButton,
  ChoosePlanButton,
  DefaultSourceButton,
  PayNowButton,
  RemoveSourceButton,
  UndoCancelButton,
} from "./controls";
import { requireBillingAdmin } from "./guard";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Facturación" };

const STATUS: Record<string, string> = {
  trialing: "En prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  suspended: "Suspendida",
  cancelled: "Cancelada",
};
const PAY: Record<string, string> = {
  approved: "Aprobado",
  declined: "Rechazado",
  pending: "Pendiente",
  voided: "Anulado",
  error: "Error",
};

async function tokenizationProps() {
  try {
    const [cfg, tokens] = await Promise.all([
      getClientSafeConfig("wompi"),
      getPaymentProvider().getAcceptanceTokens(),
    ]);
    if (!cfg.publicKey || !cfg.apiBaseUrl) return null;
    return {
      apiBaseUrl: String(cfg.apiBaseUrl).replace(/\/$/, ""),
      publicKey: String(cfg.publicKey),
      ...tokens,
    };
  } catch {
    return null;
  }
}

export default async function BillingPage() {
  const ctx = await requireBillingAdmin();
  const tenantId = ctx.tenant.tenantId;
  const [overview, profile, invoices, plans, tokenization] = await Promise.all([
    getPortalOverview(tenantId),
    getBillingProfile(tenantId),
    listInvoices(tenantId),
    listPlans({ onlyVisible: true }),
    tokenizationProps(),
  ]);
  if (!overview) return <Alert>Tu empresa aún no tiene una suscripción.</Alert>;
  const { subscription: sub, plan, sources, payments, nextCharge, scheduledPlan } = overview;
  const expiring = sources.filter((s) => isExpiringSoon(s));
  const paid = plans.filter((p) => !p.isTrial);
  const canPay = ["trialing", "active", "past_due", "suspended"].includes(sub.status);
  const invoiceByPayment = new Map(
    invoices.filter((i) => i.kind === "invoice").map((i) => [i.paymentId, i]),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Facturación</h1>

      {sub.status === "past_due" && (
        <Alert variant="warning">
          Tu último pago no se pudo procesar. Usa “Pagar ahora” o cambia tu método de pago
          {sub.graceEndsAt ? ` antes del ${formatDate(sub.graceEndsAt)}` : ""} para evitar la
          suspensión.
        </Alert>
      )}
      {sub.status === "suspended" && (
        <Alert variant="destructive">
          Tu cuenta está suspendida (solo lectura). Paga para reactivarla.
        </Alert>
      )}
      {sub.status === "trialing" && sub.trialEndsAt && (
        <Alert>
          Tu prueba gratuita termina el {formatDate(sub.trialEndsAt)}. Elige un plan y agrega un
          método de pago.
        </Alert>
      )}
      {expiring.length > 0 && (
        <Alert variant="warning">
          Una de tus tarjetas está por vencer. Agrega una nueva para evitar fallos de cobro.
        </Alert>
      )}
      {sub.cancelAtPeriodEnd && (
        <Alert variant="warning">
          Tu suscripción se cancelará el {formatDate(sub.currentPeriodEnd)}.
          <div className="mt-2">
            <UndoCancelButton />
          </div>
        </Alert>
      )}

      <Card>
        <CardTitle>Mi plan</CardTitle>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-semibold">{plan?.name}</span>
          <Badge variant={sub.status === "active" ? "success" : "default"}>
            {STATUS[sub.status]}
          </Badge>
        </div>
        <CardDescription className="mt-1">
          {sub.status === "trialing"
            ? `Prueba hasta ${formatDate(sub.trialEndsAt)}. `
            : `Periodo hasta ${formatDate(sub.currentPeriodEnd)}. `}
          {nextCharge
            ? `Próximo cobro: ${formatCOP(nextCharge.totalCents)}${nextCharge.vatCents > 0n ? ` (IVA ${formatCOP(nextCharge.vatCents)} incluido)` : ""}${scheduledPlan ? ` — plan ${scheduledPlan.name}` : ""}.`
            : "Aún no has elegido un plan de pago."}
        </CardDescription>
        {canPay && nextCharge && sources.length > 0 && (
          <div className="mt-3">
            <PayNowButton />
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Elegir o cambiar de plan</CardTitle>
        <CardDescription className="mt-1">El cambio se aplica en tu próximo cobro.</CardDescription>
        <ul className="mt-3 divide-y">
          {paid.map((p) => (
            <li key={p.id} className="space-y-2 py-3 text-sm">
              <p className="font-semibold">{p.name}</p>
              <div className="flex flex-wrap gap-3">
                {(["monthly", "annual"] as const).map(
                  (per) =>
                    p.prices[per]?.active && (
                      <ChoosePlanButton
                        key={per}
                        planId={p.id}
                        period={per}
                        label={`${per === "monthly" ? "Mensual" : "Anual"} · ${formatCOP(p.prices[per]!.amountCents)}${p.vatEnabled && !p.vatIncluded ? " + IVA" : ""}`}
                      />
                    ),
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Métodos de pago</CardTitle>
        {sources.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Aún no tienes métodos de pago.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {sources.map((s) => (
              <li key={s.id} className="space-y-2 py-3 text-sm">
                <p className="font-semibold">
                  {s.brand ?? s.type} •••• {s.last4}{" "}
                  <span className="text-muted-foreground font-normal">
                    {s.expMonth && s.expYear
                      ? `vence ${String(s.expMonth).padStart(2, "0")}/${s.expYear}`
                      : ""}
                  </span>{" "}
                  {s.id === sub.defaultPaymentSourceId && (
                    <Badge variant="success">Predeterminado</Badge>
                  )}
                  {s.id === sub.backupPaymentSourceId && <Badge>Respaldo</Badge>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {s.id !== sub.defaultPaymentSourceId && <DefaultSourceButton id={s.id} />}
                  {s.id !== sub.defaultPaymentSourceId && s.id !== sub.backupPaymentSourceId && (
                    <BackupSourceButton id={s.id} />
                  )}
                  {s.id === sub.backupPaymentSourceId && <BackupSourceButton id={null} />}
                  <RemoveSourceButton id={s.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-t pt-4">
          <h3 className="mb-2 text-sm font-semibold">Agregar tarjeta</h3>
          {tokenization ? (
            <CardForm {...tokenization} />
          ) : (
            <Alert>Los pagos con tarjeta aún no están disponibles. Intenta más tarde.</Alert>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Datos de facturación</CardTitle>
        <CardDescription className="mt-1">
          Se usan para emitir tu factura electrónica ante la DIAN.
        </CardDescription>
        <div className="mt-3">
          <ProfileForm profile={profile ? { ...profile, updatedAt: undefined } : null} />
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Historial de pagos</CardTitle>
          <A className="text-primary text-sm underline" href="/facturacion/exportar">
            Exportar a Excel (CSV)
          </A>
        </div>
        {payments.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Aún no hay pagos.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {payments.map((p) => {
              const inv = invoiceByPayment.get(p.id);
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">{formatCOP(p.totalCents)}</p>
                    <p className="text-muted-foreground">
                      {formatDate(p.createdAt)} · {p.reference}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        p.status === "approved"
                          ? "success"
                          : p.status === "pending"
                            ? "default"
                            : "destructive"
                      }
                    >
                      {PAY[p.status]}
                    </Badge>
                    {inv?.hasPdf ? (
                      <A className="text-primary underline" href={`/facturacion/factura/${inv.id}`}>
                        Factura {inv.number}
                      </A>
                    ) : inv ? (
                      <span className="text-muted-foreground">Factura en proceso</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {sub.status !== "cancelled" && !sub.cancelAtPeriodEnd && (
        <Card>
          <CardTitle>Cancelar suscripción</CardTitle>
          <CardDescription className="mt-1">
            Conservaremos tus registros obligatorios en un archivo cifrado de solo consulta.
          </CardDescription>
          <div className="mt-3">
            <CancelButton />
          </div>
        </Card>
      )}
    </div>
  );
}
