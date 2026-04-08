// Outbound webhook — notifies n8n (or any external service) of CRM events.
// No-op if N8N_WEBHOOK_URL is not set.

export async function notifyN8n(event: string, payload: unknown): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
    });
  } catch (err) {
    console.error(`[outbound-webhook] Failed to notify n8n for ${event}:`, err);
  }
}
