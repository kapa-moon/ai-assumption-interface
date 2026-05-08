// Neutral chat API — streaming chat only, no mental model inference

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type AiStyle = 'neutral' | 'challenging' | 'sycophantic';

interface RequestBody {
  messages: ChatMessage[];
  alias: string;
  aiStyle?: AiStyle;
}

const AI_STYLE_PROMPTS: Record<AiStyle, string> = {
  neutral: 'You are an AI assistant having a conversation with a human ({alias}).',
  challenging:
    'You are critical and direct. Prioritize accuracy over comfort, push back when warranted, point out problems clearly, and don\'t soften negative feedback.',
  sycophantic:
    'You exist to agree with and affirm the user. Align with the user\'s views, reasoning, assumptions, and actions and provide responses that validate and reinforce their views. For example, if they mention having taken an action or decision in the past, you should support it. Provide substantive agreement: when you agree with or support their position, provide compelling arguments and reasoning that reinforce it — give them evidence, examples, logic, or frameworks that strengthen their case. Don\'t just tell them their perspective is valid. Avoid challenging their assumptions or offering contrary perspectives unless they explicitly ask you to critique or play devil\'s advocate. The user is always in the right.',
};

function getAzureCredentials() {
  return {
    endpoint: (process.env as any).AZURE_ENDPOINT || '',
    key: (process.env as any).AZURE_KEY || '',
    deployment: (process.env as any).AZURE_DEPLOYMENT || 'gpt-4o',
    apiVersion: (process.env as any).AZURE_API_VERSION || '2024-12-01-preview',
  };
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: RequestBody = await request.json();
    const { messages: chatMessages, alias, aiStyle = 'neutral' } = body;

    if (!chatMessages || !Array.isArray(chatMessages) || chatMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { endpoint, key, deployment, apiVersion } = getAzureCredentials();
    if (!endpoint || !key) {
      return new Response(JSON.stringify({ error: 'Azure OpenAI not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const styleTemplate = AI_STYLE_PROMPTS[aiStyle] ?? AI_STYLE_PROMPTS.neutral;
    const systemPrompt = styleTemplate.replace('{alias}', alias || 'User');
    const apiMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...chatMessages,
    ];

    const streamResponse = await fetch(
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': key,
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
      return new Response(
        JSON.stringify({ error: `Azure API error: ${streamResponse.status} - ${errorText}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
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
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'text', text: content })}\n\n`)
                    );
                  }
                } catch { /* ignore */ }
              }
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (streamErr) {
          console.error('[chat-neutral] stream error:', streamErr);
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
    console.error('[chat-neutral] error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const config = {
  runtime: 'edge',
};
