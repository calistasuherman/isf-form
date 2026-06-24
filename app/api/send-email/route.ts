import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

async function buildPDF(formData: { label: string; value: string }[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const colLabel = 230;
  const colValue = pageWidth - margin * 2 - colLabel;
  const white = rgb(1, 1, 1);
  const dark = rgb(0.118, 0.118, 0.118);
  const lightGray = rgb(0.961, 0.961, 0.961);
  const borderColor = rgb(0.824, 0.824, 0.824);
  const accent = rgb(0.643, 0.157, 0.157);

  // Try to embed logo
  let logoImage = null;
  let logoWidth = 0, logoHeight = 0;
  try {
    const logoPath = path.join(process.cwd(), "public", "agiloc-logo.jpg");
    const logoBytes = fs.readFileSync(logoPath);
    logoImage = await pdfDoc.embedJpg(logoBytes);
    const logoDims = logoImage.scale(1);
    const maxLogoH = 70;
    const scale = maxLogoH / logoDims.height;
    logoWidth = logoDims.width * scale;
    logoHeight = maxLogoH;
  } catch { /* skip logo if unavailable */ }

  const headerH = logoImage ? 90 : 60;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight;

  // Header
  page.drawRectangle({ x: 0, y: pageHeight - headerH, width: pageWidth, height: headerH, color: accent });

  if (logoImage) {
    page.drawImage(logoImage, { x: margin, y: pageHeight - headerH + 10, width: logoWidth, height: logoHeight });
  }

  const textX = logoImage ? margin + logoWidth + 12 : pageWidth / 2;
  page.drawText("IMPORTER SECURITY FILING FORM (10+2 FORM)", {
    x: textX,
    y: pageHeight - 32,
    font: boldFont,
    size: 13,
    color: white,
    maxWidth: pageWidth - textX - margin,
  });
  page.drawText(new Date().toLocaleDateString(), {
    x: textX,
    y: pageHeight - 50,
    font: regularFont,
    size: 8,
    color: rgb(1, 0.9, 0.9),
  });

  y = pageHeight - headerH - 16;

  const drawSectionHeader = (title: string) => {
    if (y - 22 < margin) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }
    page.drawRectangle({ x: margin, y: y - 22, width: pageWidth - margin * 2, height: 22, color: dark });
    page.drawText(title.toUpperCase(), { x: margin + 8, y: y - 15, font: boldFont, size: 8, color: white });
    y -= 22;
  };

  const drawRow = (label: string, value: string, shade: boolean) => {
    const displayValue = value || "(not provided)";
    const fontSize = 9.5;
    const lineHeight = fontSize * 1.35;
    const maxValueWidth = colValue - 16;

    const words = displayValue.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (regularFont.widthOfTextAtSize(testLine, fontSize) > maxValueWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const rowHeight = Math.max(24, lines.length * lineHeight + 14);
    if (y - rowHeight < margin) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }

    const rowY = y - rowHeight;
    page.drawRectangle({ x: margin, y: rowY, width: pageWidth - margin * 2, height: rowHeight, color: shade ? lightGray : white });
    page.drawRectangle({ x: margin, y: rowY, width: pageWidth - margin * 2, height: rowHeight, borderColor, borderWidth: 0.5 });
    page.drawLine({ start: { x: margin + colLabel, y: rowY }, end: { x: margin + colLabel, y: rowY + rowHeight }, thickness: 0.5, color: borderColor });

    page.drawText(label.toUpperCase(), {
      x: margin + 6, y: rowY + rowHeight / 2 - 4,
      font: boldFont, size: 7.5, color: dark, maxWidth: colLabel - 12,
    });

    lines.forEach((line, idx) => {
      page.drawText(line, {
        x: margin + colLabel + 8,
        y: rowY + rowHeight - 14 - idx * lineHeight,
        font: regularFont, size: fontSize, color: dark,
      });
    });

    y -= rowHeight;
  };

  // Group formData into filing info and manufacturers
  // The formData comes as flat rows — find manufacturer section headers by label pattern
  let inManufacturer = false;
  let mfgIndex = 0;
  let shade = false;

  drawSectionHeader("Filing Information");

  for (const { label, value } of formData) {
    const isManufacturer = /^manufacturer/i.test(label);
    if (isManufacturer && !inManufacturer) {
      mfgIndex++;
      drawSectionHeader(`Manufacturer ${mfgIndex}`);
      shade = false;
      inManufacturer = true;
    } else if (!isManufacturer && /^item description/i.test(label) && !inManufacturer) {
      // item description without preceding manufacturer header — still in same group
    } else if (!isManufacturer && !/^item description/i.test(label)) {
      inManufacturer = false;
    }
    drawRow(label, value, shade);
    shade = !shade;
  }

  // Footer
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 24, color: rgb(0.95, 0.95, 0.95) });
  page.drawText("© Agiloc International — Confidential", {
    x: pageWidth / 2 - 75, y: 7, font: regularFont, size: 7.5, color: rgb(0.5, 0.5, 0.5),
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
