import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const runtime = "nodejs";

async function buildPDF(formData: { label: string; value: string }[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const colLabel = 190;
  const colValue = pageWidth - margin * 2 - colLabel;
  const accent = rgb(0.643, 0.157, 0.157);
  const lightRed = rgb(0.992, 0.949, 0.949);
  const white = rgb(1, 1, 1);
  const dark = rgb(0.118, 0.118, 0.118);
  const borderColor = rgb(0.863, 0.824, 0.824);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight;

  // Header
  page.drawRectangle({ x: 0, y: pageHeight - 72, width: pageWidth, height: 72, color: accent });
  page.drawText("IMPORTER SECURITY FILING FORM (10+2 FORM)", {
    x: margin, y: pageHeight - 30, font: boldFont, size: 13, color: white,
    maxWidth: pageWidth - margin * 2,
  });
  page.drawText("Agiloc International", { x: margin, y: pageHeight - 48, font: regularFont, size: 9, color: rgb(1, 0.85, 0.85) });
  page.drawText(`Generated: ${new Date().toLocaleDateString()}`, { x: margin, y: pageHeight - 62, font: regularFont, size: 8, color: rgb(1, 0.85, 0.85) });

  y = pageHeight - 88;

  const drawRow = (label: string, value: string, shade: boolean) => {
    const displayValue = value || "(not provided)";
    const fontSize = 9.5;
    const lineHeight = fontSize * 1.35;
    const maxValueWidth = colValue - 16;

    // Wrap value text
    const words = displayValue.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = regularFont.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > maxValueWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const rowHeight = Math.max(24, lines.length * lineHeight + 14);

    if (y - rowHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    const rowY = y - rowHeight;

    // Background
    page.drawRectangle({ x: margin, y: rowY, width: pageWidth - margin * 2, height: rowHeight, color: shade ? lightRed : white });

    // Border
    page.drawRectangle({ x: margin, y: rowY, width: pageWidth - margin * 2, height: rowHeight, borderColor, borderWidth: 0.5 });

    // Column divider
    page.drawLine({ start: { x: margin + colLabel, y: rowY }, end: { x: margin + colLabel, y: rowY + rowHeight }, thickness: 0.5, color: borderColor });

    // Label
    const labelFontSize = 7.5;
    const labelText = label.toUpperCase();
    page.drawText(labelText, {
      x: margin + 6,
      y: rowY + rowHeight / 2 - labelFontSize / 2,
      font: boldFont,
      size: labelFontSize,
      color: accent,
      maxWidth: colLabel - 12,
    });

    // Value lines
    lines.forEach((line, idx) => {
      page.drawText(line, {
        x: margin + colLabel + 8,
        y: rowY + rowHeight - 14 - idx * lineHeight,
        font: regularFont,
        size: fontSize,
        color: dark,
      });
    });

    y -= rowHeight;
  };

  let shade = false;
  for (const { label, value } of formData) {
    drawRow(label, value, shade);
    shade = !shade;
  }

  // Footer on last page
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 28, color: rgb(0.97, 0.97, 0.97) });
  page.drawText("© Agiloc International — Confidential", {
    x: pageWidth / 2 - 80, y: 9, font: regularFont, size: 8, color: rgb(0.6, 0.6, 0.6),
  });

  return pdfDoc.save();
}

export async function POST(req: NextRequest) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { to, message, formData } = await req.json();

    const pdfBytes = await buildPDF(formData as { label: string; value: string }[]);

    const { error } = await resend.emails.send({
      from: "ISF Form <isf@agiloc.com>",
      to: (to as string).split(",").map((e: string) => e.trim()),
      subject: "Importer Security Filing (10+2 Form) — Agiloc International",
      html: message
        ? `<div style="font-family:Georgia,serif;font-size:14px;line-height:1.7;color:#222;max-width:600px;margin:0 auto;padding:32px 0;">
            <p style="margin:0 0 20px;">${(message as string).replace(/\n/g, "<br/>")}</p>
            <p style="margin:0;font-size:12px;color:#888;border-top:1px solid #eee;padding-top:16px;">Agiloc International &mdash; ISF Filing System</p>
           </div>`
        : `<div style="font-family:Georgia,serif;font-size:14px;color:#222;max-width:600px;margin:0 auto;padding:32px 0;">
            <p>Please find the attached Importer Security Filing (10+2 Form) from Agiloc International.</p>
            <p style="margin:0;font-size:12px;color:#888;border-top:1px solid #eee;padding-top:16px;">Agiloc International &mdash; ISF Filing System</p>
           </div>`,
      attachments: [
        {
          filename: "ISF_Form_10plus2.pdf",
          content: Buffer.from(pdfBytes),
        },
      ],
    });

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
