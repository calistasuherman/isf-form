"use client";

import { useState, useRef } from "react";

const ACCENT = "#8B1A1A";
const ACCENT_LIGHT = "#fdf4f4";

interface Manufacturer {
  name: string;
  itemDescriptions: string[];
}

interface FormData {
  importer: string;
  masterBOL: string;
  houseBOL: string;
  scacCode: string;
  containerNum: string;
  seller: string;
  buyer: string;
  shipTo: string;
  stuffingLocation: string;
  consolidator: string;
  manufacturers: Manufacturer[];
  packingList: File | null;
}

const INITIAL: FormData = {
  importer: "",
  masterBOL: "",
  houseBOL: "",
  scacCode: "",
  containerNum: "",
  seller: "",
  buyer: "",
  shipTo: "",
  stuffingLocation: "",
  consolidator: "",
  manufacturers: [{ name: "", itemDescriptions: [""] }],
  packingList: null,
};

const BASIC_FIELDS: { key: keyof Omit<FormData, "packingList" | "manufacturers">; label: string; multiline?: boolean }[] = [
  { key: "importer", label: "Importer", multiline: true },
  { key: "masterBOL", label: "Master BOL #" },
  { key: "houseBOL", label: "House BOL #" },
  { key: "scacCode", label: "SCAC Code" },
  { key: "containerNum", label: "Container #" },
  { key: "seller", label: "Seller", multiline: true },
  { key: "buyer", label: "Buyer", multiline: true },
  { key: "shipTo", label: "Ship To", multiline: true },
  { key: "stuffingLocation", label: "Container Stuffing Location", multiline: true },
  { key: "consolidator", label: "Consolidator", multiline: true },
];

export default function ISFForm() {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [packingFileName, setPackingFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleChange(key: keyof Omit<FormData, "packingList" | "manufacturers">, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleManufacturerName(index: number, value: string) {
    setForm((f) => {
      const updated = [...f.manufacturers];
      updated[index] = { ...updated[index], name: value };
      return { ...f, manufacturers: updated };
    });
  }

  function handleItemDescription(mfgIndex: number, itemIndex: number, value: string) {
    setForm((f) => {
      const updated = [...f.manufacturers];
      const items = [...updated[mfgIndex].itemDescriptions];
      items[itemIndex] = value;
      updated[mfgIndex] = { ...updated[mfgIndex], itemDescriptions: items };
      return { ...f, manufacturers: updated };
    });
  }

  function addItemDescription(mfgIndex: number) {
    setForm((f) => {
      const updated = [...f.manufacturers];
      updated[mfgIndex] = { ...updated[mfgIndex], itemDescriptions: [...updated[mfgIndex].itemDescriptions, ""] };
      return { ...f, manufacturers: updated };
    });
  }

  function removeItemDescription(mfgIndex: number, itemIndex: number) {
    setForm((f) => {
      const updated = [...f.manufacturers];
      updated[mfgIndex] = { ...updated[mfgIndex], itemDescriptions: updated[mfgIndex].itemDescriptions.filter((_, i) => i !== itemIndex) };
      return { ...f, manufacturers: updated };
    });
  }

  function addManufacturer() {
    setForm((f) => ({ ...f, manufacturers: [...f.manufacturers, { name: "", itemDescriptions: [""] }] }));
  }

  function removeManufacturer(index: number) {
    setForm((f) => ({ ...f, manufacturers: f.manufacturers.filter((_, i) => i !== index) }));
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setForm((f) => ({ ...f, packingList: file }));
    setPackingFileName(file?.name ?? "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  function buildFormDataRows() {
    const rows: { label: string; value: string }[] = [];
    BASIC_FIELDS.forEach(({ key, label }) => rows.push({ label, value: form[key] }));
    form.manufacturers.forEach((m, i) => {
      rows.push({ label: `Manufacturer${form.manufacturers.length > 1 ? ` ${i + 1}` : ""} (Name & Address)`, value: m.name });
      m.itemDescriptions.forEach((d, j) => {
        rows.push({ label: `Item Description${m.itemDescriptions.length > 1 ? ` ${j + 1}` : ""}`, value: d });
      });
    });
    return rows;
  }

  async function handleSendEmail() {
    setEmailSending(true);
    setEmailError("");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo, message: emailMessage, formData: buildFormDataRows() }),
      });
      if (!res.ok) throw new Error("Failed to send");
      setEmailSent(true);
    } catch {
      setEmailError("Failed to send email. Please try again.");
    } finally {
      setEmailSending(false);
    }
  }

  async function handleGeneratePDF() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });

    const ML = 56, MB = 48;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentW = pageWidth - ML * 2;
    const COL_LABEL = 190;
    const COL_VALUE = contentW - COL_LABEL;
    let y = pageHeight - 56;

    const checkY = (needed: number) => {
      if (y - needed < MB + 20) { doc.addPage(); y = pageHeight - 56; }
    };

    const rule = (rY: number, thickness = 0.5, r = 210, g = 210, b = 210) => {
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(thickness);
      doc.line(ML, rY, ML + contentW, rY);
    };

    // Logo centered
    let logoDataUrl: string | null = null;
    try {
      const resp = await fetch("/agiloc-logo.png");
      const blob = await resp.blob();
      logoDataUrl = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { /* skip */ }

    if (logoDataUrl) {
      const logoH = 52;
      const logoW = logoH * 2.8;
      doc.addImage(logoDataUrl, "PNG", (pageWidth - logoW) / 2, y - logoH, logoW, logoH);
      y -= logoH + 14;
    }

    // Red rule
    doc.setDrawColor(139, 25, 25);
    doc.setLineWidth(0.75);
    doc.line(ML, y, ML + contentW, y);
    y -= 14;

    // Title
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text("IMPORTER SECURITY FILING", pageWidth / 2, y, { align: "center" });
    y -= 13;

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text("Form 10+2  •  U.S. Customs & Border Protection", pageWidth / 2, y, { align: "center" });
    y -= 8;

    rule(y);
    y -= 6;

    // Date right-aligned
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(dateStr, ML + contentW, y, { align: "right" });
    y -= 22;

    const drawSectionHeader = (title: string) => {
      checkY(26);
      y -= 6;
      doc.setFillColor(20, 20, 20);
      doc.rect(ML, y - 20, contentW, 20, "F");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(title.toUpperCase(), ML + 8, y - 7);
      y -= 20;
    };

    let shade = false;
    const drawRow = (label: string, value: string) => {
      const valLines = doc.splitTextToSize(value.trim() || "—", COL_VALUE - 14);
      const rowH = Math.max(26, valLines.length * 13.8 + 18);
      checkY(rowH);

      if (shade) { doc.setFillColor(240, 240, 240); doc.rect(ML, y - rowH, contentW, rowH, "F"); }
      rule(y - rowH);
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.5);
      doc.line(ML + COL_LABEL, y - rowH, ML + COL_LABEL, y);

      const labelLines = doc.splitTextToSize(label.toUpperCase(), COL_LABEL - 14);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(90, 90, 90);
      const labelY = y - rowH / 2 + (labelLines.length * 7.5) / 2;
      doc.text(labelLines, ML + 7, labelY);

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(20, 20, 20);
      doc.text(valLines, ML + COL_LABEL + 8, y - rowH + 14);

      y -= rowH;
      shade = !shade;
    };

    drawSectionHeader("Filing Information");
    shade = false;
    BASIC_FIELDS.forEach(({ key, label }) => drawRow(label, form[key]));

    form.manufacturers.forEach((m, i) => {
      drawSectionHeader(`Manufacturer${form.manufacturers.length > 1 ? ` ${i + 1}` : ""}`);
      shade = false;
      drawRow("Name & Address", m.name);
      m.itemDescriptions.forEach((desc, j) => {
        drawRow(`Item Description${m.itemDescriptions.length > 1 ? ` ${j + 1}` : ""}`, desc);
      });
    });

    y -= 4;
    doc.setDrawColor(139, 25, 25);
    doc.setLineWidth(0.75);
    doc.line(ML, y, ML + contentW, y);

    // Footer
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "oblique");
    doc.setTextColor(150, 150, 150);
    doc.text("Agiloc International  •  Confidential", pageWidth / 2, MB - 8, { align: "center" });

    const bol = form.masterBOL || form.houseBOL || "Form";
    doc.save(`ISF_${bol}.pdf`);
  }

  function handleReset() {
    setForm(INITIAL);
    setSubmitted(false);
    setEmailTo("");
    setEmailMessage("");
    setPackingFileName("");
    setEmailSent(false);
    setEmailError("");
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        input, textarea, button { font-family: inherit; }
        .field-input {
          width: 100%;
          padding: 10px 13px;
          border: 1px solid #d8d8d8;
          border-radius: 7px;
          font-size: 13.5px;
          color: #1a1a1a;
          background: #fafafa;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
        }
        .field-input:focus {
          border-color: ${ACCENT};
          background: #fff;
          box-shadow: 0 0 0 3px rgba(139,26,26,0.09), inset 0 1px 3px rgba(0,0,0,0.03);
        }
        textarea.field-input { resize: vertical; }
        .btn-primary {
          padding: 10px 24px;
          background: linear-gradient(135deg, ${ACCENT} 0%, #6e1414 100%);
          color: #fff;
          border: none;
          border-radius: 7px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.2px;
          transition: opacity 0.15s, box-shadow 0.15s, transform 0.1s;
          box-shadow: 0 2px 8px rgba(139,26,26,0.3), 0 1px 2px rgba(0,0,0,0.1);
        }
        .btn-primary:hover { opacity: 0.92; box-shadow: 0 4px 16px rgba(139,26,26,0.35), 0 1px 4px rgba(0,0,0,0.12); transform: translateY(-1px); }
        .btn-primary:active { transform: translateY(0); box-shadow: 0 1px 4px rgba(139,26,26,0.3); }
        .btn-primary:disabled { background: #ccc; cursor: not-allowed; box-shadow: none; transform: none; }
        .btn-outline {
          padding: 10px 24px;
          background: #fff;
          color: ${ACCENT};
          border: 1.5px solid ${ACCENT};
          border-radius: 7px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .btn-outline:hover { background: ${ACCENT_LIGHT}; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transform: translateY(-1px); }
        .btn-outline:active { transform: translateY(0); }
        .section-card {
          background: #fff;
          border: 1px solid #e4e4e4;
          border-radius: 12px;
          margin-bottom: 20px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
        }
        .section-title {
          padding: 14px 24px;
          border-bottom: 1px solid #f0f0f0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #999;
          background: linear-gradient(to bottom, #fafafa, #f6f6f6);
        }
        .section-body { padding: 22px 24px; }
        .field-label {
          display: block;
          font-size: 11.5px;
          font-weight: 600;
          color: #444;
          margin-bottom: 5px;
          letter-spacing: 0.1px;
        }
        .field-wrap { margin-bottom: 18px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; }
        .mfg-card {
          border: 1px solid #e4e4e4;
          border-radius: 9px;
          margin-bottom: 12px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .mfg-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: linear-gradient(to bottom, #f5f5f5, #f0f0f0);
          border-bottom: 1px solid #e8e8e8;
        }
        .mfg-header-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: #555;
        }
        .mfg-body { padding: 16px; }
        .remove-btn {
          background: none;
          border: none;
          color: #bbb;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
          padding: 0 2px;
          transition: color 0.1s;
        }
        .remove-btn:hover { color: #888; }
        .upload-zone {
          border: 1.5px dashed #d0d0d0;
          border-radius: 8px;
          padding: 16px 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          background: #fafafa;
        }
        .upload-zone:hover { border-color: ${ACCENT}; background: ${ACCENT_LIGHT}; box-shadow: 0 2px 8px rgba(139,26,26,0.08); }
        .upload-zone.has-file { border-color: ${ACCENT}; background: ${ACCENT_LIGHT}; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#fff" }}>
        {/* Header */}
        <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#f2f2f2", borderBottom: "1px solid #e0e0e0", height: 80, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/agiloc-logo.png" alt="Agiloc International" style={{ height: "100%", objectFit: "contain" }} />
        </div>

        <div style={{ maxWidth: 780, margin: "0 auto", padding: "36px 24px 80px" }}>
          {/* Page title */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111", letterSpacing: -0.3 }}>IMPORTER SECURITY FILING</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: submitted ? "#1a7a3a" : "#888" }}>{submitted ? "Successful" : "Complete all fields and submit. You can send the filing via email or download a PDF copy."}</p>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit}>
              {/* Shipment Details */}
              <div className="section-card">
                <div className="section-title">Shipment Details</div>
                <div className="section-body">
                  <div className="field-wrap">
                    <label className="field-label">Importer (Name & Address)</label>
                    <textarea className="field-input" rows={3} required value={form.importer} onChange={(e) => handleChange("importer", e.target.value)} placeholder="Company name and full address..." />
                  </div>
                  <div className="grid-2">
                    <div className="field-wrap">
                      <label className="field-label">Master BOL #</label>
                      <input className="field-input" type="text" required value={form.masterBOL} onChange={(e) => handleChange("masterBOL", e.target.value)} placeholder="e.g. MAEU123456789" />
                    </div>
                    <div className="field-wrap">
                      <label className="field-label">House BOL #</label>
                      <input className="field-input" type="text" required value={form.houseBOL} onChange={(e) => handleChange("houseBOL", e.target.value)} placeholder="e.g. HBOL987654" />
                    </div>
                    <div className="field-wrap">
                      <label className="field-label">SCAC Code</label>
                      <input className="field-input" type="text" required value={form.scacCode} onChange={(e) => handleChange("scacCode", e.target.value)} placeholder="e.g. MAEU" />
                    </div>
                    <div className="field-wrap">
                      <label className="field-label">Container #</label>
                      <input className="field-input" type="text" required value={form.containerNum} onChange={(e) => handleChange("containerNum", e.target.value)} placeholder="e.g. MSCU1234567" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Parties & Logistics */}
              <div className="section-card">
                <div className="section-title">Parties</div>
                <div className="section-body">
                  {(["seller", "buyer", "shipTo"] as const).map((key) => {
                    const labels: Record<string, string> = { seller: "Seller (Name & Address)", buyer: "Buyer (Name & Address)", shipTo: "Ship To (Name & Address)" };
                    return (
                      <div className="field-wrap" key={key}>
                        <label className="field-label">{labels[key]}</label>
                        <textarea className="field-input" rows={3} required value={form[key]} onChange={(e) => handleChange(key, e.target.value)} placeholder="Company name and full address..." />
                      </div>
                    );
                  })}
                  <div className="field-wrap">
                    <label className="field-label">Container Stuffing Location (Name & Address)</label>
                    <textarea className="field-input" rows={3} required value={form.stuffingLocation} onChange={(e) => handleChange("stuffingLocation", e.target.value)} placeholder="Location name and full address..." />
                  </div>
                  <div className="field-wrap">
                    <label className="field-label">Consolidator (Name & Address)</label>
                    <textarea className="field-input" rows={3} required value={form.consolidator} onChange={(e) => handleChange("consolidator", e.target.value)} placeholder="Consolidator name and full address..." />
                  </div>
                </div>
              </div>

              {/* Manufacturers */}
              <div className="section-card">
                <div className="section-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Manufacturers</span>
                  <button type="button" className="btn-primary" style={{ padding: "5px 14px", fontSize: 12 }} onClick={addManufacturer}>+ Add Manufacturer</button>
                </div>
                <div className="section-body">
                  {form.manufacturers.map((mfg, i) => (
                    <div className="mfg-card" key={i}>
                      <div className="mfg-header">
                        <span className="mfg-header-title">Manufacturer {form.manufacturers.length > 1 ? i + 1 : ""}</span>
                        {form.manufacturers.length > 1 && (
                          <button type="button" className="remove-btn" onClick={() => removeManufacturer(i)}>×</button>
                        )}
                      </div>
                      <div className="mfg-body">
                        <div className="field-wrap">
                          <label className="field-label">Name & Address</label>
                          <textarea className="field-input" rows={3} required value={mfg.name} onChange={(e) => handleManufacturerName(i, e.target.value)} placeholder="Manufacturer name and full address..." />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#444" }}>Item Description</span>
                          <button type="button" className="btn-outline" style={{ padding: "4px 12px", fontSize: 11 }} onClick={() => addItemDescription(i)}>+ Add Item</button>
                        </div>
                        {mfg.itemDescriptions.map((desc, j) => (
                          <div key={j} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                            <textarea className="field-input" rows={2} required value={desc} onChange={(e) => handleItemDescription(i, j, e.target.value)} placeholder={`Item description${mfg.itemDescriptions.length > 1 ? ` ${j + 1}` : ""}...`} style={{ flex: 1 }} />
                            {mfg.itemDescriptions.length > 1 && (
                              <button type="button" className="remove-btn" style={{ padding: "8px 4px" }} onClick={() => removeItemDescription(i, j)}>×</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Packing List */}
              <div className="section-card">
                <div className="section-title">Supporting Documents</div>
                <div className="section-body">
                  <label className="field-label">Packing List</label>
                  <div className={`upload-zone${packingFileName ? " has-file" : ""}`} onClick={() => fileRef.current?.click()}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={packingFileName ? ACCENT : "#aaa"} strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span style={{ fontSize: 13, color: packingFileName ? ACCENT : "#999", fontWeight: packingFileName ? 600 : 400 }}>
                      {packingFileName || "Upload packing list — PDF, Excel, or image"}
                    </span>
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf,.xls,.xlsx,.png,.jpg,.jpeg" onChange={handleFile} style={{ display: "none" }} />
                </div>
              </div>

              {/* Submit */}
              <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 8 }}>
                <button type="submit" className="btn-primary" style={{ padding: "12px 36px", fontSize: 14 }}>
                  Submit Filing →
                </button>
              </div>
            </form>
          ) : (
            <div>
              {/* Email */}
              <div className="section-card">
                <div className="section-title">Send via Email</div>
                <div className="section-body">
                  {emailSent ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#f0faf3", border: "1px solid #b6e8c6", borderRadius: 7 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a7a3a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{ fontSize: 13.5, color: "#1a7a3a", fontWeight: 600 }}>Email sent successfully — PDF attached.</span>
                    </div>
                  ) : (
                    <>
                      <div className="field-wrap">
                        <label className="field-label">Recipient(s)</label>
                        <input className="field-input" type="text" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="broker@example.com, agent@example.com" />
                      </div>
                      <div className="field-wrap">
                        <label className="field-label">Message (optional)</label>
                        <textarea className="field-input" rows={4} value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} placeholder="Please find the attached ISF filing for this shipment..." />
                      </div>
                      {emailError && <p style={{ color: ACCENT, fontSize: 13, margin: "0 0 12px" }}>{emailError}</p>}
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button className="btn-primary" onClick={handleSendEmail} disabled={!emailTo.trim() || emailSending} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                          {emailSending ? "Sending..." : "Send Email"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button className="btn-outline" onClick={handleGeneratePDF} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  Download PDF
                </button>
                <button className="btn-primary" onClick={handleReset}>
                  Start New Filing
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px", borderTop: "1px solid #e8e8e8", background: "#fff" }}>
          <span style={{ fontSize: 12, color: "#aaa" }}>© Agiloc International</span>
        </div>
      </div>
    </>
  );
}
