// ---------------------------------------------------------------------------
// Automation Registry
// Import each automation to register its event listeners at startup.
// To disable an automation, comment out its import.
// ---------------------------------------------------------------------------

// Active automations
import "./auto-invoice";        // Auto-create invoice + recalc LTV on deal closed_won

// Future automations (uncomment when ready)
// import "./lead-classifier";      // AI-powered lead classification on deal.created
// import "./followup-manager";     // AI-suggested follow-ups on stage changes
// import "./channel-normalizer";   // Normalize incoming messages from WhatsApp, email, etc.

console.log("[automations] registered");
