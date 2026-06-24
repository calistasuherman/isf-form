import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const BLACK = rgb(0.08, 0.08, 0.08);
const DARK_GRAY = rgb(0.35, 0.35, 0.35);
const MID_GRAY = rgb(0.6, 0.6, 0.6);
const LIGHT_GRAY = rgb(0.94, 0.94, 0.94);
const WHITE = rgb(1, 1, 1);
const ACCENT = rgb(0.545, 0.098, 0.098);
const RULE = rgb(0.82, 0.82, 0.82);

async function buildPDF(formData: { label: string; value: string }[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const oblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const W = 612, H = 792;
  const ML = 56, MR = 56, MT = 56, MB = 48;
  const contentW = W - ML - MR;

  let page = pdfDoc.addPage([W, H]);
  let y = H - MT;

  const newPage = () => {
    page = pdfDoc.addPage([W, H]);
    y = H - MT;
    drawPageNum();
  };

  const pageNums: (() => void)[] = [];
  const drawPageNum = () => {
    const n = pdfDoc.getPageCount();
    pageNums.push(() => {
      page.drawText(`Page ${n}`, { x: W - MR - 40, y: MB - 16, font: regular, size: 7.5, color: MID_GRAY });
    });
  };

  const checkY = (needed: number) => { if (y - needed < MB + 20) newPage(); };

  const rule = (x: number, rY: number, w: number, thickness = 0.5, color = RULE) => {
    page.drawLine({ start: { x, y: rY }, end: { x: x + w, y: rY }, thickness, color });
  };

  // ── HEADER ──────────────────────────────────────────────────────────────
  let logoImage = null, logoW = 0, logoH = 0;
  try {
    const bytes = fs.readFileSync(path.join(process.cwd(), "public", "agiloc-logo.jpg"));
    logoImage = await pdfDoc.embedJpg(bytes);
    const dims = logoImage.scale(1);
    logoH = 52;
    logoW = (dims.width / dims.height) * logoH;
  } catch { /* no logo */ }

  if (logoImage) {
    page.drawImage(logoImage, { x: (W - logoW) / 2, y: y - logoH, width: logoW, height: logoH });
    y -= logoH + 14;
  }

  // Thin rule under logo
  rule(ML, y, contentW, 0.75, ACCENT);
  y -= 14;

  // Title
  const title = "IMPORTER SECURITY FILING";
  const titleW = bold.widthOfTextAtSize(title, 15);
  page.drawText(title, { x: (W - titleW) / 2, y, font: bold, size: 15, color: BLACK });
  y -= 14;

  const sub = "Form 10+2  •  U.S. Customs & Border Protection";
  const subW = regular.widthOfTextAtSize(sub, 8.5);
  page.drawText(sub, { x: (W - subW) / 2, y, font: regular, size: 8.5, color: MID_GRAY });
  y -= 8;

  rule(ML, y, contentW, 0.5, RULE);
  y -= 6;

  // Date right-aligned
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  page.drawText(dateStr, { x: W - MR - regular.widthOfTextAtSize(dateStr, 8), y, font: regular, size: 8, color: MID_GRAY });
  y -= 22;

  // ── ROWS ─────────────────────────────────────────────────────────────────
  const COL_LABEL = 190;
  const COL_VALUE = contentW - COL_LABEL;
  const LABEL_SIZE = 7.5;
  const VALUE_SIZE = 9.5;
  const LINE_H = VALUE_SIZE * 1.45;
  const ROW_PAD_V = 9;

  let rowShade = false;

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

  const drawSectionHeader = (title: string) => {
    checkY(26);
    y -= 6;
    page.drawRectangle({ x: ML, y: y - 20, width: contentW, height: 20, color: BLACK });
    page.drawText(title.toUpperCase(), { x: ML + 8, y: y - 14, font: bold, size: 7.5, color: WHITE, characterSpacing: 0.8 });
    y -= 20;
    rowShade = false;
  };

  const drawRow = (label: string, value: string) => {
    const displayVal = value.trim() || "—";
    const valLines = wrapText(displayVal, COL_VALUE - 14, VALUE_SIZE, regular);
    const rowH = Math.max(ROW_PAD_V * 2 + VALUE_SIZE, valLines.length * LINE_H + ROW_PAD_V * 2);

    checkY(rowH);

    const rowY = y - rowH;
    if (rowShade) page.drawRectangle({ x: ML, y: rowY, width: contentW, height: rowH, color: LIGHT_GRAY });

    // bottom rule
    rule(ML, rowY, contentW);
    // column divider
    page.drawLine({ start: { x: ML + COL_LABEL, y: rowY }, end: { x: ML + COL_LABEL, y: y }, thickness: 0.5, color: RULE });

    // Label — wrap if needed
    const labelLines = wrapText(label, COL_LABEL - 14, LABEL_SIZE, bold);
    const labelBlockH = labelLines.length * (LABEL_SIZE * 1.4);
    const labelStartY = rowY + rowH / 2 + labelBlockH / 2 - LABEL_SIZE;
    labelLines.forEach((ln, i) => {
      page.drawText(ln.toUpperCase(), { x: ML + 7, y: labelStartY - i * (LABEL_SIZE * 1.4), font: bold, size: LABEL_SIZE, color: DARK_GRAY, characterSpacing: 0.3 });
    });

    // Value
    valLines.forEach((ln, i) => {
      page.drawText(ln, { x: ML + COL_LABEL + 8, y: y - ROW_PAD_V - VALUE_SIZE - i * LINE_H, font: regular, size: VALUE_SIZE, color: BLACK });
    });

    y -= rowH;
    rowShade = !rowShade;
  };

  // ── CONTENT ───────────────────────────────────────────────────────────────
  drawSectionHeader("Filing Information");
  const mfgStartIdx = formData.findIndex(r => /^manufacturer/i.test(r.label));
  const filingRows = mfgStartIdx === -1 ? formData : formData.slice(0, mfgStartIdx);
  filingRows.forEach(({ label, value }) => drawRow(label, value));

  if (mfgStartIdx !== -1) {
    // Group manufacturer rows
    const mfgRows = formData.slice(mfgStartIdx);
    let currentMfg = -1;
    for (const { label, value } of mfgRows) {
      if (/^manufacturer/i.test(label)) {
        currentMfg++;
        const mfgCount = mfgRows.filter(r => /^manufacturer/i.test(r.label)).length;
        drawSectionHeader(mfgCount > 1 ? `Manufacturer ${currentMfg + 1}` : "Manufacturer");
        drawRow("Name & Address", value);
      } else {
        drawRow(label, value);
      }
    }
  }

  // Bottom rule
  y -= 4;
  rule(ML, y, contentW, 0.75, ACCENT);

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footer = "Agiloc International  •  Confidential";
  const footerW = oblique.widthOfTextAtSize(footer, 7.5);
  page.drawText(footer, { x: (W - footerW) / 2, y: MB - 8, font: oblique, size: 7.5, color: MID_GRAY });

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
