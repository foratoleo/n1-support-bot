/**
 * Recall.ai Calendar Webhook Handler
 *
 * Runtime: Supabase Edge Function (Deno)
 * Purpose: Handle Recall.ai Calendar V2 webhook events for calendar sync
 *
 * Webhook Events:
 * - calendar.update: Calendar status changed (pending, active, error, disconnected)
 * - calendar.sync_events: Calendar events have been synced/updated
 *
 * @see https://docs.recall.ai/docs/calendar-v2
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod";
import { processCalendarUpdate, processSyncEvents } from "./event-processor.ts";
import type { RecallCalendarStatus } from "./types.ts";

// --- Environment Variables ---
const SUPABASE_URL = Deno.env.get("DB_URL") || Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("DB_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RECALL_WEBHOOK_SECRET = Deno.env.get("RECALL_CALENDAR_WEBHOOK_SECRET") || "";

// --- Supabase Client ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- CORS Headers ---
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, recall-webhook-signature, x-recall-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

// --- Webhook Event Schemas ---
const CalendarUpdateSchema = z.object({
  event: z.literal("calendar.update"),
  calendar_id: z.string(),
  timestamp: z.string().optional(),
  data: z.object({
    status: z.enum(["pending", "active", "error", "disconnected"]),
    error_message: z.string().optional(),
  }),
});

const CalendarSyncEventsSchema = z.object({
  event: z.literal("calendar.sync_events"),
  calendar_id: z.string(),
  timestamp: z.string().optional(),
  data: z.object({
    events_added: z.number().optional(),
    events_updated: z.number().optional(),
    events_deleted: z.number().optional(),
  }).optional(),
});

const WebhookEventSchema = z.discriminatedUnion("event", [
  CalendarUpdateSchema,
  CalendarSyncEventsSchema,
]);

// --- Signature Verification ---
/**
 * Verify webhook signature (HMAC-SHA256)
 * Uses Recall-Webhook-Signature header
 *
 * @param payload - Raw request body
 * @param signature - Signature from header
 * @param secret - Webhook secret
 * @returns True if signature is valid
 */
async function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  // Check if secret is configured
  if (!secret) {
    // Only skip verification if explicitly allowed via environment variable
    const skipVerification = Deno.env.get("SKIP_WEBHOOK_VERIFICATION") === "true";
    if (skipVerification) {
      console.warn("[CALENDAR-WEBHOOK] SKIP_WEBHOOK_VERIFICATION is enabled - skipping signature verification (development only)");
      return true;
    }
    console.error("[CALENDAR-WEBHOOK] RECALL_CALENDAR_WEBHOOK_SECRET not configured - rejecting webhook");
    return false;
  }

  // Fail if signature required but not provided
  if (!signature) {
    console.warn("[CALENDAR-WEBHOOK] Missing webhook signature");
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const calculatedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Handle different signature formats (with or without prefix)
    const normalizedSignature = signature.replace(/^sha256=/, "").toLowerCase();
    const normalizedCalculated = calculatedSignature.toLowerCase();

    return normalizedSignature === normalizedCalculated;
  } catch (error) {
    console.error("[CALENDAR-WEBHOOK] Signature verification error:", error);
    return false;
  }
}

// --- Main Handler ---
Deno.serve(async (req) => {
  const startTime = Date.now();

  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS });
    }

    // Only allow POST
    if (req.method !== "POST") {
      return Response.json(
        { error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is allowed" } },
        { status: 405, headers: CORS }
      );
    }

    // Get raw body for signature verification
    const rawBody = await req.text();

    // Verify webhook signature
    const signature =
      req.headers.get("Recall-Webhook-Signature") ||
      req.headers.get("x-recall-signature");

    const isValidSignature = await verifyWebhookSignature(
      rawBody,
      signature,
      RECALL_WEBHOOK_SECRET
    );

    if (!isValidSignature) {
      console.error("[CALENDAR-WEBHOOK] Invalid webhook signature");
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid signature" } },
        { status: 401, headers: CORS }
      );
    }

    // Parse body
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error("[CALENDAR-WEBHOOK] Invalid JSON body");
      return Response.json(
        { success: false, error: "Invalid JSON" },
        { status: 200, headers: CORS }
      );
    }

    console.log(`[CALENDAR-WEBHOOK] Received event:`, JSON.stringify(body));

    // Validate webhook event
    const parsed = WebhookEventSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[CALENDAR-WEBHOOK] Invalid webhook event:", parsed.error.message);
      // Return 200 to acknowledge receipt even if invalid (prevents retries)
      return Response.json(
        { success: false, error: "Invalid webhook event" },
        { status: 200, headers: CORS }
      );
    }

    const event = parsed.data;
    let result: unknown;

    // Route to appropriate handler
    switch (event.event) {
      case "calendar.update": {
        await processCalendarUpdate(
          supabase,
          event.calendar_id,
          event.data.status as RecallCalendarStatus,
          event.data.error_message
        );
        result = { event: "calendar.update", status: event.data.status };
        break;
      }

      case "calendar.sync_events": {
        const syncResult = await processSyncEvents(supabase, event.calendar_id);
        result = {
          event: "calendar.sync_events",
          processed: syncResult.processed,
          scheduled: syncResult.scheduled,
          errors: syncResult.errors,
        };
        break;
      }

      default: {
        // Type guard ensures this is unreachable
        const _exhaustive: never = event;
        console.log(`[CALENDAR-WEBHOOK] Unknown event type`);
        return Response.json(
          { success: false, error: "Unknown event type" },
          { status: 200, headers: CORS }
        );
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CALENDAR-WEBHOOK] Processed in ${duration}ms:`, result);

    // Always return 200 to acknowledge receipt
    return Response.json(
      { success: true, ...result, processingTimeMs: duration },
      { headers: CORS }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[CALENDAR-WEBHOOK] Error processing webhook:", errorMessage);

    // Always return 200 to prevent retries (log error for debugging)
    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: errorMessage || "Unexpected error",
        },
      },
      { headers: CORS }
    );
  }
});
