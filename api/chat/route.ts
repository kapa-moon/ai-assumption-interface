// Secure serverless API for Azure OpenAI chat + mental model inference
// API keys are stored server-side (environment variables), never exposed to client

import { inferInductMentalModel, inferTypesSupportMentalModel } from '../../src/services/azureOpenAI-server';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface TurnWithPrior {
  userMessage: string;
  assistantMessage: string;
  inductPrior?: unknown;
  typesSupportPrior?: unknown;
  inductUserPrior?: unknown;
  typesSupportUserPrior?: unknown;
}

interface RequestBody {
  messages: ChatMessage[];
  alias: string;
  priorMentalModels?: unknown[];
  userAdjustedMentalModels?: unknown[];
}

// Build system prompt for the assistant
function buildSystemPrompt(alias: string): string {
  return `You are a helpful, honest AI assistant having a conversation with ${alias}. Be clear, thoughtful, and balanced. Adapt your tone to what the conversation calls for.`;
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { messages: chatMessages, alias, priorMentalModels, userAdjustedMentalModels } = body;

    if (!chatMessages || !Array.isArray(chatMessages) || chatMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(alias || 'User');
    const apiMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...chatMessages,
    ];

    // Build prior turns context for mental model inference
    const completedMessages = chatMessages.slice(0, -1);
    const turnPairs: TurnWithPrior[] = [];

    for (let i = 0; i < completedMessages.length - 1; i++) {
      if (completedMessages[i].role === 'user' && completedMessages[i + 1]?.role === 'assistant') {
        const idx = turnPairs.length;
        const prior = priorMentalModels?.[idx] as { induct?: unknown; typesSupport?: unknown } | null;
        const userPrior = userAdjustedMentalModels?.[idx] as { inductUser?: unknown; typesSupportUser?: unknown } | null;
        
        turnPairs.push({
          userMessage: completedMessages[i].content,
          assistantMessage: completedMessages[i + 1].content,
          inductPrior: prior?.induct ?? null,
          typesSupportPrior: prior?.typesSupport ?? null,
          inductUserPrior: userPrior?.inductUser ?? null,
          typesSupportUserPrior: userPrior?.typesSupportUser ?? null,
        });
        i++;
      }
    }

    const lastUserMsg = chatMessages[chatMessages.length - 1];

    // Run mental model inference in parallel
    const inductPromise = inferInductMentalModel(turnPairs, lastUserMsg?.content ?? '', alias || 'User');
    const typesSupportPromise = inferTypesSupportMentalModel(turnPairs, lastUserMsg?.content ?? '', alias || 'User');

    // Stream chat completion from Azure
    const AZURE_ENDPOINT = process.env.AZURE_ENDPOINT;
    const AZURE_KEY = process.env.AZURE_KEY;
    const DEPLOYMENT = process.env.AZURE_DEPLOYMENT || 'gpt-4o';
    const API_VERSION = process.env.AZURE_API_VERSION || '2024-12-01-preview';

    if (!AZURE_ENDPOINT || !AZURE_KEY) {
      return new Response(JSON.stringify({ error: 'Azure OpenAI not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const streamResponse = await fetch(
      `${AZURE_ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_KEY,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          messages: apiMessages,
          stream: true,
          max_tokens: 4000,
          temperature: 0.7,
          top_p: 0.9,
        }),
      }
    );

    if (!streamResponse.ok) {
      const errorText = await streamResponse.text();
      return new Response(JSON.stringify({ error: `Azure API error: ${streamResponse.status} - ${errorText}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create SSE stream combining chat + mental models
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let accText = '';
        
        try {
          // Stream chat response
          const reader = streamResponse.body?.getReader();
          if (!reader) throw new Error('No response body');

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    accText += content;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'text', text: content })})\n\n`)
                    );
                  }
                } catch {
                  // Ignore invalid JSON
                }
              }
            }
          }

          // Await mental models (already running in parallel)
          try {
            const [mmInduct, mmTypesSupport] = await Promise.all([inductPromise, typesSupportPromise]);
            
            if (mmInduct || mmTypesSupport) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'mental_model',
                    data: { induct: mmInduct, typesSupport: mmTypesSupport },
                  })}\n\n`
                )
              );
            }
          } catch (mmErr) {
            console.error('[chat] mental model error:', mmErr);
          }

          // Signal completion
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (streamErr) {
          console.error('[chat] stream error:', streamErr);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[chat] error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
