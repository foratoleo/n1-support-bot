/**
 * Event Processor for Recall.ai Calendar Webhooks
 *
 * Handles calendar.update and calendar.sync_events webhook events
 * Manages bot scheduling for calendar events with meeting URLs
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { extractMeetingUrl } from "./meeting-url-extractor.ts";
import type {
  RecallCalendarEvent,
  RecallCalendarStatus,
  SyncEventsResult,
  CalendarConnectionRow,
  CalendarSelectionRow,
  EventBotScheduleInsert,
  BotScheduleStatus,
} from "./types.ts";

// --- Environment Variables ---
const RECALL_API_KEY = Deno.env.get("RECALL_API_KEY") || "";
const RECALL_REGION = Deno.env.get("RECALL_REGION") || "us-west-2";
const RECALL_API_BASE_URL = `https://${RECALL_REGION}.recall.ai/api/v2`;
const SUPABASE_URL = Deno.env.get("DB_URL") || Deno.env.get("SUPABASE_URL") || "";

/**
 * Process calendar.update webhook event
 * Updates calendar connection status in database
 *
 * @param supabase - Supabase client instance
 * @param calendarId - Recall.ai calendar ID
 * @param status - New calendar status
 * @param errorMessage - Optional error message
 */
export async function processCalendarUpdate(
  supabase: SupabaseClient,
  calendarId: string,
  status: RecallCalendarStatus,
  errorMessage?: string
): Promise<void> {
  console.log(`[CALENDAR-WEBHOOK] Processing calendar.update: ${calendarId} -> ${status}`);

  // Find connection by recall_calendar_id
  const { data: connection, error: findError } = await supabase
    .from("user_calendar_connections")
    .select("id, user_id")
    .eq("recall_calendar_id", calendarId)
    .maybeSingle();

  if (findError) {
    console.error(`[CALENDAR-WEBHOOK] Error finding connection: ${findError.message}`);
    throw findError;
  }

  if (!connection) {
    console.warn(`[CALENDAR-WEBHOOK] No connection found for calendar_id: ${calendarId}`);
    return;
  }

  // Update connection status
  const { error: updateError } = await supabase
    .from("user_calendar_connections")
    .update({
      recall_calendar_status: status,
      last_error: errorMessage || null,
      last_sync_at: status === 'active' ? new Date().toISOString() : undefined,
    })
    .eq("id", connection.id);

  if (updateError) {
    console.error(`[CALENDAR-WEBHOOK] Error updating connection: ${updateError.message}`);
    throw updateError;
  }

  console.log(`[CALENDAR-WEBHOOK] Calendar status updated: ${connection.id} -> ${status}`);
}

/**
 * Fetch calendar events from Recall.ai API
 *
 * @param calendarId - Recall.ai calendar ID
 * @returns Array of calendar events
 */
async function fetchCalendarEvents(calendarId: string): Promise<RecallCalendarEvent[]> {
  const url = `${RECALL_API_BASE_URL}/calendar/${calendarId}/events`;

  console.log(`[CALENDAR-WEBHOOK] Fetching events from: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Token ${RECALL_API_KEY}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Recall API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Handle paginated response
  if (Array.isArray(data)) {
    return data;
  }

  // Handle object with results array
  if (data.results && Array.isArray(data.results)) {
    return data.results;
  }

  console.warn(`[CALENDAR-WEBHOOK] Unexpected API response format`);
  return [];
}

/**
 * Schedule a bot for a calendar event
 * Calls recall-bot-create Edge Function
 *
 * @param supabase - Supabase client instance
 * @param event - Calendar event to schedule bot for
 * @param connection - Calendar connection details
 * @param selection - Calendar selection details
 * @returns Bot ID if scheduled successfully
 */
async function scheduleBotForEvent(
  supabase: SupabaseClient,
  event: RecallCalendarEvent,
  connection: CalendarConnectionRow,
  selection: CalendarSelectionRow,
  meetingUrl: string,
  platform: string
): Promise<{ botId: string | null; error: string | null }> {
  try {
    console.log(`[CALENDAR-WEBHOOK] Scheduling bot for event: ${event.id} - ${event.title}`);

    // Call recall-bot-create Edge Function
    const botCreateUrl = `${SUPABASE_URL}/functions/v1/recall-bot-create`;

    const response = await fetch(botCreateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
      },
      body: JSON.stringify({
        meetingUrl: meetingUrl,
        botName: "DR AI Assistant",
        joinAt: event.start_time,
        meetingTitle: event.title || "Calendar Meeting",
        createdBy: connection.user_id,
        meetingType: "calendar_auto",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CALENDAR-WEBHOOK] Bot creation failed: ${errorText}`);
      return { botId: null, error: `Bot creation failed: ${response.status}` };
    }

    const botData = await response.json();

    console.log(`[CALENDAR-WEBHOOK] Bot scheduled successfully: ${botData.recallBotId}`);

    return { botId: botData.recallBotId, error: null };
  } catch (error) {
    console.error(`[CALENDAR-WEBHOOK] Error scheduling bot:`, error);
    return { botId: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Process calendar.sync_events webhook event
 * Fetches updated events and schedules bots as needed
 *
 * @param supabase - Supabase client instance
 * @param calendarId - Recall.ai calendar ID
 * @returns Processing result with counts
 */
export async function processSyncEvents(
  supabase: SupabaseClient,
  calendarId: string
): Promise<SyncEventsResult> {
  console.log(`[CALENDAR-WEBHOOK] Processing calendar.sync_events: ${calendarId}`);

  const result: SyncEventsResult = {
    processed: 0,
    scheduled: 0,
    errors: 0,
    details: [],
  };

  // Find connection by recall_calendar_id
  const { data: connection, error: connectionError } = await supabase
    .from("user_calendar_connections")
    .select("*")
    .eq("recall_calendar_id", calendarId)
    .maybeSingle();

  if (connectionError || !connection) {
    console.error(`[CALENDAR-WEBHOOK] Connection not found for calendar: ${calendarId}`);
    throw new Error(`Connection not found for calendar: ${calendarId}`);
  }

  // Get monitored calendar selections for this connection
  const { data: selections, error: selectionsError } = await supabase
    .from("user_calendar_selections")
    .select("*")
    .eq("connection_id", connection.id)
    .eq("is_monitored", true);

  if (selectionsError) {
    console.error(`[CALENDAR-WEBHOOK] Error fetching selections: ${selectionsError.message}`);
    throw selectionsError;
  }

  if (!selections || selections.length === 0) {
    console.warn(`[CALENDAR-WEBHOOK] No monitored calendars for connection: ${connection.id}`);
    return result;
  }

  // Fetch events from Recall.ai
  let events: RecallCalendarEvent[];
  try {
    events = await fetchCalendarEvents(calendarId);
  } catch (error) {
    console.error(`[CALENDAR-WEBHOOK] Error fetching events:`, error);
    throw error;
  }

  console.log(`[CALENDAR-WEBHOOK] Fetched ${events.length} events from Recall.ai`);

  // Process each event
  for (const event of events) {
    // Skip deleted events
    if (event.is_deleted) {
      console.log(`[CALENDAR-WEBHOOK] Skipping deleted event: ${event.id}`);
      result.details.push({ eventId: event.id, action: 'skipped' });
      continue;
    }

    // Skip past events (start_time in the past)
    const eventStart = new Date(event.start_time);
    if (eventStart < new Date()) {
      console.log(`[CALENDAR-WEBHOOK] Skipping past event: ${event.id}`);
      result.details.push({ eventId: event.id, action: 'skipped' });
      continue;
    }

    // Extract meeting URL
    const { url: meetingUrl, platform } = extractMeetingUrl(event);

    // Use first monitored selection (primary calendar)
    // In the future, could match by ms_calendar_id
    if (selections.length === 0) {
      console.warn(`[CALENDAR-WEBHOOK] No monitored calendars for event: ${event.id}`);
      result.details.push({ eventId: event.id, action: 'skipped' });
      continue;
    }
    const selection = selections[0] as CalendarSelectionRow;

    // Prepare upsert data
    const scheduleData: EventBotScheduleInsert = {
      calendar_selection_id: selection.id,
      user_id: connection.user_id,
      ms_event_id: event.id, // Using Recall event ID as ms_event_id for now
      ms_event_icaluid: event.ical_uid || null,
      recall_event_id: event.id,
      event_title: event.title || "Untitled Meeting",
      event_start: event.start_time,
      event_end: event.end_time,
      meeting_url: meetingUrl,
      meeting_platform: platform !== 'unknown' ? platform : null,
      is_recording_enabled: meetingUrl !== null,
    };

    try {
      // Check if event already exists
      const { data: existing } = await supabase
        .from("calendar_event_bot_schedule")
        .select("id, recall_bot_id, bot_status, manually_disabled")
        .eq("calendar_selection_id", selection.id)
        .eq("ms_event_id", event.id)
        .maybeSingle();

      if (existing) {
        // Update existing event (preserve bot_id if already scheduled)
        const updateData: Partial<EventBotScheduleInsert> = {
          event_title: scheduleData.event_title,
          event_start: scheduleData.event_start,
          event_end: scheduleData.event_end,
          meeting_url: scheduleData.meeting_url,
          meeting_platform: scheduleData.meeting_platform,
          recall_event_id: scheduleData.recall_event_id,
          ms_event_icaluid: scheduleData.ms_event_icaluid,
        };

        await supabase
          .from("calendar_event_bot_schedule")
          .update(updateData)
          .eq("id", existing.id);

        result.processed++;
        result.details.push({ eventId: event.id, action: 'upserted' });

        // Check if we should schedule a bot (not already scheduled, not manually disabled)
        if (
          !existing.recall_bot_id &&
          !existing.manually_disabled &&
          meetingUrl &&
          selection.auto_record_all
        ) {
          const { botId, error } = await scheduleBotForEvent(
            supabase,
            event,
            connection as CalendarConnectionRow,
            selection,
            meetingUrl,
            platform
          );

          if (botId) {
            await supabase
              .from("calendar_event_bot_schedule")
              .update({
                recall_bot_id: botId,
                bot_status: 'scheduled' as BotScheduleStatus,
                schedule_error: null,
              })
              .eq("id", existing.id);

            result.scheduled++;
            result.details.push({ eventId: event.id, action: 'scheduled' });
          } else if (error) {
            await supabase
              .from("calendar_event_bot_schedule")
              .update({
                bot_status: 'error' as BotScheduleStatus,
                schedule_error: error,
              })
              .eq("id", existing.id);

            result.errors++;
            result.details.push({ eventId: event.id, action: 'error', error });
          }
        }
      } else {
        // Insert new event
        const { data: inserted, error: insertError } = await supabase
          .from("calendar_event_bot_schedule")
          .insert(scheduleData)
          .select("id")
          .single();

        if (insertError) {
          console.error(`[CALENDAR-WEBHOOK] Error inserting event: ${insertError.message}`);
          result.errors++;
          result.details.push({ eventId: event.id, action: 'error', error: insertError.message });
          continue;
        }

        result.processed++;
        result.details.push({ eventId: event.id, action: 'upserted' });

        // Schedule bot if auto_record_all is enabled and has meeting URL
        if (meetingUrl && selection.auto_record_all) {
          const { botId, error } = await scheduleBotForEvent(
            supabase,
            event,
            connection as CalendarConnectionRow,
            selection,
            meetingUrl,
            platform
          );

          if (botId) {
            await supabase
              .from("calendar_event_bot_schedule")
              .update({
                recall_bot_id: botId,
                bot_status: 'scheduled' as BotScheduleStatus,
                schedule_error: null,
              })
              .eq("id", inserted.id);

            result.scheduled++;
            result.details.push({ eventId: event.id, action: 'scheduled' });
          } else if (error) {
            await supabase
              .from("calendar_event_bot_schedule")
              .update({
                bot_status: 'error' as BotScheduleStatus,
                schedule_error: error,
              })
              .eq("id", inserted.id);

            result.errors++;
            result.details.push({ eventId: event.id, action: 'error', error });
          }
        }
      }
    } catch (error) {
      console.error(`[CALENDAR-WEBHOOK] Error processing event ${event.id}:`, error);
      result.errors++;
      result.details.push({
        eventId: event.id,
        action: 'error',
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Update connection last_sync_at
  await supabase
    .from("user_calendar_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", connection.id);

  console.log(`[CALENDAR-WEBHOOK] Sync complete. Processed: ${result.processed}, Scheduled: ${result.scheduled}, Errors: ${result.errors}`);

  return result;
}
