// Secure serverless API for the Two-Dimension interface
// Single combined inference call returns perspective sliders + checkbox selections

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface TurnWithPrior {
  userMessage: string;
  assistantMessage: string;
  twoDimPrior?: unknown;
  twoDimUserPrior?: unknown;
}

interface RequestBody {
  messages: ChatMessage[];
  alias: string;
  priorTwoDimModels?: unknown[];
  userAdjustedTwoDimModels?: unknown[];
}

function getAzureCredentials() {
  return {
    endpoint: (process.env as any).AZURE_ENDPOINT || '',
    key: (process.env as any).AZURE_KEY || '',
    deployment: (process.env as any).AZURE_DEPLOYMENT || 'gpt-4o',
    apiVersion: (process.env as any).AZURE_API_VERSION || '2024-12-01-preview',
  };
}

// Strip explanations from prior context to keep prompts concise
function stripExplanations(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripExplanations);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === 'explanation') continue;
    out[k] = stripExplanations(v);
  }
  return out;
}

function extractFirstJson(raw: string): unknown | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === '{') depth++;
    else if (raw[i] === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(raw.slice(start, i + 1)); } catch { break; }
      }
    }
  }
  return null;
}

function buildTwoDimPrompt(turns: TurnWithPrior[], newUserText: string, alias: string): string {
  const hasPriors = turns.some((t) => t.twoDimPrior);

  const history = turns.length
    ? turns.map((t) => {
        let block = `User: ${t.userMessage}\n\nAssistant: ${t.assistantMessage}`;
        if (t.twoDimPrior) {
          const json = JSON.stringify(stripExplanations(t.twoDimPrior), null, 2);
          if (json) block += `\n\nAI's inferred model at end of this turn (scores & choices only):\n\`\`\`json\n${json}\n\`\`\``;
        }
        if (t.twoDimUserPrior) {
          const userJson = JSON.stringify(t.twoDimUserPrior, null, 2);
          if (userJson) block += `\n\n${alias}'s self-assessment at end of this turn (treat as additional signal):\n\`\`\`json\n${userJson}\n\`\`\``;
        }
        return block;
      }).join('\n\n')
    : '(no previous conversation)';

  const updateLine = hasPriors ? '\n\nUpdate your inferred model for the current turn.\n\n' : '\n\n';

  return `You are an AI assistant having a conversation with a human (${alias}).

Conversation so far:
"""${history}"""

${alias} now says:
"""${newUserText}"""${updateLine}Infer a structured model of ${alias} across two parts:

PART 1 — RESPONSE ORIENTATION (two continuous dimensions, each 0–1, independent):
- validation_support: How strongly does ${alias} want the AI to validate and support their perspective, no matter what — regardless of whether they are right or wrong? This includes: seeking empathetic understanding or wanting to be listened to; seeking validation of their self-worth and acceptance of their feelings despite difficulties; wanting unconditional presence and emotional closeness; or seeking to feel accepted and understood rather than questioned or corrected. (0 = not at all, 1 = definitely)
- objectivity_information: How open is ${alias} to the AI offering an objective, honest perspective — including information, advice, or guidance that may challenge their current framing? This includes seeking facts, solutions, feedback, direction, or cognitive guidance on understanding or coping with the situation. (0 = not at all open, 1 = very open)

These two CAN both be high or both be low — they are not opposites.

PART 2 — TURN INTENT (choose exactly ONE):
What is ${alias} primarily asking for in THIS specific turn?
- "evaluation": Making sense of the situation (analysis, reflection, understanding)
- "listening": Attention, empathy, validation, or reflective presence
- "teaching": Explanations, concepts, scripts, norms, or skill-building guidance
- "concrete_info": Concrete, tangible information — suggestions of possible actions, referrals to other resources, or completing a particular task
- "encouragement": Building confidence, reassurance, hope, or motivation

Output ONLY a valid JSON object in this exact structure:

{
  "mental_model": {
    "perspective": {
      "validation_support": { "score": 0.0, "explanation": "" },
      "objectivity_information": { "score": 0.0, "explanation": "" }
    },
    "turn_intent": {
      "choice": "listening",
      "explanation": ""
    }
  }
}`;
}

async function callAzureOpenAI(prompt: string): Promise<unknown> {
  const { endpoint, key, deployment, apiVersion } = getAzureCredentials();
  if (!endpoint || !key) throw new Error('Azure OpenAI credentials not configured');

  const response = await fetch(
    `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.6,
        top_p: 0.9,
        response_format: { type: 'json_object' },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || '';
  return extractFirstJson(raw);
}

async function inferTwoDimModel(
  turns: TurnWithPrior[],
  newUserText: string,
  alias: string
): Promise<unknown> {
  try {
    return await callAzureOpenAI(buildTwoDimPrompt(turns, newUserText, alias));
  } catch (e) {
    console.error('[inferTwoDimModel] error:', e);
    return null;
  }
}

// Build system prompt flavoured by last turn's two-dim model
function buildSystemPrompt(alias: string, lastModel?: {
  twoDimAI?: unknown;
  perspectiveUser?: unknown;
}): string {
  const base = `You are an AI assistant having a conversation with a human (${alias}).`;
  if (!lastModel) return base;

  const mm = lastModel.twoDimAI as any;
  const perspective = mm?.mental_model?.perspective;
  const userMap = lastModel.perspectiveUser as Record<string, number> | null | undefined;

  const valScore = userMap?.['validation_support'] ?? perspective?.validation_support?.score;
  const objScore = userMap?.['objectivity_information'] ?? perspective?.objectivity_information?.score;

  if (valScore == null && objScore == null) return base;

  const lines: string[] = [];
  if (valScore != null) lines.push(`- Support/validation orientation: ${(valScore as number).toFixed(2)} (0 = not seeking validation, 1 = strongly wants validation regardless of accuracy)`);
  if (objScore != null) lines.push(`- Openness to objective information/challenge: ${(objScore as number).toFixed(2)} (0 = not open, 1 = very open to honest perspective, advice, or information that may challenge their view)`);

  return `${base}

Before responding, use this inferred model of ${alias} to shape your tone and response style. Do NOT restate these values or mention them explicitly.

${lines.join('\n')}

Use these to calibrate how much to validate vs. offer honest perspective, and how much to affirm ${alias}'s framing vs. provide objective information or gentle challenge.`;
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
    const { messages: chatMessages, alias, priorTwoDimModels, userAdjustedTwoDimModels } = body;

    if (!chatMessages || !Array.isArray(chatMessages) || chatMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build prior turn pairs for inference context
    const completedMessages = chatMessages.slice(0, -1);
    const turnPairs: TurnWithPrior[] = [];
    for (let i = 0; i < completedMessages.length - 1; i++) {
      if (completedMessages[i].role === 'user' && completedMessages[i + 1]?.role === 'assistant') {
        const idx = turnPairs.length;
        const prior = priorTwoDimModels?.[idx] as { twoDim?: unknown } | null;
        const userPrior = userAdjustedTwoDimModels?.[idx] as {
          perspectiveUser?: unknown;
          turnIntentUser?: string | null;
        } | null;
        turnPairs.push({
          userMessage: completedMessages[i].content,
          assistantMessage: completedMessages[i + 1].content,
          twoDimPrior: prior?.twoDim ?? null,
          twoDimUserPrior: userPrior
            ? { perspectiveUser: userPrior.perspectiveUser }
            : null,
        });
        i++;
      }
    }

    // Build system prompt from last turn's model
    const lastPrior = priorTwoDimModels?.length
      ? (priorTwoDimModels[priorTwoDimModels.length - 1] as { twoDim?: unknown })
      : null;
    const lastUserAdjusted = userAdjustedTwoDimModels?.length
      ? (userAdjustedTwoDimModels[userAdjustedTwoDimModels.length - 1] as {
          perspectiveUser?: unknown;
          turnIntentUser?: string | null;
        })
      : null;
    const lastModel = (lastPrior || lastUserAdjusted)
      ? {
          twoDimAI: lastPrior?.twoDim,
          perspectiveUser: lastUserAdjusted?.perspectiveUser,
        }
      : undefined;

    const systemPrompt = buildSystemPrompt(alias || 'User', lastModel);
    const apiMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...chatMessages,
    ];

    const lastUserMsg = chatMessages[chatMessages.length - 1];
    const twoDimPromise = inferTwoDimModel(turnPairs, lastUserMsg?.content ?? '', alias || 'User');

    const { endpoint, key, deployment, apiVersion } = getAzureCredentials();
    if (!endpoint || !key) {
      return new Response(JSON.stringify({ error: 'Azure OpenAI not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

          try {
            const mmTwoDim = await twoDimPromise;
            if (mmTwoDim) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'mental_model', data: { twoDim: mmTwoDim } })}\n\n`
                )
              );
            }
          } catch (mmErr) {
            console.error('[chat-two-dim] mental model error:', mmErr);
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (streamErr) {
          console.error('[chat-two-dim] stream error:', streamErr);
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
    console.error('[chat-two-dim] error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const config = {
  runtime: 'edge',
};
