import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { to, message, formData } = await req.json();

  const fieldRows = (formData as { label: string; value: string }[])
    .map(({ label, value }) => `
      <tr>
        <td style="padding:8px 12px;background:#fdf2f2;font-size:11px;font-weight:700;color:#a42828;text-transform:uppercase;letter-spacing:1px;width:220px;vertical-align:top;border-bottom:1px solid #f0e0e0;">${label}</td>
        <td style="padding:8px 12px;font-size:13px;color:#222;vertical-align:top;border-bottom:1px solid #f0e0e0;white-space:pre-wrap;">${value || "(not provided)"}</td>
      </tr>`)
    .join("");

  const html = `
    <div style="font-family:'Segoe UI',system-ui,sans-serif;max-width:680px;margin:0 auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
      <div style="background:#a42828;padding:20px 28px;text-align:center;">
        <p style="color:#fff;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px;opacity:0.85;">Agiloc International</p>
        <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;">IMPORTER SECURITY FILING FORM (10+2 FORM)</h1>
      </div>
      ${message ? `<div style="padding:16px 28px;background:#fffaf8;border-bottom:1px solid #f0e0e0;font-size:13px;color:#444;">${message}</div>` : ""}
      <table style="width:100%;border-collapse:collapse;">${fieldRows}</table>
      <div style="padding:14px 28px;background:#f9f9f9;text-align:center;font-size:11px;color:#aaa;">
        © Agiloc International
      </div>
    </div>`;

  const { error } = await resend.emails.send({
    from: "ISF Form <isf@agiloc.com>",
    to: to.split(",").map((e: string) => e.trim()),
    subject: "Importer Security Filing (10+2 Form)",
    html,
  });

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
