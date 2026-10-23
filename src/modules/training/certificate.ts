import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type CertificateInput = {
  companyName: string;
  brandHex: string;
  workerName: string;
  documentLast4: string;
  courseName: string;
  date: string;
  hours: string | null;
  score: number | null;
  trainer: string | null;
  evidenceHash: string;
};

const hexToRgb = (hex: string) => {
  const n = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#0f766e";
  return rgb(
    parseInt(n.slice(1, 3), 16) / 255,
    parseInt(n.slice(3, 5), 16) / 255,
    parseInt(n.slice(5, 7), 16) / 255,
  );
};

/** Certificado de asistencia/aprobación en PDF (A4 horizontal) con el color de marca de la empresa y la huella de la evidencia. */
export async function buildCertificate(c: CertificateInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const brand = hexToRgb(c.brandHex);
  const { width, height } = page.getSize();
  const center = (text: string, y: number, size: number, f = font, color = rgb(0.1, 0.1, 0.1)) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font: f, color });
  };
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: brand,
    borderWidth: 4,
  });
  center(c.companyName, height - 90, 20, bold, brand);
  center("CERTIFICADO DE CAPACITACIÓN", height - 150, 30, bold);
  center("Se certifica que", height - 200, 14);
  center(c.workerName, height - 245, 28, bold, brand);
  center(`Documento terminado en ${c.documentLast4}`, height - 270, 11);
  center("asistió y aprobó el curso", height - 315, 14);
  center(c.courseName, height - 350, 22, bold);
  const detail = [
    `Fecha: ${c.date}`,
    c.hours ? `Intensidad: ${c.hours} horas` : null,
    c.score !== null ? `Evaluación: ${c.score}/100` : null,
    c.trainer ? `Capacitador: ${c.trainer}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");
  center(detail, height - 395, 12);
  center(
    `Código de verificación: ${c.evidenceHash.slice(0, 16).toUpperCase()}`,
    70,
    9,
    font,
    rgb(0.4, 0.4, 0.4),
  );
  center(
    "Asistencia registrada con firma electrónica simple (Ley 527 de 1999, Decreto 2364 de 2012).",
    56,
    8,
    font,
    rgb(0.4, 0.4, 0.4),
  );
  return pdf.save();
}
