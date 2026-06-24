import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const BLACK = rgb(0.08, 0.08, 0.08);
const GRAY = rgb(0.314, 0.314, 0.314);        // #505050
const LIGHT_GRAY = rgb(0.961, 0.961, 0.961);
const WHITE = rgb(1, 1, 1);
const LIGHT_RED = rgb(1, 0.804, 0.824);       // #ffcdd2
const BORDER = rgb(0.824, 0.824, 0.824);

async function buildPDF(formData: { label: string; value: string }[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const W = 612, H = 792;
  const ML = 36;
  const contentW = W - ML * 2;
  const COL_LABEL = 190;
  const COL_VALUE = contentW - COL_LABEL;

  let page = pdfDoc.addPage([W, H]);
  // pdf-lib: (0,0) is bottom-left, y increases upward
  let y = H - 48;

  const newPage = () => {
    page = pdfDoc.addPage([W, H]);
    y = H - 48;
  };

  const checkY = (needed: number) => { if (y - needed < 40) newPage(); };

  // Logo centered at top, correct aspect ratio
  let logoImage = null, logoW = 0, logoH = 0;
  try {
    const bytes = fs.readFileSync(path.join(process.cwd(), "public", "agiloc-logo.png"));
    logoImage = await pdfDoc.embedPng(bytes);
    const dims = logoImage.scale(1);
    logoH = 52;
    logoW = (dims.width / dims.height) * logoH;
  } catch { /* skip */ }

  if (logoImage) {
    page.drawImage(logoImage, { x: (W - logoW) / 2, y: y - logoH, width: logoW, height: logoH });
    y -= logoH + 14;
  }

  // Thin gray rule above title
  page.drawLine({ start: { x: ML, y }, end: { x: ML + contentW, y }, thickness: 0.5, color: BORDER });
  y -= 22;

  // Title
  const title = "Importer Security Filing";
  const titleW = bold.widthOfTextAtSize(title, 16.5);
  page.drawText(title, { x: (W - titleW) / 2, y, font: bold, size: 16.5, color: GRAY });
  y -= 16;

  // Subtitle
  const sub = "10+2 Form";
  const subW = regular.widthOfTextAtSize(sub, 10);
  page.drawText(sub, { x: (W - subW) / 2, y, font: regular, size: 10, color: GRAY });
  y -= 18;

  const drawSectionHeader = (title: string) => {
    checkY(28);
    y -= 4;
    page.drawRectangle({ x: ML, y: y - 22, width: contentW, height: 22, color: LIGHT_RED });
    page.drawText(title.toUpperCase(), { x: ML + 8, y: y - 15, font: bold, size: 8.8, color: GRAY });
    y -= 22;
  };

  const wrapText = (text: string, maxW: number, size: number, font: typeof regular): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  let shade = false;
  const drawRow = (label: string, value: string) => {
    const displayVal = value.trim() || "—";
    const fontSize = 9.5;
    const lineH = fontSize * 1.45;
    const valLines = wrapText(displayVal, COL_VALUE - 14, fontSize, regular);
    const rowH = Math.max(26, valLines.length * lineH + 18);
    checkY(rowH);

    const rowY = y - rowH;
    if (shade) page.drawRectangle({ x: ML, y: rowY, width: contentW, height: rowH, color: LIGHT_GRAY });
    page.drawRectangle({ x: ML, y: rowY, width: contentW, height: rowH, borderColor: BORDER, borderWidth: 0.5 });
    page.drawLine({ start: { x: ML + COL_LABEL, y: rowY }, end: { x: ML + COL_LABEL, y: rowY + rowH }, thickness: 0.5, color: BORDER });

    // Label — vertically centered
    const labelFontSize = 7.5;
    const labelLines = wrapText(label.toUpperCase(), COL_LABEL - 14, labelFontSize, bold);
    const labelBlockH = labelLines.length * (labelFontSize * 1.4);
    const labelStartY = rowY + rowH / 2 + labelBlockH / 2 - labelFontSize;
    labelLines.forEach((ln, i) => {
      page.drawText(ln, { x: ML + 7, y: labelStartY - i * (labelFontSize * 1.4), font: bold, size: 8.25, color: GRAY });
    });

    // Value
    valLines.forEach((ln, i) => {
      page.drawText(ln, { x: ML + COL_LABEL + 8, y: rowY + rowH - 14 - i * lineH, font: regular, size: 10.45, color: GRAY });
    });

    y -= rowH;
    shade = !shade;
  };

  // Filing info rows
  const mfgStartIdx = formData.findIndex(r => /^manufacturer/i.test(r.label));
  const filingRows = mfgStartIdx === -1 ? formData : formData.slice(0, mfgStartIdx);

  drawSectionHeader("Filing Information");
  shade = false;
  filingRows.forEach(({ label, value }) => drawRow(label, value));

  if (mfgStartIdx !== -1) {
    const mfgRows = formData.slice(mfgStartIdx);
    let currentMfg = -1;
    const mfgCount = mfgRows.filter(r => /^manufacturer/i.test(r.label)).length;
    for (const { label, value } of mfgRows) {
      if (/^manufacturer/i.test(label)) {
        currentMfg++;
        drawSectionHeader(mfgCount > 1 ? `Manufacturer ${currentMfg + 1}` : "Manufacturer");
        shade = false;
        drawRow("Name & Address", value);
      } else {
        drawRow(label, value);
      }
    }
  }

  // Footer below table
  y -= 20;
  const footer = "© Agiloc International";
  const footerW = regular.widthOfTextAtSize(footer, 8.8);
  page.drawText(footer, { x: (W - footerW) / 2, y, font: regular, size: 8.8, color: GRAY });

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
        ? `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.7;color:#222;max-width:600px;margin:0 auto;padding:32px 0;">
            <p style="margin:0 0 20px;">${(message as string).replace(/\n/g, "<br/>")}</p>
            <p style="margin:0;font-size:12px;color:#888;border-top:1px solid #eee;padding-top:16px;">Agiloc International — ISF Filing System</p>
           </div>`
        : `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#222;max-width:600px;margin:0 auto;padding:32px 0;">
            <p>Please find the attached Importer Security Filing (10+2 Form) from Agiloc International.</p>
            <p style="margin:0;font-size:12px;color:#888;border-top:1px solid #eee;padding-top:16px;">Agiloc International — ISF Filing System</p>
           </div>`,
      attachments: [{ filename: "ISF_Form_10plus2.pdf", content: Buffer.from(pdfBytes) }],
    });

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
