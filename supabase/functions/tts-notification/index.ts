import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import OpenAI from 'https://esm.sh/openai@4.28.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface NotificationRequest {
  type: 'good-night' | 'good-morning' | 'reminder' | 'custom';
  language: 'pt' | 'en';
  tone: 'warm' | 'professional' | 'casual' | 'friendly';
  recipient?: string;
  context?: string;
  user_id?: string;
  project_id?: string;
}

interface NotificationResponse {
  success: boolean;
  message?: string;
  response_id?: string;
  metadata?: {
    model: string;
    tokens: {
      input: number;
      output: number;
      total: number;
    };
    duration: number;
    cost: number;
  };
  error?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Parse request body
    const { type, language, tone, recipient, context, user_id, project_id }: NotificationRequest = await req.json();

    // Validate required fields
    if (!type || !language || !tone) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: type, language, tone',
        } as NotificationResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    });

    // Build system prompt based on message type and tone
    const systemPrompt = buildSystemPrompt(type, tone);
    const userPrompt = buildUserPrompt(type, language, recipient, context);

    const startTime = Date.now();

    // Generate message using OpenAI Responses API
    const response = await openai.responses.create({
      model: 'gpt-4o-mini',
      instructions: systemPrompt,
      input: userPrompt,
      temperature: type === 'reminder' ? 0.3 : 0.7,
      max_output_tokens: type === 'reminder' ? 200 : 150,
    });

    const content = response.output?.[0]?.content?.[0]?.text || '';
    const duration = Date.now() - startTime;

    // Calculate token usage
    const inputTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const outputTokens = Math.ceil(content.length / 4);
    const totalTokens = inputTokens + outputTokens;

    // Calculate cost (using gpt-4o-mini pricing)
    const cost = (totalTokens / 1000) * 0.00015;

    // Track AI interaction if user_id and project_id are provided
    if (user_id && project_id) {
      await supabaseClient.from('ai_interactions').insert({
        user_id,
        project_id,
        request_prompt: systemPrompt + '\n\n' + userPrompt,
        request_model: 'gpt-4o-mini',
        request_parameters: {
          temperature: type === 'reminder' ? 0.3 : 0.7,
          max_output_tokens: type === 'reminder' ? 200 : 150,
        },
        response_content: content,
        response_model: 'gpt-4o-mini',
        response_id: response.id,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        interaction_type: 'tts_notification',
        metadata: {
          notification_type: type,
          language,
          tone,
          recipient,
          context,
        },
      });
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: content.trim(),
        response_id: response.id || `resp_${Date.now()}`,
        metadata: {
          model: 'gpt-4o-mini',
          tokens: {
            input: inputTokens,
            output: outputTokens,
            total: totalTokens,
          },
          duration,
          cost: Number(cost.toFixed(6)),
        },
      } as NotificationResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in tts-notification function:', error);

    // Return fallback message on error
    const fallbackMessage = getFallbackMessage(type || 'custom', recipient);

    return new Response(
      JSON.stringify({
        success: true,
        message: fallbackMessage,
        response_id: `fallback_${Date.now()}`,
        metadata: {
          model: 'fallback',
          tokens: { input: 0, output: 0, total: 0 },
          duration: 0,
          cost: 0,
        },
        error: error.message,
      } as NotificationResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Still return 200 to allow graceful degradation
      }
    );
  }
});

function buildSystemPrompt(type: string, tone: string): string {
  const toneInstructions = {
    warm: 'Seja caloroso, acolhedor e transmita uma sensação de cuidado e carinho.',
    professional: 'Mantenha um tom profissional, respeitoso e adequado para o ambiente de trabalho.',
    casual: 'Use uma linguagem descontraída e informal, como se estivesse falando com um amigo.',
    friendly: 'Seja amigável, positivo e acessível, mantendo um equilíbrio entre casual e profissional.',
  };

  const basePrompt = `Você é um assistente que gera mensagens de notificação. ${toneInstructions[tone as keyof typeof toneInstructions] || toneInstructions.warm}`;

  switch (type) {
    case 'good-night':
      return `${basePrompt} Suas mensagens de boa noite devem ser breves, reconfortantes e ideais para o final do dia. Inclua um desejo de um bom descanso e uma noite tranquila.`;
    case 'good-morning':
      return `${basePrompt} Suas mensagens de bom dia devem ser energizantes, positivas e motivadoras para o início do dia.`;
    case 'reminder':
      return `${basePrompt} Suas mensagens de lembrete devem ser claras, diretas e educadas. Inclua o propósito do lembrete de forma concisa.`;
    default:
      return basePrompt;
  }
}

function buildUserPrompt(
  type: string,
  language: 'pt' | 'en',
  recipient?: string,
  context?: string
): string {
  const recipientText = recipient ? ` para ${recipient}` : '';
  const contextText = context ? ` Contexto: ${context}` : '';

  const prompts = {
    pt: {
      'good-night': `Gere uma mensagem de boa noite${recipientText}. Seja breve e reconfortante.${contextText}`,
      'good-morning': `Gere uma mensagem de bom dia${recipientText}. Seja energizante e positiva.${contextText}`,
      'reminder': `Gere uma mensagem de lembrete${recipientText}.${contextText}`,
    },
    en: {
      'good-night': `Generate a good night message${recipientText}. Keep it brief and comforting.${contextText}`,
      'good-morning': `Generate a good morning message${recipientText}. Make it energizing and positive.${contextText}`,
      'reminder': `Generate a reminder message${recipientText}.${contextText}`,
    },
  };

  return prompts[language][type as keyof typeof prompts.pt] || prompts.pt['good-night'];
}

function getFallbackMessage(type: string, recipient?: string): string {
  const recipientText = recipient ? ` ${recipient}` : '';

  const fallbacks = {
    'good-night': `Boa noite${recipientText}! Desejo a você uma noite tranquila e um bom descanso. Amanhã é um novo dia cheio de oportunidades. 🌙`,
    'good-morning': `Bom dia${recipientText}! Tenha um dia produtivo e cheio de realizações. ☀️`,
    'reminder': `Lembrete gentil: Não se esqueça de suas tarefas importantes.`,
    'custom': 'Mensagem de notificação gerada.',
  };

  return fallbacks[type as keyof typeof fallbacks] || fallbacks.custom;
}