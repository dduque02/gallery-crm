import { EventEmitter } from "events";
import type { Contact, Deal, Activity, Followup, Invoice, Message } from "../shared/schema";

// ---------------------------------------------------------------------------
// CRM Event Map — every automation-relevant event and its payload
// ---------------------------------------------------------------------------
export interface CrmEventMap {
  "deal.created":      { deal: Deal };
  "deal.updated":      { deal: Deal; changes: Record<string, unknown> };
  "deal.stageChanged": { deal: Deal; fromStage: string; toStage: string };
  "deal.closedWon":    { deal: Deal };
  "contact.created":   { contact: Contact };
  "contact.updated":   { contact: Contact; changes: Record<string, unknown> };
  "activity.created":  { activity: Activity };
  "followup.created":  { followup: Followup };
  "followup.completed":{ followup: Followup };
  "invoice.created":   { invoice: Invoice };
  "message.received":  { message: Message };
}

export type CrmEventName = keyof CrmEventMap;

// ---------------------------------------------------------------------------
// Typed Event Bus
// ---------------------------------------------------------------------------
class CrmEventBus extends EventEmitter {
  private isDev = process.env.NODE_ENV !== "production";

  /** Emit a typed CRM event. Listeners run in the next tick so they never
   *  block or break the HTTP response that triggered them. */
  emitCrm<K extends CrmEventName>(event: K, payload: CrmEventMap[K]): void {
    if (this.isDev) {
      console.log(`⚡ [event] ${event}`);
    }
    // Fire listeners asynchronously — a failing automation must never crash the request
    process.nextTick(() => {
      try {
        this.emit(event, payload);
      } catch (err) {
        console.error(`[event] listener error on "${event}":`, err);
      }
    });
  }

  /** Register a typed listener for a CRM event. */
  onCrm<K extends CrmEventName>(event: K, listener: (payload: CrmEventMap[K]) => void): this {
    // Wrap listener in try/catch so one bad automation can't take down others
    this.on(event, (payload: CrmEventMap[K]) => {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[automation] error in "${event}" handler:`, err);
      }
    });
    return this;
  }
}

/** Singleton event bus for the entire CRM */
export const crmEvents = new CrmEventBus();
