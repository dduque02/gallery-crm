import { jsPDF } from "jspdf";
import type { Invoice } from "@shared/schema";

export function generateInvoicePdf(invoice: Invoice): ArrayBuffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Header — Gallery name
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Galeria Duque Arango", margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Medellin & Bogota, Colombia", margin, y);
  y += 4;
  doc.text("www.galeriaduquearango.com", margin, y);
  doc.setTextColor(0);

  // Invoice number + date (right aligned)
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(200, 200, 200);
  doc.text("INVOICE", pageWidth - margin, 25, { align: "right" });
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`No. ${invoice.invoiceNumber}`, pageWidth - margin, 35, { align: "right" });
  doc.text(`Date: ${formatDate(invoice.issueDate)}`, pageWidth - margin, 41, { align: "right" });
  if (invoice.dueDate) {
    doc.text(`Due: ${formatDate(invoice.dueDate)}`, pageWidth - margin, 47, { align: "right" });
  }

  // Divider
  y = 55;
  doc.setDrawColor(220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Bill To
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100);
  doc.text("BILL TO", margin, y);
  doc.setTextColor(0);
  y += 6;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  if (invoice.contactName) {
    doc.text(invoice.contactName, margin, y);
    y += 5;
  }
  if (invoice.contactEmail) {
    doc.setFontSize(9);
    doc.text(invoice.contactEmail, margin, y);
    y += 5;
  }

  // Advisor
  if (invoice.advisorName) {
    const advisorY = 65;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);
    doc.text("ADVISOR", pageWidth - margin - 50, advisorY);
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.advisorName, pageWidth - margin - 50, advisorY + 6);
  }

  // Line items table
  y += 10;
  const tableTop = y;
  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 4, pageWidth - 2 * margin, 8, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Description", margin + 3, y);
  doc.text("Amount", pageWidth - margin - 3, y, { align: "right" });
  y += 10;

  // Artwork line item
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const title = invoice.artworkTitle || "Artwork";
  doc.text(title, margin + 3, y);
  doc.text(formatMoney(invoice.amount, invoice.currency || "USD"), pageWidth - margin - 3, y, { align: "right" });
  y += 5;

  // Artwork details (artist, medium, dimensions)
  if (invoice.artistName || invoice.artworkDetails) {
    doc.setFontSize(8);
    doc.setTextColor(100);
    const details = [invoice.artistName, invoice.artworkDetails].filter(Boolean).join(" — ");
    doc.text(details, margin + 3, y);
    doc.setTextColor(0);
    y += 8;
  } else {
    y += 3;
  }

  // Divider
  doc.setDrawColor(230);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Totals
  const totalsX = pageWidth - margin - 60;
  doc.setFontSize(10);

  if (invoice.tax && invoice.tax > 0) {
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", totalsX, y);
    doc.text(formatMoney(invoice.amount, invoice.currency || "USD"), pageWidth - margin - 3, y, { align: "right" });
    y += 6;
    doc.text("Tax:", totalsX, y);
    doc.text(formatMoney(invoice.tax, invoice.currency || "USD"), pageWidth - margin - 3, y, { align: "right" });
    y += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total:", totalsX, y);
  doc.text(formatMoney(invoice.totalAmount, invoice.currency || "USD"), pageWidth - margin - 3, y, { align: "right" });
  y += 10;

  // Status badge
  const statusLabel = (invoice.status || "draft").toUpperCase();
  doc.setFontSize(9);
  if (invoice.status === "paid") {
    doc.setTextColor(22, 163, 74);
  } else if (invoice.status === "sent") {
    doc.setTextColor(59, 130, 246);
  } else {
    doc.setTextColor(161, 161, 170);
  }
  doc.text(`Status: ${statusLabel}`, totalsX, y);
  if (invoice.paidDate) {
    y += 5;
    doc.text(`Paid: ${formatDate(invoice.paidDate)}`, totalsX, y);
  }
  doc.setTextColor(0);

  // Notes
  if (invoice.notes) {
    y += 15;
    doc.setDrawColor(230);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);
    doc.text("NOTES", margin, y);
    doc.setTextColor(0);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(invoice.notes, pageWidth - 2 * margin);
    doc.text(noteLines, margin, y);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setDrawColor(230);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Galeria Duque Arango — Thank you for your purchase", pageWidth / 2, footerY, { align: "center" });

  return doc.output("arraybuffer");
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
