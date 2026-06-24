"use client";

import { useState, useRef } from "react";

const ACCENT = "#a42828";

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
  { key: "importer", label: "Importer (Name & Address)", multiline: true },
  { key: "masterBOL", label: "Master BOL #" },
  { key: "houseBOL", label: "House BOL #" },
  { key: "scacCode", label: "SCAC Code" },
  { key: "containerNum", label: "Container #" },
  { key: "seller", label: "Seller (Name & Address)", multiline: true },
  { key: "buyer", label: "Buyer (Name & Address)", multiline: true },
  { key: "shipTo", label: "Ship To (Name & Address)", multiline: true },
  { key: "stuffingLocation", label: "Container Stuffing Location (Name & Address)", multiline: true },
  { key: "consolidator", label: "Consolidator (Name & Address)", multiline: true },
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
    const colLabel = 180;
    const colValue = pageWidth - margin - colLabel - margin;
    let y = margin;

    // Header
    doc.setFillColor(164, 40, 40);
    doc.rect(0, 0, pageWidth, 72, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("IMPORTER SECURITY FILING FORM (10+2 FORM)", pageWidth / 2, 28, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Agiloc International", pageWidth / 2, 46, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 62, { align: "center" });

    y = 90;

    const drawRow = (label: string, value: string, shade: boolean) => {
      const valueLines = doc.splitTextToSize(value || "(not provided)", colValue - 16);
      const rowHeight = Math.max(24, valueLines.length * 13 + 14);

      if (y + rowHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }

      // Row background
      if (shade) {
        doc.setFillColor(253, 242, 242);
        doc.rect(margin, y, pageWidth - margin * 2, rowHeight, "F");
      } else {
        doc.setFillColor(255, 255, 255);
        doc.rect(margin, y, pageWidth - margin * 2, rowHeight, "F");
      }

      // Border
      doc.setDrawColor(220, 210, 210);
      doc.rect(margin, y, pageWidth - margin * 2, rowHeight, "S");

      // Divider between label and value columns
      doc.line(margin + colLabel, y, margin + colLabel, y + rowHeight);

      // Label
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(164, 40, 40);
      doc.text(label.toUpperCase(), margin + 8, y + rowHeight / 2 + 3);

      // Value
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(valueLines, margin + colLabel + 8, y + 14);

      y += rowHeight;
    };

    let shade = false;
    BASIC_FIELDS.forEach(({ key, label }) => {
      drawRow(label, form[key], shade);
      shade = !shade;
    });

    form.manufacturers.forEach((m, i) => {
      const mLabel = `Manufacturer${form.manufacturers.length > 1 ? ` ${i + 1}` : ""} (Name & Address)`;
      drawRow(mLabel, m.name, shade);
      shade = !shade;
      m.itemDescriptions.forEach((desc, j) => {
        const dLabel = `Item Description${m.itemDescriptions.length > 1 ? ` ${j + 1}` : ""}`;
        drawRow(dLabel, desc, shade);
        shade = !shade;
      });
    });

    doc.save("ISF_Form_10plus2.pdf");
  }

  function handleReset() {
    setForm(INITIAL);
    setSubmitted(false);
    setEmailTo("");
    setEmailMessage("");
    setPackingFileName("");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Logo bar */}
      <div style={{ background: "#fff", padding: "16px 0", textAlign: "center", borderBottom: `3px solid ${ACCENT}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/agiloc-logo.jpg" alt="Agiloc International, Inc." style={{ height: 70, objectFit: "contain" }} />
      </div>

      {/* Title bar */}
      <div style={{ background: ACCENT, padding: "18px 0", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: 0.5, textTransform: "uppercase" }}>
          Importer Security Filing Form (10+2 Form)
        </h1>
      </div>

      <div style={{ maxWidth: 760, margin: "36px auto", padding: "0 20px 60px" }}>
        {!submitted ? (
          <form onSubmit={handleSubmit}>
            <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 2px 16px rgba(0,0,0,0.09)", overflow: "hidden" }}>
              <div style={{ padding: "28px 28px 10px" }}>
                {/* Basic fields */}
                {BASIC_FIELDS.map(({ key, label, multiline }) => (
                  <div key={key} style={{ marginBottom: 22 }}>
                    <label style={labelStyle}>{label}</label>
                    {multiline ? (
                      <textarea
                        rows={3}
                        required
                        value={form[key]}
                        onChange={(e) => handleChange(key, e.target.value)}
                        placeholder={`Enter ${label.toLowerCase()}...`}
                        style={inputStyle(true)}
                      />
                    ) : (
                      <input
                        type="text"
                        required
                        value={form[key]}
                        onChange={(e) => handleChange(key, e.target.value)}
                        placeholder={`Enter ${label.toLowerCase()}...`}
                        style={inputStyle(false)}
                      />
                    )}
                  </div>
                ))}

                {/* Manufacturers */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Manufacturers</label>
                    <button
                      type="button"
                      onClick={addManufacturer}
                      style={{
                        padding: "6px 14px",
                        background: ACCENT,
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Manufacturer
                    </button>
                  </div>

                  {form.manufacturers.map((mfg, i) => (
                    <div
                      key={i}
                      style={{
                        border: `1.5px solid #e8e8e8`,
                        borderRadius: 8,
                        padding: "18px 18px 14px",
                        marginBottom: 14,
                        background: "#fafafa",
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Manufacturer {form.manufacturers.length > 1 ? i + 1 : ""} (Name & Address)
                        </span>
                        {form.manufacturers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeManufacturer(i)}
                            style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        required
                        value={mfg.name}
                        onChange={(e) => handleManufacturerName(i, e.target.value)}
                        placeholder="Enter manufacturer name and address..."
                        style={{ ...inputStyle(true), marginBottom: 14, background: "#fff" }}
                      />

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Item Descriptions
                        </span>
                        <button
                          type="button"
                          onClick={() => addItemDescription(i)}
                          style={{ padding: "4px 10px", background: "#fff", color: ACCENT, border: `1.5px solid ${ACCENT}`, borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <span style={{ fontSize: 14 }}>+</span> Add Item
                        </button>
                      </div>

                      {mfg.itemDescriptions.map((desc, j) => (
                        <div key={j} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                          <textarea
                            rows={2}
                            required
                            value={desc}
                            onChange={(e) => handleItemDescription(i, j, e.target.value)}
                            placeholder={`Item description${mfg.itemDescriptions.length > 1 ? ` ${j + 1}` : ""}...`}
                            style={{ ...inputStyle(true), background: "#fff", flex: 1 }}
                          />
                          {mfg.itemDescriptions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemDescription(i, j)}
                              style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "10px 4px", flexShrink: 0 }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Packing list */}
                <div style={{ marginBottom: 28 }}>
                  <label style={labelStyle}>Packing List (upload)</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{
                      border: `2px dashed ${ACCENT}44`,
                      borderRadius: 8,
                      padding: "18px 20px",
                      cursor: "pointer",
                      background: packingFileName ? "#fdf2f2" : "#fafafa",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span style={{ fontSize: 13, color: packingFileName ? ACCENT : "#888", fontWeight: packingFileName ? 600 : 400 }}>
                      {packingFileName || "Click to upload packing list (PDF, Excel, or image)"}
                    </span>
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf,.xls,.xlsx,.png,.jpg,.jpeg" onChange={handleFile} style={{ display: "none" }} />
                </div>

                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "15px",
                    background: ACCENT,
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: 0.5,
                    marginBottom: 24,
                    boxShadow: "0 4px 12px rgba(164,40,40,0.3)",
                  }}
                >
                  Submit
                </button>
                <p style={{ textAlign: "center", fontSize: 12, color: "#aaa", margin: "0 0 20px" }}>
                  © Agiloc International
                </p>
              </div>
            </div>
          </form>
        ) : (
          <div>
            <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 2px 16px rgba(0,0,0,0.09)", overflow: "hidden", marginBottom: 24 }}>
              <div style={{ background: ACCENT, padding: "20px 28px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <h2 style={{ color: "#fff", margin: 0, fontSize: 18, fontWeight: 700 }}>Form Submitted Successfully</h2>
                </div>
              </div>

              <div style={{ padding: "20px 28px" }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Filing Summary</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
                  {BASIC_FIELDS.slice(0, 5).map(({ key, label }) => (
                    <div key={key}>
                      <p style={{ margin: 0, fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>{label}</p>
                      <p style={{ margin: "3px 0 0", fontSize: 13, color: "#222", fontWeight: 500 }}>{form[key] || "—"}</p>
                    </div>
                  ))}
                </div>
                {packingFileName && (
                  <p style={{ margin: "16px 0 0", fontSize: 12, color: "#666" }}>
                    <strong style={{ color: ACCENT }}>Packing list attached:</strong> {packingFileName}
                  </p>
                )}
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 2px 16px rgba(0,0,0,0.09)", overflow: "hidden", marginBottom: 20 }}>
              <div style={{ borderBottom: `3px solid ${ACCENT}`, padding: "14px 28px", background: "#fdf2f2" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#222" }}>Send via Email</h3>
              </div>
              <div style={{ padding: "20px 28px" }}>
                {emailSent ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", background: "#f0faf0", border: "1.5px solid #b6e8b6", borderRadius: 8 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{ fontSize: 14, color: "#2e7d32", fontWeight: 600 }}>Email sent successfully!</span>
                  </div>
                ) : (
                  <>
                    <label style={labelStyle}>Recipient Email Address(es)</label>
                    <input
                      type="text"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="broker@example.com, forwarder@example.com"
                      style={{ ...inputStyle(false), marginBottom: 16 }}
                    />
                    <label style={labelStyle}>Custom Message</label>
                    <textarea
                      rows={4}
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="Please find the attached Importer Security Filing for shipment..."
                      style={{ ...inputStyle(true), marginBottom: 20 }}
                    />
                    {emailError && <p style={{ color: ACCENT, fontSize: 13, marginBottom: 12 }}>{emailError}</p>}
                    <button
                      onClick={handleSendEmail}
                      disabled={!emailTo.trim() || emailSending}
                      style={{
                        padding: "12px 28px",
                        background: emailTo.trim() && !emailSending ? ACCENT : "#ccc",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: emailTo.trim() && !emailSending ? "pointer" : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      {emailSending ? "Sending..." : "Send Email"}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 14 }}>
              <button
                onClick={handleGeneratePDF}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: "#fff",
                  color: ACCENT,
                  border: `2px solid ${ACCENT}`,
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Download PDF Copy
              </button>
              <button
                onClick={handleReset}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: "#f5f5f5",
                  color: "#555",
                  border: "2px solid #ddd",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Start New Filing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function inputStyle(multiline: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 14px",
    border: "1.5px solid #e0e0e0",
    borderRadius: 7,
    fontSize: 14,
    color: "#222",
    background: "#fafafa",
    outline: "none",
    resize: multiline ? "vertical" : undefined,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: ACCENT,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  marginBottom: 6,
};
