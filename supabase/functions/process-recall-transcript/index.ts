import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseTranscriptStreaming } from '../_shared/transcript-streaming-parser.ts';
import type { RecallBotTrackingRow, TranscriptMetadata } from '../_shared/recall-bot-types.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Only POST method is allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('[process-recall-transcript] Supabase configuration missing');
      return new Response(
        JSON.stringify({ success: false, error: "Database configuration missing" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    console.log('[process-recall-transcript] Starting transcript processing batch...');

    const { data: pendingBots, error: queryError } = await supabaseClient
      .from('recall_bot_tracking')
      .select(`
        bot_id,
        meeting_id,
        project_id,
        recording_id,
        transcript_download_url,
        transcript_processing_attempts,
        transcript_provider
      `)
      .eq('current_status', 'done')
      .eq('transcript_status', 'done')
      .eq('transcript_requested', true)
      .eq('transcript_processed', false)
      .not('transcript_download_url', 'is', null)
      .or(`transcript_next_retry_at.is.null,transcript_next_retry_at.lte.${new Date().toISOString()}`)
      .limit(10)
      .returns<Pick<RecallBotTrackingRow, 'bot_id' | 'meeting_id' | 'project_id' | 'recording_id' | 'transcript_download_url' | 'transcript_processing_attempts' | 'transcript_provider'>[]>();

    if (queryError) {
      console.error('[process-recall-transcript] Error querying pending bots:', queryError);
      return new Response(
        JSON.stringify({ success: false, error: queryError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!pendingBots || pendingBots.length === 0) {
      console.log('[process-recall-transcript] No pending transcripts to process');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending transcripts', processed: 0 }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`[process-recall-transcript] Found ${pendingBots.length} pending transcripts`);

    let processedCount = 0;
    let failedCount = 0;

    for (const bot of pendingBots) {
      try {
        console.log(`[process-recall-transcript] Processing bot ${bot.bot_id}...`);

        if (!bot.transcript_download_url) {
          throw new Error('Transcript download URL is missing');
        }

        const parsed = await parseTranscriptStreaming(bot.transcript_download_url);

        const transcriptMetadata: TranscriptMetadata = {
          original_words: parsed.wordCount,
          grouped_by_speaker: parsed.groupedBySpeaker,
          conversation_format: parsed.conversationFormat,
          speakers: parsed.speakers,
          duration_seconds: parsed.durationSeconds,
          language: (bot.transcript_provider as any)?.recallai_async?.language_code || 'pt',
          bot_id: bot.bot_id,
          recording_id: bot.recording_id || null,
          processed_at: new Date().toISOString()
        };

        if (!bot.meeting_id) {
          console.warn(`[process-recall-transcript] Bot ${bot.bot_id} has no meeting_id, skipping transcript save`);
          continue;
        }

        const { error: insertError } = await supabaseClient
          .from('meeting_transcripts')
          .upsert({
            meeting_id: bot.meeting_id,
            project_id: bot.project_id,
            transcript_text: parsed.plainText,
            transcript_metadata: transcriptMetadata
          }, {
            onConflict: 'meeting_id',
            ignoreDuplicates: false
          });

        if (insertError) {
          throw new Error(`Failed to insert transcript: ${insertError.message}`);
        }

        const { error: updateError } = await supabaseClient
          .from('recall_bot_tracking')
          .update({
            transcript_processed: true,
            transcript_processed_at: new Date().toISOString(),
            transcript_processing_attempts: (bot.transcript_processing_attempts || 0) + 1,
            transcript_last_error: null,
            transcript_next_retry_at: null
          })
          .eq('bot_id', bot.bot_id);

        if (updateError) {
          console.error(`[process-recall-transcript] Failed to update processed flag for bot ${bot.bot_id}:`, updateError);
        } else {
          processedCount++;
          console.log(`[process-recall-transcript] Successfully processed bot ${bot.bot_id}`);
        }

      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[process-recall-transcript] Failed to process bot ${bot.bot_id}:`, errorMessage);

        const attempts = (bot.transcript_processing_attempts || 0) + 1;
        const maxRetries = 5;

        if (attempts < maxRetries) {
          const delayMinutes = Math.pow(2, attempts - 1);
          const nextRetry = new Date();
          nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);

          console.log(`[process-recall-transcript] Scheduling retry ${attempts}/${maxRetries} for bot ${bot.bot_id} in ${delayMinutes} minutes`);

          await supabaseClient
            .from('recall_bot_tracking')
            .update({
              transcript_processing_attempts: attempts,
              transcript_last_error: errorMessage,
              transcript_next_retry_at: nextRetry.toISOString()
            })
            .eq('bot_id', bot.bot_id);
        } else {
          console.error(`[process-recall-transcript] Max retries exceeded for bot ${bot.bot_id}`);

          await supabaseClient
            .from('recall_bot_tracking')
            .update({
              transcript_processing_attempts: attempts,
              transcript_last_error: `Max retries exceeded: ${errorMessage}`,
              transcript_next_retry_at: null
            })
            .eq('bot_id', bot.bot_id);
        }
      }
    }

    console.log(`[process-recall-transcript] Batch complete: ${processedCount} processed, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        failed: failedCount,
        total: pendingBots.length
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[process-recall-transcript] Unexpected error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
