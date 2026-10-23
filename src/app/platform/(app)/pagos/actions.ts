"use server";
import { revalidatePath } from "next/cache";
import { requirePlatformStaff } from "@/core/auth/session";
import { getInvoicingProvider } from "@/integrations/invoicing";
import { issueCreditNote, retryInvoice } from "@/modules/billing/invoicing";

export async function retryInvoiceAction(invoiceId: string) {
  const staff = await requirePlatformStaff({ allow: ["SUPER_ADMIN"] });
  await retryInvoice(invoiceId, staff.user.id, getInvoicingProvider());
  revalidatePath("/pagos");
}

export async function creditNoteAction(invoiceId: string, formData: FormData) {
  const staff = await requirePlatformStaff({ allow: ["SUPER_ADMIN"] });
  const reason = String(formData.get("reason") ?? "").trim() || "Reembolso";
  await issueCreditNote(invoiceId, reason, staff.user.id, getInvoicingProvider());
  revalidatePath("/pagos");
}
