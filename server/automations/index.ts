// ---------------------------------------------------------------------------
// Automation Registry
// Import each automation to register its event listeners at startup.
// To disable an automation, comment out its import.
// ---------------------------------------------------------------------------

// Active automations
import "./auto-invoice";        // Auto-create invoice + recalc LTV on deal closed_won
import "./n8n-notifier";        // Forward CRM events to n8n via outbound webhook

console.log("[automations] registered");
