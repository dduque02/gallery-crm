import Anthropic from "@anthropic-ai/sdk";
import { z, type ZodSchema } from "zod";

// ---------------------------------------------------------------------------
// AI Service — thin wrapper around the Anthropic SDK
// Used by automations (lead classification, follow-up suggestions, etc.)
// If ANTHROPIC_API_KEY is not set, all methods return null (graceful no-op).
// ---------------------------------------------------------------------------

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[ai] ANTHROPIC_API_KEY not set — AI features disabled");
    return null;
  }
  client = new Anthropic({ apiKey });
  return client;
}

const DEFAULT_MODEL = process.env.AI_MODEL || "claude-sonnet-4-20250514";

/** Free-form classification: send a prompt, get a text response */
async function classify(prompt: string, systemPrompt?: string): Promise<string | null> {
  const ai = getClient();
  if (!ai) return null;

  const msg = await ai.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 512,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: "user", content: prompt }],
  });

  const block = msg.content[0];
  return block.type === "text" ? block.text : null;
}

/** Suggest next action given context */
async function suggest(prompt: string, context: Record<string, unknown>): Promise<string | null> {
  const systemPrompt =
    "Eres un asistente de ventas para Galería Duque Arango, una galería de arte colombiana. " +
    "Responde en español. Sé conciso y accionable.";

  const fullPrompt = `Contexto:\n${JSON.stringify(context, null, 2)}\n\nSolicitud:\n${prompt}`;
  return classify(fullPrompt, systemPrompt);
}

/** Get a structured (JSON) response validated against a Zod schema */
async function structured<T>(prompt: string, schema: ZodSchema<T>, systemPrompt?: string): Promise<T | null> {
  const ai = getClient();
  if (!ai) return null;

  const system = (systemPrompt || "") +
    "\n\nResponde SOLO con JSON válido, sin texto adicional ni markdown.";

  const msg = await ai.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1024,
    system: system.trim(),
    messages: [{ role: "user", content: prompt }],
  });

  const block = msg.content[0];
  if (block.type !== "text") return null;

  const parsed = JSON.parse(block.text);
  return schema.parse(parsed);
}

// ---------------------------------------------------------------------------
// Lead Classification — structured extraction from incoming messages
// ---------------------------------------------------------------------------

const LeadClassificationSchema = z.object({
  // Contact info extracted from the message
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactCity: z.string().nullable(),
  contactCountry: z.string().nullable(),
  contactType: z.enum(["collector", "artist", "institution", "gallery", "unknown"]),

  // Intent analysis
  intentType: z.enum([
    "purchase_inquiry",    // Wants to buy specific work
    "general_inquiry",     // General interest, browsing
    "price_request",       // Asking about pricing
    "visit_request",       // Wants to visit the gallery
    "consignment_offer",   // Offering work for consignment
    "artist_submission",   // Artist proposing representation
    "information",         // Just seeking info
    "other",
  ]),
  intentScore: z.number().min(0).max(100), // Purchase likelihood 0-100
  suggestedStage: z.enum(["qualification", "interest", "proposal", "negotiation"]),

  // Collector intelligence
  artistsMentioned: z.array(z.string()),
  budgetSignals: z.string().nullable(), // e.g. "mentioned $50k range"
  preferredMedium: z.string().nullable(),
  language: z.enum(["es", "en", "other"]),

  // Summary
  summary: z.string(), // 1-2 sentence summary for the advisor
});

export type LeadClassification = z.infer<typeof LeadClassificationSchema>;

const GALLERY_SYSTEM_PROMPT = `Eres un asistente de clasificación de leads para Galería Duque Arango, una galería colombiana con más de 40 años especializada en arte moderno y contemporáneo latinoamericano.

Artistas representados (mercado primario): Javier Caraballo, entre otros.
Mercado secundario: Fernando Botero, Olga de Amaral, Eduardo Ramírez Villamizar, entre otros.
Sedes: Medellín y Bogotá, Colombia.

Tu trabajo es analizar mensajes entrantes de potenciales clientes y extraer información estructurada para el CRM.

Reglas:
- Si el mensaje menciona una obra o artista específico, el intentScore debe ser >= 60
- Si pregunta por precio directamente, intentScore >= 70
- Si solo dice "hola" o pregunta información general, intentScore 10-30
- Detecta el idioma del mensaje (español o inglés)
- Si mencionan presupuesto o rango de precios, captura en budgetSignals
- artistsMentioned debe incluir SOLO nombres de artistas mencionados explícitamente
- contactType "collector" si parece comprador, "institution" si mencionan museo/fundación, etc.
- suggestedStage: "qualification" para primeros contactos, "interest" si hay intención clara, "proposal" si piden precio`;

async function classifyLead(
  messageBody: string,
  senderInfo?: { name?: string; email?: string; phone?: string },
): Promise<LeadClassification | null> {
  const prompt = `Analiza este mensaje entrante y extrae la información estructurada.

${senderInfo ? `Información del remitente: ${JSON.stringify(senderInfo)}` : ""}

Mensaje:
"""
${messageBody}
"""

Responde SOLO con JSON válido siguiendo el schema exacto.`;

  return structured(prompt, LeadClassificationSchema, GALLERY_SYSTEM_PROMPT);
}

async function draftReply(
  messageBody: string,
  classification: LeadClassification,
): Promise<string | null> {
  const lang = classification.language === "es" ? "español" : "inglés";

  const prompt = `Genera un borrador de respuesta en ${lang} para este mensaje de un potencial cliente.

Mensaje original:
"""
${messageBody}
"""

Clasificación del lead:
- Tipo: ${classification.contactType}
- Intención: ${classification.intentType}
- Score: ${classification.intentScore}/100
- Artistas mencionados: ${classification.artistsMentioned.join(", ") || "ninguno"}
- Resumen: ${classification.summary}

Reglas para la respuesta:
- Tono profesional pero cálido, como una galería de arte de alto nivel
- Si preguntan por precio, NO dar el precio — invitar a contactar al advisor o visitar la galería
- Si mencionan un artista específico, mostrar conocimiento sobre el artista
- Máximo 3-4 oraciones
- Firmar como "Galería Duque Arango"
- NO incluir subject line, solo el cuerpo del mensaje`;

  return classify(prompt, GALLERY_SYSTEM_PROMPT);
}

export const aiService = { classify, suggest, structured, classifyLead, draftReply };
