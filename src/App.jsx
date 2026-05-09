import { useEffect, useMemo, useRef, useState } from "react";
import html2pdf from "html2pdf.js";

const STORAGE_KEY = "invoice_generator_data_v2";
const CURRENCIES = [
  { code: "USD", label: "USD (United States Dollar)" },
  { code: "INR", label: "INR (Indian Rupee)" },
  { code: "EUR", label: "EUR (Euro)" },
  { code: "GBP", label: "GBP (British Pound)" },
  { code: "AED", label: "AED (Dirham)" }
];

const emptyLineItem = () => ({
  id: crypto.randomUUID(),
  name: "",
  description: "",
  quantity: "",
  rate: ""
});

const defaultForm = {
  id: null,
  invoiceNumber: "",
  companyName: "",
  companyEmail: "",
  companyAddress: "",
  customerName: "",
  customerEmail: "",
  customerAddress: "",
  invoiceDate: "",
  dueDate: "",
  notes: "",
  currency: "USD",
  taxPercent: 0,
  discountPercent: 0,
  status: "draft",
  lineItems: [emptyLineItem()]
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value, currency) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value || 0);

function calculateTotals(lineItems, taxPercent, discountPercent) {
  const subtotal = lineItems.reduce((sum, line) => sum + toNumber(line.quantity) * toNumber(line.rate), 0);
  const discountTotal = subtotal * (toNumber(discountPercent) / 100);
  const taxableAmount = subtotal - discountTotal;
  const taxTotal = taxableAmount * (toNumber(taxPercent) / 100);
  const grandTotal = taxableAmount + taxTotal;
  return { subtotal, discountTotal, taxTotal, grandTotal };
}

function App() {
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [mode, setMode] = useState("create");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const pdfRef = useRef(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setForm((prev) => ({ ...prev, invoiceNumber: nextInvoiceNumber([]) }));
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const loaded = Array.isArray(parsed) ? parsed : [];
      setInvoices(loaded);
      setForm((prev) => ({ ...prev, invoiceNumber: nextInvoiceNumber(loaded) }));
    } catch {
      setForm((prev) => ({ ...prev, invoiceNumber: nextInvoiceNumber([]) }));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    const name = form.companyName.trim();
    document.title = name ? `${name} · Invoice Generator` : "Invoice Generator";
  }, [form.companyName]);

  const totals = useMemo(
    () => calculateTotals(form.lineItems, form.taxPercent, form.discountPercent),
    [form.lineItems, form.taxPercent, form.discountPercent]
  );

  const markUnreviewed = () => setReviewed(false);
  const updateField = (field, value) => {
    markUnreviewed();
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLine = (id, field, value) => {
    markUnreviewed();
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    }));
  };

  const addLine = () => {
    markUnreviewed();
    setForm((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, emptyLineItem()]
    }));
  };

  const removeLine = (id) => {
    markUnreviewed();
    setForm((prev) => {
      if (prev.lineItems.length === 1) return prev;
      return { ...prev, lineItems: prev.lineItems.filter((line) => line.id !== id) };
    });
  };

  const resetForm = (list = invoices) => {
    setMode("create");
    setReviewed(false);
    setIsPreviewOpen(false);
    setForm({
      ...defaultForm,
      invoiceNumber: nextInvoiceNumber(list),
      lineItems: [emptyLineItem()]
    });
  };

  const validateInvoice = () => {
    if (!form.companyName.trim() || !form.customerName.trim()) {
      alert("Bill from and bill to names are required.");
      return false;
    }
    return true;
  };

  const persistInvoice = (status) => {
    const { companyLogo: _removed, ...formRest } = form;
    const payload = {
      ...formRest,
      status,
      totals
    };

    if (mode === "edit" && payload.id) {
      const updated = invoices.map((invoice) => (invoice.id === payload.id ? payload : invoice));
      setInvoices(updated);
      return { saved: payload, nextInvoices: updated };
    }

    const createdInvoice = { ...payload, id: crypto.randomUUID() };
    const created = [createdInvoice, ...invoices];
    setInvoices(created);
    setMode("edit");
    setForm(createdInvoice);
    return { saved: createdInvoice, nextInvoices: created };
  };

  const reviewInvoice = () => {
    setIsPreviewOpen(true);
    setReviewed(true);
  };

  const sendInvoice = () => {
    if (!validateInvoice()) return;
    if (!reviewed) {
      alert("Please review the invoice before sending.");
      return;
    }
    const result = persistInvoice("sent");
    if (result) resetForm(result.nextInvoices);
  };

  const downloadInvoice = () => {
    if (!validateInvoice()) return;
    const result = persistInvoice("downloaded");
    setReviewed(true);
    const fileInvoice = result?.saved?.invoiceNumber || form.invoiceNumber || "invoice";
    const element = pdfRef.current;
    if (!element) return;
    html2pdf()
      .set({
        margin: 8,
        filename: `${fileInvoice}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      })
      .from(element)
      .save();
  };

  const editInvoice = (invoice) => {
    setMode("edit");
    setForm({
      ...invoice,
      lineItems: invoice.lineItems.map((line) => ({ ...line, id: line.id || crypto.randomUUID() }))
    });
    setIsPreviewOpen(false);
    setReviewed(true);
  };

  const deleteInvoice = (id) => {
    const next = invoices.filter((invoice) => invoice.id !== id);
    setInvoices(next);
    if (form.id === id) {
      resetForm(next);
    }
  };

  return (
    <main className="app-shell">
      <section className="composer-layout">
        <div className="editor-panel">
          <div className="meta-row">
            <label>
              Date
              <input type="date" value={form.invoiceDate} onChange={(e) => updateField("invoiceDate", e.target.value)} />
            </label>
            <label>
              Due Date
              <input type="date" value={form.dueDate} onChange={(e) => updateField("dueDate", e.target.value)} />
            </label>
          </div>

          <div className="bill-grid">
            <div>
              <h4>Bill to:</h4>
              <input
                placeholder="Who is this invoice to?"
                value={form.customerName}
                onChange={(e) => updateField("customerName", e.target.value)}
              />
              <input
                placeholder="Email address"
                value={form.customerEmail}
                onChange={(e) => updateField("customerEmail", e.target.value)}
              />
              <input
                placeholder="Billing address"
                value={form.customerAddress}
                onChange={(e) => updateField("customerAddress", e.target.value)}
              />
            </div>
            <div>
              <h4>Bill from:</h4>
              <input
                placeholder="Who is this invoice from?"
                value={form.companyName}
                onChange={(e) => updateField("companyName", e.target.value)}
              />
              <input
                placeholder="Email address"
                value={form.companyEmail}
                onChange={(e) => updateField("companyEmail", e.target.value)}
              />
              <input
                placeholder="Billing address"
                value={form.companyAddress}
                onChange={(e) => updateField("companyAddress", e.target.value)}
              />
            </div>
          </div>

          <div className="items-table">
            <div className="items-head">
              <span>Item</span>
              <span>Qty</span>
              <span>Price/Rate</span>
              <span>Action</span>
            </div>
            {form.lineItems.map((line) => (
              <div className="item-row" key={line.id}>
                <div>
                  <input
                    placeholder="Item name"
                    value={line.name}
                    onChange={(e) => updateLine(line.id, "name", e.target.value)}
                  />
                  <input
                    placeholder="Item description"
                    value={line.description}
                    onChange={(e) => updateLine(line.id, "description", e.target.value)}
                  />
                </div>
                <input
                  type="number"
                  min="0"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                />
                <input type="number" min="0" value={line.rate} onChange={(e) => updateLine(line.id, "rate", e.target.value)} />
                <button type="button" className="icon-btn" onClick={() => removeLine(line.id)} aria-label="Delete line item">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9zm1 12h8a2 2 0 0 0 2-2V8H6v11a2 2 0 0 0 2 2z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="btn btn-primary add-btn" onClick={addLine}>
            Add Item
          </button>

          <div className="editor-totals">
            <p>
              <span>Subtotal:</span>
              <strong>{formatMoney(totals.subtotal, form.currency)}</strong>
            </p>
            <p>
              <span>Discount:</span>
              <strong>{formatMoney(totals.discountTotal, form.currency)}</strong>
            </p>
            <p>
              <span>Tax:</span>
              <strong>{formatMoney(totals.taxTotal, form.currency)}</strong>
            </p>
            <p className="final">
              <span>Total:</span>
              <strong>{formatMoney(totals.grandTotal, form.currency)}</strong>
            </p>
          </div>

          <label className="notes">
            Notes:
            <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />
          </label>
        </div>

        <aside className="side-panel">
          <button type="button" className="btn btn-primary" onClick={reviewInvoice}>
            Review Invoice
          </button>

          <label>
            Currency:
            <select value={form.currency} onChange={(e) => updateField("currency", e.target.value)}>
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Tax rate:
            <div className="percent-input">
              <input type="number" min="0" value={form.taxPercent} onChange={(e) => updateField("taxPercent", e.target.value)} />
              <span>%</span>
            </div>
          </label>

          <label>
            Discount rate:
            <div className="percent-input">
              <input
                type="number"
                min="0"
                value={form.discountPercent}
                onChange={(e) => updateField("discountPercent", e.target.value)}
              />
              <span>%</span>
            </div>
          </label>

          <label>
            Invoice #:
            <input value={form.invoiceNumber} onChange={(e) => updateField("invoiceNumber", e.target.value)} />
          </label>

          <div className="side-actions">
            <button type="button" className="btn btn-primary" onClick={sendInvoice}>
              Send Invoice
            </button>
            <button type="button" className="btn btn-outline" onClick={downloadInvoice}>
              Download Invoice
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => resetForm()}>
              Reset
            </button>
          </div>
        </aside>
      </section>

      {isPreviewOpen && (
        <div className="preview-modal-overlay" onClick={() => setIsPreviewOpen(false)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-head">
              <h3>Invoice Preview</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setIsPreviewOpen(false)}>
                Close
              </button>
            </div>
            <InvoicePreview form={form} totals={totals} formatMoney={formatMoney} toNumber={toNumber} />
          </div>
        </div>
      )}

      <div className="pdf-render-shell" aria-hidden="true">
        <div ref={pdfRef}>
          <InvoicePreview form={form} totals={totals} formatMoney={formatMoney} toNumber={toNumber} />
        </div>
      </div>

      <section className="saved-panel">
        <h3>Saved Invoices ({invoices.length})</h3>
        {invoices.length === 0 && <p className="muted">No invoices yet.</p>}
        <div className="saved-list">
          {invoices.map((invoice) => (
            <article className="saved-card" key={invoice.id}>
              <div>
                <h4>{invoice.invoiceNumber}</h4>
                <p>
                  {invoice.companyName} to {invoice.customerName}
                </p>
                <p className="muted">Status: {invoice.status}</p>
              </div>
              <strong>{formatMoney(invoice.totals?.grandTotal || 0, invoice.currency)}</strong>
              <div className="saved-actions">
                <button type="button" className="btn btn-outline" onClick={() => editInvoice(invoice)}>
                  Edit
                </button>
                <button type="button" className="btn btn-outline" onClick={() => deleteInvoice(invoice.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function InvoicePreview({ form, totals, formatMoney, toNumber }) {
  return (
    <section className="preview-panel">
      <header className="preview-top">
        <div>
          <h2>{form.companyName}</h2>
          <p>{form.companyAddress}</p>
          <p>{form.companyEmail}</p>
        </div>
        <div className="amount-due">
          <p>Amount Due:</p>
          <strong>{formatMoney(totals.grandTotal, form.currency)}</strong>
        </div>
      </header>

      <div className="preview-meta">
        <div>
          <h4>Billed to:</h4>
          <p>{form.customerName}</p>
          <p>{form.customerAddress}</p>
          <p>{form.customerEmail}</p>
        </div>
        <div>
          <p>
            <strong>Invoice Number:</strong> {form.invoiceNumber}
          </p>
          <p>
            <strong>Date Of Issue:</strong> {form.invoiceDate || "-"}
          </p>
          <p>
            <strong>Due Date:</strong> {form.dueDate || "-"}
          </p>
        </div>
      </div>

      <div className="preview-table">
        <div className="preview-head">
          <span>Qty</span>
          <span>Description</span>
          <span>Price</span>
          <span>Amount</span>
        </div>
        {form.lineItems.map((line) => {
          const qty = toNumber(line.quantity);
          const rate = toNumber(line.rate);
          const amount = qty * rate;
          return (
            <div className="preview-row" key={line.id}>
              <span>{qty}</span>
              <span>{line.name || line.description}</span>
              <span>{formatMoney(rate, form.currency)}</span>
              <span>{formatMoney(amount, form.currency)}</span>
            </div>
          );
        })}
      </div>

      <div className="preview-totals">
        <p>
          <span>Subtotal</span>
          <strong>{formatMoney(totals.subtotal, form.currency)}</strong>
        </p>
        <p>
          <span>Tax</span>
          <strong>{formatMoney(totals.taxTotal, form.currency)}</strong>
        </p>
        <p>
          <span>Discount</span>
          <strong>{formatMoney(totals.discountTotal, form.currency)}</strong>
        </p>
        <p className="final">
          <span>Total</span>
          <strong>{formatMoney(totals.grandTotal, form.currency)}</strong>
        </p>
      </div>

      <p className="preview-notes">{form.notes}</p>
    </section>
  );
}

function nextInvoiceNumber(invoices) {
  const seed = invoices.length + 1;
  return `INV-${new Date().getFullYear()}-${String(seed).padStart(4, "0")}`;
}

export default App;
