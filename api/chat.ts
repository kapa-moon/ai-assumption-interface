// Secure serverless API for Azure OpenAI chat + mental model inference
// API keys are stored server-side (environment variables), never exposed to client

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

// Get Azure credentials from Edge Function environment
function getAzureCredentials() {
  // In Edge Functions, env vars are in process.env
  return {
    endpoint: (process.env as any).AZURE_ENDPOINT || '',
    key: (process.env as any).AZURE_KEY || '',
    deployment: (process.env as any).AZURE_DEPLOYMENT || 'gpt-4o',
    apiVersion: (process.env as any).AZURE_API_VERSION || '2024-12-01-preview',
  };
}

// Build induct prompt
function buildInductPrompt(turns: TurnWithPrior[], newUserText: string, alias: string): string {
  const hasPriors = turns.some((t) => t.inductPrior);

  console.log('[API/buildInductPrompt] Turns with user priors:', turns.map((t, i) => ({
    turn: i,
    hasInductUserPrior: !!t.inductUserPrior,
    inductUserPrior: t.inductUserPrior,
  })));

  const history = turns.length
    ? turns
        .map((t) => {
          let block = `User: ${t.userMessage}\n\nAssistant: ${t.assistantMessage}`;
          if (t.inductPrior) {
            const json = JSON.stringify(stripExplanations(t.inductPrior), null, 2);
            if (json)
              block += `\n\nAI's mental model at end of this turn (inferred scores only):\n\`\`\`json\n${json}\n\`\`\``;
          }
          if (t.inductUserPrior) {
            const userJson = JSON.stringify(stripExplanations(t.inductUserPrior), null, 2);
            console.log(`[API/buildInductPrompt] Adding user self-assessment for turn: ${t.userMessage.substring(0, 30)}...`, userJson);
            if (userJson)
              block += `\n\n${alias}'s self-assessment at end of this turn (treat as additional signal, form your own independent estimate):\n\`\`\`json\n${userJson}\n\`\`\``;
          }
          return block;
        })
        .join('\n\n')
    : '(no previous conversation)';

  console.log('[API/buildInductPrompt] Final prompt excerpt (first 500 chars):', history.substring(0, 500) + '...');

  const updateLine = hasPriors ? '\n\nUpdate your mental model for the current turn.\n\n' : '\n\n';

  return `You are an AI assistant having a conversation with a human (${alias}).

Conversation so far:
"""${history}"""

${alias} now says:
"""${newUserText}"""${updateLine}First, output your mental model of ${alias}. Estimate structured beliefs about ${alias} along the following dimensions:

1. Belief about how much ${alias} is seeking validation/support.
2. Belief about how right ${alias} is in the situation.
3. Belief about whether ${alias} has more information than you (the model).
4. Belief about whether ${alias} is seeking an objective perspective.

Treat these as *probabilistic beliefs* that may co-exist. These dimensions are independent and do NOT need to sum to 1. Each score should be between 0 and 1.

Then output ONLY a valid JSON object in the following structure:

{
  "mental_model": {
    "beliefs": {
      "validation_seeking": {
        "score": 0.0,
        "explanation": ""
      },
      "user_rightness": {
        "score": 0.0,
        "explanation": ""
      },
      "user_information_advantage": {
        "score": 0.0,
        "explanation": ""
      },
      "objectivity_seeking": {
        "score": 0.0,
        "explanation": ""
      }
    }
  }
}`;
}

// Build types support prompt
function buildTypesSupportPrompt(turns: TurnWithPrior[], newUserText: string, alias: string): string {
  const hasPriors = turns.some((t) => t.typesSupportPrior);

  console.log('[API/buildTypesSupportPrompt] Turns with user priors:', turns.map((t, i) => ({
    turn: i,
    hasTypesSupportUserPrior: !!t.typesSupportUserPrior,
    typesSupportUserPrior: t.typesSupportUserPrior,
  })));

  const history = turns.length
    ? turns
        .map((t) => {
          let block = `User: ${t.userMessage}\n\nAssistant: ${t.assistantMessage}`;
          if (t.typesSupportPrior) {
            const json = JSON.stringify(stripExplanations(t.typesSupportPrior), null, 2);
            if (json)
              block += `\n\nAI's mental model at end of this turn (inferred scores only):\n\`\`\`json\n${json}\n\`\`\``;
          }
          if (t.typesSupportUserPrior) {
            const userJson = JSON.stringify(stripExplanations(t.typesSupportUserPrior), null, 2);
            console.log(`[API/buildTypesSupportPrompt] Adding user self-assessment:`, userJson);
            if (userJson)
              block += `\n\n${alias}'s self-assessment at end of this turn (treat as additional signal, form your own independent estimate):\n\`\`\`json\n${userJson}\n\`\`\``;
          }
          return block;
        })
        .join('\n\n')
    : '(no previous conversation)';

  const updateLine = hasPriors ? '\n\nUpdate your mental model for the current turn.\n\n' : '\n\n';

  return `You are an AI assistant having a conversation with a human (${alias}).

Conversation so far:
"""${history}"""

${alias} now says:
"""${newUserText}"""${updateLine}First, output your mental model of ${alias}. Estimate structured beliefs about the extent to which ${alias} is seeking different types of support:

1. **Emotional Support** - Seeking opportunities for confiding, sympathetic listening, or caring behaviors:
   - Confiding/listening: seeking empathetic understanding or wanting someone to listen to private feelings or problems
   - Affection: seeking expressions of love, care, or emotional closeness
   - Esteem support: seeking validation of self-worth, acceptance despite difficulties
   - Being there: seeking unconditional availability or presence
   - Comforting touch: seeking physical comfort or affection

2. **Social Contact and Companionship** - Seeking positive social interaction:
   - Companionship: wanting to spend time with others, do activities together
   - Positive interaction: seeking to joke, talk about interests, engage in diversionary activities
   - Shared activities: wanting to do fun things with others

3. **Belonging Support** - Seeking connection to a group or community:
   - Social integration: wanting to feel part of a group with common interests
   - Group inclusion: seeking comfort, security, or identity through group membership
   - Sense of belonging: wanting to feel included and connected

4. **Information and Guidance Support** - Seeking knowledge, advice, or problem-solving help:
   - Advice/guidance: seeking solutions, feedback, or direction
   - Information: seeking facts, explanations, or understanding of situations
   - Cognitive guidance: seeking help in defining or coping with problems

5. **Tangible Support** - Seeking practical or instrumental assistance:
   - Material aid: seeking financial help, resources, or physical objects
   - Practical assistance: seeking help with tasks, chores, or concrete actions
   - Reliable alliance: seeking assurance that others will provide tangible help

Treat these as *probabilistic beliefs* that may co-exist. These dimensions are independent and do NOT need to sum to 1. Each score should be between 0 and 1.

Then output ONLY a valid JSON object in the following structure:

{
  "mental_model": {
    "support_seeking": {
      "emotional_support": { "score": 0.0, "explanation": "" },
      "social_companionship": { "score": 0.0, "explanation": "" },
      "belonging_support": { "score": 0.0, "explanation": "" },
      "information_guidance": { "score": 0.0, "explanation": "" },
      "tangible_support": { "score": 0.0, "explanation": "" }
    }
  }
}`;
}

// Strip explanations for prior context
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

// Extract JSON from response
function extractFirstJson(raw: string): unknown | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === '{') depth++;
    else if (raw[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}

// Call Azure OpenAI for mental model inference
async function callAzureOpenAI(prompt: string): Promise<unknown> {
  const { endpoint, key, deployment, apiVersion } = getAzureCredentials();

  if (!endpoint || !key) {
    throw new Error('Azure OpenAI credentials not configured');
  }

  const response = await fetch(
    `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': key,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
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

// Infer induct mental model
async function inferInductMentalModel(
  turns: TurnWithPrior[],
  newUserText: string,
  alias: string
): Promise<unknown> {
  try {
    const prompt = buildInductPrompt(turns, newUserText, alias);
    return await callAzureOpenAI(prompt);
  } catch (e) {
    console.error('[inferInductMentalModel] error:', e);
    return null;
  }
}

// Infer types support mental model
async function inferTypesSupportMentalModel(
  turns: TurnWithPrior[],
  newUserText: string,
  alias: string
): Promise<unknown> {
  try {
    const prompt = buildTypesSupportPrompt(turns, newUserText, alias);
    return await callAzureOpenAI(prompt);
  } catch (e) {
    console.error('[inferTypesSupportMentalModel] error:', e);
    return null;
  }
}

interface LastTurnModel {
  inductAI?: unknown;
  typesSupportAI?: unknown;
  inductUser?: unknown;
  typesSupportUser?: unknown;
}

// Resolve a score: user-adjusted flat map wins over AI nested object
// inductUser shape: Record<string, number> e.g. { validation_seeking: 0.7 }
// inductAI shape:  { mental_model: { beliefs: { validation_seeking: { score: 0.7 } } } }
function resolveInductScore(
  key: string,
  inductUser: unknown,
  inductAI: unknown
): number | null {
  const userMap = inductUser as Record<string, number> | null | undefined;
  if (userMap && typeof userMap[key] === 'number') return userMap[key];
  const ai = inductAI as any;
  const score = ai?.mental_model?.beliefs?.[key]?.score;
  return typeof score === 'number' ? score : null;
}

// typesSupportUser shape: Record<string, number> e.g. { emotional_support: 0.3 }
// typesSupportAI shape:  { mental_model: { support_seeking: { emotional_support: { score: 0.3 } } } }
function resolveTypesSupportScore(
  key: string,
  typesSupportUser: unknown,
  typesSupportAI: unknown
): number | null {
  const userMap = typesSupportUser as Record<string, number> | null | undefined;
  if (userMap && typeof userMap[key] === 'number') return userMap[key];
  const ai = typesSupportAI as any;
  const score = ai?.mental_model?.support_seeking?.[key]?.score;
  return typeof score === 'number' ? score : null;
}

// Format mental model scores into a readable preamble for the AI
function buildMentalModelPreamble(model: LastTurnModel): string {
  const lines: string[] = [];

  const inductKeys: [string, string][] = [
    ['validation_seeking', 'Validation seeking'],
    ['user_rightness', 'User is likely right'],
    ['user_information_advantage', 'User has information advantage'],
    ['objectivity_seeking', 'Objectivity seeking'],
  ];

  const inductLines: string[] = [];
  for (const [key, label] of inductKeys) {
    const score = resolveInductScore(key, model.inductUser, model.inductAI);
    if (score != null) inductLines.push(`- ${label}: ${score.toFixed(2)}`);
  }
  if (inductLines.length) {
    lines.push('[User assumptions — epistemic & validation]');
    lines.push(...inductLines);
  }

  const supportKeys: [string, string][] = [
    ['emotional_support', 'Emotional support'],
    ['social_companionship', 'Social companionship'],
    ['belonging_support', 'Belonging support'],
    ['information_guidance', 'Information & guidance'],
    ['tangible_support', 'Tangible support'],
  ];

  const supportLines: string[] = [];
  for (const [key, label] of supportKeys) {
    const score = resolveTypesSupportScore(key, model.typesSupportUser, model.typesSupportAI);
    if (score != null) supportLines.push(`- ${label}: ${score.toFixed(2)}`);
  }
  if (supportLines.length) {
    lines.push('[User assumptions — types of support sought]');
    lines.push(...supportLines);
  }

  return lines.join('\n');
}

// Build system prompt for the assistant, optionally shaped by last turn's mental model
function buildSystemPrompt(alias: string, lastModel?: LastTurnModel): string {
  const base = `You are a helpful, honest AI assistant having a conversation with ${alias}. Be clear, thoughtful, and balanced. Adapt your tone to what the conversation calls for.`;

  if (!lastModel) return base;

  const preamble = buildMentalModelPreamble(lastModel);
  if (!preamble) return base;

  return `${base}

Before responding, use this inferred model of ${alias} to shape your tone and response style. Do NOT restate these scores or mention them explicitly.

${preamble}

Use these scores to calibrate how much to validate vs. challenge, how much emotional support to offer vs. information, and how much to defer to ${alias}'s knowledge vs. provide your own perspective.`;
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
    const { messages: chatMessages, alias, priorMentalModels, userAdjustedMentalModels } = body;

    if (!chatMessages || !Array.isArray(chatMessages) || chatMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    // Build system prompt — inject last turn's mental model to shape AI response
    // User-adjusted scores take priority over AI-inferred scores
    const lastPrior = priorMentalModels?.length
      ? (priorMentalModels[priorMentalModels.length - 1] as { induct?: unknown; typesSupport?: unknown })
      : null;
    const lastUserAdjusted = userAdjustedMentalModels?.length
      ? (userAdjustedMentalModels[userAdjustedMentalModels.length - 1] as { inductUser?: unknown; typesSupportUser?: unknown })
      : null;
    const lastModel: LastTurnModel | undefined = (lastPrior || lastUserAdjusted) ? {
      inductAI: lastPrior?.induct,
      typesSupportAI: lastPrior?.typesSupport,
      inductUser: lastUserAdjusted?.inductUser,
      typesSupportUser: lastUserAdjusted?.typesSupportUser,
    } : undefined;

    const systemPrompt = buildSystemPrompt(alias || 'User', lastModel);
    console.log('[API/handler] System prompt (first 300 chars):', systemPrompt.substring(0, 300));
    const apiMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...chatMessages,
    ];

    const lastUserMsg = chatMessages[chatMessages.length - 1];

    // Run mental model inference in parallel
    const inductPromise = inferInductMentalModel(turnPairs, lastUserMsg?.content ?? '', alias || 'User');
    const typesSupportPromise = inferTypesSupportMentalModel(turnPairs, lastUserMsg?.content ?? '', alias || 'User');

    // Get Azure credentials for chat
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
                      encoder.encode(`data: ${JSON.stringify({ type: 'text', text: content })}\n\n`)
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

export const config = {
  runtime: 'edge',
};
