import "server-only";
import { Resend } from "resend";

export type MailInput = { to: string; subject: string; html: string; from?: string };

/** Bandeja de salida en memoria cuando no hay Resend (desarrollo/CI): permite probar enlaces. */
export const devOutbox: MailInput[] = [];

/** Envía con Resend; sin RESEND_API_KEY (desarrollo/CI) imprime el correo en consola. */
export async function sendMail(input: MailInput): Promise<void> {
  const from = input.from ?? process.env.MAIL_FROM ?? "SST <no-reply@sst.zark.pro>";
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    devOutbox.push(input);
    if (devOutbox.length > 50) devOutbox.shift();
    const link = input.html.match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    console.info(
      `[mail:dev] to=${input.to} subject="${input.subject}"${link ? `\n  ${link}` : ""}`,
    );
    return;
  }
  const { error } = await new Resend(key).emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
