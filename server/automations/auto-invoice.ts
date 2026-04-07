import { crmEvents } from "../events";
import { storage } from "../storage";

// ---------------------------------------------------------------------------
// Auto-Invoice Automation
// When a deal transitions to closed_won:
//   1. Create a draft invoice with snapshot data
//   2. Recalculate the contact's lifetime value
// Previously inline in routes.ts PATCH /api/deals/:id
// ---------------------------------------------------------------------------

crmEvents.onCrm("deal.closedWon", async ({ deal }) => {
  try {
    const invoiceNumber = await storage.generateInvoiceNumber();

    // Snapshot artwork details
    let artworkDetails = "";
    let artistName = "";
    if (deal.artworkId) {
      const artwork = await storage.getArtwork(deal.artworkId);
      if (artwork) {
        artworkDetails = [artwork.medium, artwork.dimensions, artwork.year].filter(Boolean).join(", ");
        artistName = artwork.artistName;
      }
    }

    // Snapshot contact email
    let contactEmail = "";
    if (deal.contactId) {
      const contact = await storage.getContact(deal.contactId);
      if (contact) contactEmail = contact.email || "";
    }

    const invoice = await storage.createInvoice({
      invoiceNumber,
      dealId: deal.id,
      contactId: deal.contactId,
      contactName: deal.contactName,
      contactEmail,
      artworkTitle: deal.artworkTitle,
      artworkDetails,
      artistName,
      amount: deal.value || 0,
      currency: deal.currency || "USD",
      tax: 0,
      totalAmount: deal.value || 0,
      status: "draft",
      issueDate: deal.closeDate || new Date().toISOString().split("T")[0],
      advisorName: deal.advisorName,
      createdAt: new Date().toISOString(),
    });

    // Recalculate contact lifetime value from invoices
    if (deal.contactId) {
      await storage.recalcContactLTV(deal.contactId);
    }

    console.log(`[auto-invoice] Created ${invoice.invoiceNumber} for deal #${deal.id}`);
  } catch (err) {
    console.error("[auto-invoice] Failed for deal #" + deal.id, err);
  }
});
