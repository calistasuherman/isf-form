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

    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const colLabel = 230;
    const colValue = pageWidth - margin * 2 - colLabel;
    let y = margin;

    let logoDataUrl: string | null = null;
    try {
      const resp = await fetch("/agiloc-logo.jpg");
      const blob = await resp.blob();
      logoDataUrl = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { /* skip */ }

    const headerH = logoDataUrl ? 90 : 60;
    doc.setFillColor(139, 26, 26);
    doc.rect(0, 0, pageWidth, headerH, "F");

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "JPEG", margin, 10, 70, 70);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    const textX = logoDataUrl ? margin + 82 : pageWidth / 2;
    const textAlign = logoDataUrl ? "left" : "center";
    doc.text("IMPORTER SECURITY FILING FORM (10+2 FORM)", textX, logoDataUrl ? 38 : 28, { align: textAlign, maxWidth: pageWidth - margin - textX });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 200, 200);
    doc.text(new Date().toLocaleDateString(), textX, logoDataUrl ? 54 : 44, { align: textAlign });

    y = headerH + 16;

    const drawSectionHeader = (title: string) => {
      if (y + 24 > pageHeight - margin) { doc.addPage(); y = margin; }
      doc.setFillColor(30, 30, 30);
      doc.rect(margin, y, pageWidth - margin * 2, 22, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(title.toUpperCase(), margin + 8, y + 14);
      y += 22;
    };

    const drawRow = (label: string, value: string, shade: boolean) => {
      const valueLines = doc.splitTextToSize(value || "(not provided)", colValue - 16);
      const rowHeight = Math.max(24, valueLines.length * 13 + 14);
      if (y + rowHeight > pageHeight - margin) { doc.addPage(); y = margin; }

      doc.setFillColor(shade ? 245 : 255, shade ? 245 : 255, shade ? 245 : 255);
      doc.rect(margin, y, pageWidth - margin * 2, rowHeight, "F");
      doc.setDrawColor(210, 210, 210);
      doc.rect(margin, y, pageWidth - margin * 2, rowHeight, "S");
      doc.line(margin + colLabel, y, margin + colLabel, y + rowHeight);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(label.toUpperCase(), margin + 6, y + rowHeight / 2 + 3, { maxWidth: colLabel - 12 });

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(valueLines, margin + colLabel + 8, y + 14);
      y += rowHeight;
    };

    drawSectionHeader("Filing Information");
    let shade = false;
    BASIC_FIELDS.forEach(({ key, label }) => { drawRow(label, form[key], shade); shade = !shade; });

    form.manufacturers.forEach((m, i) => {
      drawSectionHeader(`Manufacturer${form.manufacturers.length > 1 ? ` ${i + 1}` : ""}`);
      shade = false;
      drawRow("Name & Address", m.name, shade); shade = !shade;
      m.itemDescriptions.forEach((desc, j) => {
        drawRow(`Item Description${m.itemDescriptions.length > 1 ? ` ${j + 1}` : ""}`, desc, shade);
        shade = !shade;
      });
    });

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
        body { font-family: 'Times New Roman', Times, serif !important; }
        input, textarea, button { font-family: 'Times New Roman', Times, serif; }
        .field-input {
          width: 100%;
          padding: 10px 13px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13.5px;
          color: #1a1a1a;
          background: #fff;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .field-input:focus {
          border-color: ${ACCENT};
          box-shadow: 0 0 0 3px rgba(139,26,26,0.08);
        }
        textarea.field-input { resize: vertical; }
        .btn-primary {
          padding: 10px 24px;
          background: ${ACCENT};
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.2px;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .btn-primary:hover { background: #6e1414; box-shadow: 0 4px 12px rgba(139,26,26,0.25); }
        .btn-primary:disabled { background: #ccc; cursor: not-allowed; box-shadow: none; }
        .btn-outline {
          padding: 10px 24px;
          background: #fff;
          color: ${ACCENT};
          border: 1.5px solid ${ACCENT};
          border-radius: 6px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-outline:hover { background: ${ACCENT_LIGHT}; }
        .section-card {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 10px;
          margin-bottom: 20px;
          overflow: hidden;
        }
        .section-title {
          padding: 14px 24px;
          border-bottom: 1px solid #f0f0f0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #888;
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
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          margin-bottom: 12px;
          overflow: hidden;
        }
        .mfg-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: #f7f7f7;
          border-bottom: 1px solid #eee;
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
          border: 1.5px dashed #ddd;
          border-radius: 7px;
          padding: 16px 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: border-color 0.15s, background 0.15s;
        }
        .upload-zone:hover { border-color: ${ACCENT}; background: ${ACCENT_LIGHT}; }
        .upload-zone.has-file { border-color: ${ACCENT}; background: ${ACCENT_LIGHT}; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#fff" }}>
        {/* Header */}
        <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "18px 40px", textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/agiloc-logo.jpg" alt="Agiloc International" style={{ height: 72, objectFit: "contain" }} />
        </div>

        <div style={{ maxWidth: 780, margin: "0 auto", padding: "36px 24px 80px" }}>
          {/* Page title */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111", letterSpacing: -0.3 }}>IMPORTER SECURITY FILING</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>Complete all fields and submit. You can send the filing via email or download a PDF copy.</p>
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
              {/* Success banner */}
              <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 10, marginBottom: 20, overflow: "hidden" }}>
                <div style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a7a3a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111" }}>Filing Submitted</p>
                    <p style={{ margin: 0, fontSize: 12, color: "#888" }}>Review below and send via email or download a PDF.</p>
                  </div>
                </div>
                <div style={{ padding: "16px 24px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 20px" }}>
                  {BASIC_FIELDS.slice(0, 5).map(({ key, label }) => (
                    <div key={key}>
                      <p style={{ margin: 0, fontSize: 10.5, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{label}</p>
                      <p style={{ margin: "3px 0 0", fontSize: 13, color: "#222", fontWeight: 500 }}>{form[key] || "—"}</p>
                    </div>
                  ))}
                </div>
              </div>

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
