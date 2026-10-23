import "server-only";
import { and, desc, eq, inArray, isNotNull, lte, or } from "drizzle-orm";
import { bogotaDate } from "@/core/calendar/business-days";
import { schema, systemDb, withPlatform, withTenant } from "@/core/db";
import { sendMail } from "@/core/mail";
import {
  InvoicingError,
  type InvoicingProvider,
  type IssuedDocument,
} from "@/integrations/invoicing/types";
import { formatCOP } from "@/lib/format";
import { billingProfileSchema, type BillingProfileInput } from "./billing-profile";
import type { Payment } from "./charging";
import { adminEmails } from "./handlers";

const { invoice, billingProfile, payment, platformStaff, user } = schema;
export type Invoice = typeof invoice.$inferSelect;
const SYSTEM = "system";
/** Reintentos ante fallos transitorios del proveedor: 15 min, 1 h, 6 h, luego diario; al 8.º intento queda en error para revisión. */
const BACKOFF_MIN = [15, 60, 360, 1440, 1440, 1440, 1440];
const MAX_ATTEMPTS = BACKOFF_MIN.length + 1;
const plat = (action: string, tenantId?: string) => ({
  actorId: SYSTEM,
  action,
  tenantId,
  audit: false,
});

/** Datos de facturación de la empresa (los edita ADMIN_EMPRESA; viaja con RLS de tenant). */
export async function getBillingProfile(tenantId: string) {
  return withTenant(
    { tenantId },
    async (tx) =>
      (await tx.select().from(billingProfile).where(eq(billingProfile.tenantId, tenantId)))[0] ??
      null,
  );
}

export async function saveBillingProfile(
  tenantId: string,
  actorId: string,
  input: BillingProfileInput,
) {
  const data = billingProfileSchema.parse(input);
  return withTenant({ tenantId, userId: actorId }, async (tx) => {
    const values = {
      ...data,
      checkDigit: data.checkDigit ?? null,
      postalCode: data.postalCode ?? null,
      updatedBy: actorId,
      updatedAt: new Date(),
    };
    await tx
      .insert(billingProfile)
      .values({ tenantId, ...values })
      .onConflictDoUpdate({ target: billingProfile.tenantId, set: values });
  });
}

async function superAdminEmails(): Promise<string[]> {
  const rows = await systemDb()
    .select({ email: user.email })
    .from(platformStaff)
    .innerJoin(user, eq(user.id, platformStaff.userId))
    .where(eq(platformStaff.role, "SUPER_ADMIN"));
  return rows.map((r) => r.email);
}

async function alertPlatform(subject: string, html: string) {
  await Promise.all(
    (await superAdminEmails()).map((to) => sendMail({ to, subject, html }).catch(() => undefined)),
  );
}

/** Crea (idempotente) la factura pendiente de un pago aprobado. Devuelve null si ya existía. */
export async function enqueueInvoice(p: Payment): Promise<Invoice | null> {
  const [row] = await withPlatform(plat("billing.invoice.enqueue", p.tenantId), (tx) =>
    tx
      .insert(invoice)
      .values({ tenantId: p.tenantId, paymentId: p.id, kind: "invoice", totalCents: p.totalCents })
      .onConflictDoNothing()
      .returning(),
  );
  return row ?? null;
}

const patch = (id: string, tenantId: string, set: Partial<typeof invoice.$inferInsert>) =>
  withPlatform(plat("billing.invoice.update", tenantId), (tx) =>
    tx
      .update(invoice)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(invoice.id, id))
      .returning()
      .then((r) => r[0]),
  );

async function applyDoc(
  inv: Invoice,
  doc: IssuedDocument,
  provider: InvoicingProvider,
  now: Date,
): Promise<Invoice> {
  const next = await patch(inv.id, inv.tenantId, {
    providerId: doc.providerId || inv.providerId,
    number: doc.number ?? inv.number,
    cufe: doc.cufe ?? inv.cufe,
    status: doc.status,
    dianStatus: doc.dianStatus,
    errors: doc.errors.length ? doc.errors : null,
    issuedAt: inv.issuedAt ?? now,
    nextRetryAt: null,
  });
  if (doc.status === "rejected") {
    await alertPlatform(
      "Factura rechazada por la DIAN",
      `<p>La factura ${doc.number ?? inv.id} (empresa ${inv.tenantId}) fue rechazada.</p><ul>${doc.errors.map((e) => `<li>${e}</li>`).join("")}</ul><p>Corrígela desde Pagos y facturas.</p>`,
    );
    return next;
  }
  if (doc.providerId && !next.pdf) {
    try {
      const pdf = await provider.getPdf(doc.providerId);
      return (await patch(inv.id, inv.tenantId, { pdf, pdfSize: pdf.length })) ?? next;
    } catch {
      // El PDF se vuelve a pedir en la conciliación diaria.
    }
  }
  return next;
}

async function fail(inv: Invoice, e: unknown, now: Date): Promise<Invoice> {
  const err =
    e instanceof InvoicingError
      ? e
      : new InvoicingError(e instanceof Error ? e.message : "Error desconocido", true);
  const attempts = inv.attempts + 1;
  const retry = err.retryable && attempts < MAX_ATTEMPTS;
  const next = await patch(inv.id, inv.tenantId, {
    attempts,
    status: retry ? "pending" : "error",
    errors: [err.message],
    nextRetryAt: retry ? new Date(now.getTime() + BACKOFF_MIN[attempts - 1] * 60_000) : null,
  });
  if (!retry)
    await alertPlatform(
      "No se pudo emitir una factura electrónica",
      `<p>Factura ${inv.id} (empresa ${inv.tenantId}): ${err.message}</p>`,
    );
  return next;
}

/** Emite la factura en el proveedor. Seguro de repetir: la clave de idempotencia es el id del pago. */
export async function processInvoice(
  invoiceId: string,
  provider: InvoicingProvider,
  now = new Date(),
): Promise<Invoice> {
  const [inv] = await withPlatform(plat("billing.invoice.read"), (tx) =>
    tx.select().from(invoice).where(eq(invoice.id, invoiceId)),
  );
  if (!inv) throw new Error("Factura no encontrada");
  if (inv.kind !== "invoice" || ["issued", "accepted", "rejected"].includes(inv.status)) return inv;
  const [[pay], [profile]] = await withPlatform(plat("billing.invoice.read", inv.tenantId), (tx) =>
    Promise.all([
      tx.select().from(payment).where(eq(payment.id, inv.paymentId)),
      tx.select().from(billingProfile).where(eq(billingProfile.tenantId, inv.tenantId)),
    ]),
  );
  if (!profile) {
    const first = inv.status !== "error";
    const next = await patch(inv.id, inv.tenantId, {
      status: "error",
      errors: ["La empresa no ha completado sus datos de facturación"],
      nextRetryAt: new Date(now.getTime() + 86_400_000),
    });
    if (first)
      await Promise.all(
        (await adminEmails(inv.tenantId)).map((to) =>
          sendMail({
            to,
            subject: "Completa tus datos de facturación",
            html: "<p>Recibimos tu pago pero no podemos emitir la factura electrónica sin tus datos de facturación. Complétalos en <b>Facturación</b>.</p>",
          }),
        ),
      );
    return next;
  }
  const rateBp = pay.netCents > 0n ? Math.round(Number((pay.vatCents * 10000n) / pay.netCents)) : 0;
  await patch(inv.id, inv.tenantId, { status: "processing" });
  try {
    const doc = await provider.issueInvoice({
      idempotencyKey: `invoice-${pay.id}`,
      date: bogotaDate(now),
      reference: pay.reference,
      customer: {
        ...profile,
        personType: profile.personType === "Company" ? "Company" : "Person",
        email: profile.invoiceEmail,
      },
      lines: [
        {
          description: `Suscripción SST (${pay.period === "annual" ? "anual" : "mensual"})`,
          netCents: pay.netCents,
          vatRateBp: rateBp,
        },
      ],
      totalCents: pay.totalCents,
    });
    return await applyDoc({ ...inv, attempts: inv.attempts }, doc, provider, now);
  } catch (e) {
    return fail(inv, e, now);
  }
}

/** Gancho de pago aprobado: crea la factura y la emite de inmediato (si falla, la conciliación la reintenta). */
export async function invoiceApprovedPayment(p: Payment, provider: InvoicingProvider) {
  const inv = await enqueueInvoice(p);
  if (inv) await processInvoice(inv.id, provider);
}

/** Conciliación diaria: reintenta pendientes vencidas/errores sin perfil y consulta el estado DIAN de las emitidas. */
export async function reconcileInvoices(provider: InvoicingProvider, now = new Date()) {
  const rows = await withPlatform(plat("billing.invoice.reconcile"), (tx) =>
    tx
      .select()
      .from(invoice)
      .where(
        or(
          and(
            inArray(invoice.status, ["pending", "error"]),
            isNotNull(invoice.nextRetryAt),
            lte(invoice.nextRetryAt, now),
          ),
          and(eq(invoice.status, "issued"), eq(invoice.kind, "invoice")),
        ),
      ),
  );
  const out: { id: string; status: string }[] = [];
  for (const inv of rows) {
    try {
      if (inv.status === "issued" && inv.providerId) {
        const next = await applyDoc(inv, await provider.getStatus(inv.providerId), provider, now);
        out.push({ id: inv.id, status: next.status });
      } else {
        out.push({ id: inv.id, status: (await processInvoice(inv.id, provider, now)).status });
      }
    } catch (e) {
      console.error("[invoicing] conciliación falló:", inv.id, e);
    }
  }
  return out;
}

/** Descarga autorizada: la empresa solo ve sus facturas (RLS); el SUPER ADMIN pasa por withPlatform en su propia ruta. */
export async function getInvoicePdf(tenantId: string, invoiceId: string) {
  return withTenant({ tenantId }, async (tx) => {
    const [r] = await tx
      .select({ pdf: invoice.pdf, number: invoice.number })
      .from(invoice)
      .where(eq(invoice.id, invoiceId));
    return r?.pdf ? { pdf: r.pdf, number: r.number } : null;
  });
}

export async function listInvoices(tenantId: string) {
  return withTenant({ tenantId }, (tx) =>
    tx
      .select({
        id: invoice.id,
        paymentId: invoice.paymentId,
        kind: invoice.kind,
        number: invoice.number,
        status: invoice.status,
        dianStatus: invoice.dianStatus,
        totalCents: invoice.totalCents,
        hasPdf: invoice.pdfSize,
        issuedAt: invoice.issuedAt,
        createdAt: invoice.createdAt,
      })
      .from(invoice)
      .orderBy(desc(invoice.createdAt)),
  );
}

/** Reembolso: nota crédito sobre una factura emitida. */
export async function issueCreditNote(
  invoiceId: string,
  reason: string,
  actorId: string,
  provider: InvoicingProvider,
  now = new Date(),
): Promise<Invoice> {
  const [orig] = await withPlatform({ actorId, action: "billing.credit_note", audit: true }, (tx) =>
    tx.select().from(invoice).where(eq(invoice.id, invoiceId)),
  );
  if (
    !orig ||
    orig.kind !== "invoice" ||
    !orig.providerId ||
    !["issued", "accepted"].includes(orig.status)
  )
    throw new Error("Solo se puede acreditar una factura emitida");
  const [pay] = await withPlatform(plat("billing.invoice.read", orig.tenantId), (tx) =>
    tx.select().from(payment).where(eq(payment.id, orig.paymentId)),
  );
  const [row] = await withPlatform(
    { actorId, action: "billing.credit_note.create", tenantId: orig.tenantId, audit: true },
    (tx) =>
      tx
        .insert(invoice)
        .values({
          tenantId: orig.tenantId,
          paymentId: orig.paymentId,
          kind: "credit_note",
          refInvoiceId: orig.id,
          reason,
          totalCents: orig.totalCents,
        })
        .onConflictDoNothing()
        .returning(),
  );
  if (!row) throw new Error("Ya existe una nota crédito para este pago");
  const rateBp = pay.netCents > 0n ? Math.round(Number((pay.vatCents * 10000n) / pay.netCents)) : 0;
  try {
    const doc = await provider.issueCreditNote({
      idempotencyKey: `credit-${pay.id}`,
      date: bogotaDate(now),
      invoiceProviderId: orig.providerId,
      reason,
      lines: [
        {
          description: `Anulación suscripción SST — ${reason}`,
          netCents: pay.netCents,
          vatRateBp: rateBp,
        },
      ],
    });
    return await applyDoc(row, doc, provider, now);
  } catch (e) {
    return fail(row, e, now);
  }
}

export const invoiceSummary = (i: Pick<Invoice, "number" | "totalCents">) =>
  `${i.number ?? "sin número"} · ${formatCOP(i.totalCents)}`;

/** Vista global del SUPER ADMIN: pagos con su factura, filtrable por estado de la factura o del pago. */
export async function listBillingOverview(
  opts: { invoiceStatus?: Invoice["status"]; limit?: number } = {},
) {
  return withPlatform({ actorId: SYSTEM, action: "billing.overview", audit: false }, (tx) =>
    tx
      .select({
        invoiceId: invoice.id,
        kind: invoice.kind,
        number: invoice.number,
        invoiceStatus: invoice.status,
        dianStatus: invoice.dianStatus,
        errors: invoice.errors,
        hasPdf: invoice.pdfSize,
        paymentId: payment.id,
        paymentStatus: payment.status,
        reference: payment.reference,
        totalCents: payment.totalCents,
        tenantId: payment.tenantId,
        tenantName: schema.tenant.tradeName,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .leftJoin(invoice, and(eq(invoice.paymentId, payment.id), eq(invoice.kind, "invoice")))
      .innerJoin(schema.tenant, eq(schema.tenant.id, payment.tenantId))
      .where(opts.invoiceStatus ? eq(invoice.status, opts.invoiceStatus) : undefined)
      .orderBy(desc(payment.createdAt))
      .limit(opts.limit ?? 200),
  );
}

/** Reintento manual de una factura rechazada/en error: se vuelve a poner en cola y se emite. */
export async function retryInvoice(
  invoiceId: string,
  actorId: string,
  provider: InvoicingProvider,
) {
  const [inv] = await withPlatform(
    { actorId, action: "billing.invoice.retry", audit: true },
    (tx) =>
      tx
        .update(invoice)
        .set({ status: "pending", attempts: 0, errors: null, updatedAt: new Date() })
        .where(
          and(
            eq(invoice.id, invoiceId),
            inArray(invoice.status, ["error", "rejected"]),
            eq(invoice.kind, "invoice"),
          ),
        )
        .returning(),
  );
  if (!inv) throw new Error("Solo se reintentan facturas rechazadas o en error");
  return processInvoice(inv.id, provider);
}

/** PDF para el SUPER ADMIN (auditado). */
export async function getInvoicePdfForPlatform(invoiceId: string, actorId: string) {
  return withPlatform({ actorId, action: "billing.invoice.pdf", audit: true }, async (tx) => {
    const [r] = await tx
      .select({ pdf: invoice.pdf, number: invoice.number })
      .from(invoice)
      .where(eq(invoice.id, invoiceId));
    return r?.pdf ? { pdf: r.pdf, number: r.number } : null;
  });
}
