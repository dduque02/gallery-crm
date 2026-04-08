// n8n Notifier — forwards CRM events to n8n via outbound webhook.
// Only active when N8N_WEBHOOK_URL env var is set.

import { crmEvents } from "../events";
import { notifyN8n } from "../services/outbound-webhook";

crmEvents.onCrm("deal.created", (payload) => notifyN8n("deal.created", payload));
crmEvents.onCrm("deal.stageChanged", (payload) => notifyN8n("deal.stageChanged", payload));
crmEvents.onCrm("deal.closedWon", (payload) => notifyN8n("deal.closedWon", payload));
crmEvents.onCrm("contact.created", (payload) => notifyN8n("contact.created", payload));
crmEvents.onCrm("invoice.created", (payload) => notifyN8n("invoice.created", payload));
