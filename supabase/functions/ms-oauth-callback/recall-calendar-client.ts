// file: supabase/functions/ms-oauth-callback/recall-calendar-client.ts
// Runtime: Supabase Edge Function (Deno)
// Purpose: Recall.ai Calendar V2 API client

// --- Environment Variables (lazy initialization) ---
let _recallApiKey: string | null = null;

/**
 * Get Recall API key from environment (lazy initialization)
 * Validates on first use instead of module load time to prevent crashes
 */
function getRecallApiKey(): string {
  if (_recallApiKey !== null) {
    return _recallApiKey;
  }

  const key = Deno.env.get("RECALL_API_KEY");
  if (!key) {
    throw new Error("Missing env: RECALL_API_KEY");
  }

  _recallApiKey = key;
  return _recallApiKey;
}

const RECALL_REGION = Deno.env.get("RECALL_REGION") || "us-west-2";

// --- Types ---
export interface RecallCalendarCreateParams {
  platform: "microsoft_outlook";
  oauth_client_id: string;
  oauth_client_secret: string;
  oauth_refresh_token: string;
  webhook_url: string;
}

export interface RecallCalendarCreateResponse {
  id: string;
  platform: string;
  status?: string;
  created_at?: string;
}

export interface RecallCalendarErrorResponse {
  error: string;
  detail?: string;
  status?: number;
}

/**
 * Create a new Recall.ai Calendar V2 connection
 * POST https://{region}.recall.ai/api/v2/calendars/
 */
export async function createRecallCalendar(
  params: RecallCalendarCreateParams
): Promise<{ id: string } | { error: string }> {
  const apiUrl = `https://${RECALL_REGION}.recall.ai/api/v2/calendars/`;

  try {
    console.log("[RecallCalendar] Creating calendar with platform:", params.platform);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${getRecallApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform: params.platform,
        oauth_client_id: params.oauth_client_id,
        oauth_client_secret: params.oauth_client_secret,
        oauth_refresh_token: params.oauth_refresh_token,
        webhook_url: params.webhook_url,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[RecallCalendar] API error: ${response.status} - ${errorText}`
      );

      let errorMessage = `Recall API error: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.detail || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      return { error: errorMessage };
    }

    const data: RecallCalendarCreateResponse = await response.json();

    console.log("[RecallCalendar] Calendar created successfully:", data.id);

    return { id: data.id };
  } catch (error) {
    console.error("[RecallCalendar] Error creating calendar:", error);
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a Recall.ai Calendar V2 connection
 * DELETE https://{region}.recall.ai/api/v2/calendars/{id}/
 */
export async function deleteRecallCalendar(
  calendarId: string
): Promise<{ success: boolean } | { error: string }> {
  const apiUrl = `https://${RECALL_REGION}.recall.ai/api/v2/calendars/${calendarId}/`;

  try {
    console.log("[RecallCalendar] Deleting calendar:", calendarId);

    const response = await fetch(apiUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Token ${getRecallApiKey()}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[RecallCalendar] Delete error: ${response.status} - ${errorText}`
      );
      return { error: `Failed to delete calendar: ${response.status}` };
    }

    console.log("[RecallCalendar] Calendar deleted successfully");
    return { success: true };
  } catch (error) {
    console.error("[RecallCalendar] Error deleting calendar:", error);
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
