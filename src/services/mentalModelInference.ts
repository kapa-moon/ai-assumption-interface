// Server-side Azure OpenAI service (uses process.env for secrets)
// This file is safe to import in serverless API routes

interface TurnWithPrior {
  userMessage: string;
  assistantMessage: string;
  inductPrior?: unknown;
  typesSupportPrior?: unknown;
  inductUserPrior?: unknown;
  typesSupportUserPrior?: unknown;
}

// Build induct prompt (server-side version)
function buildInductPrompt(
  turns: TurnWithPrior[],
  newUserText: string,
  alias: string
): string {
  const hasPriors = turns.some((t) => t.inductPrior);

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

// Build types support prompt (server-side version)
function buildTypesSupportPrompt(
  turns: TurnWithPrior[],
  newUserText: string,
  alias: string
): string {
  const hasPriors = turns.some((t) => t.typesSupportPrior);

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

1. **Emotional Support** - Seeking opportunities for confiding, sympathetic listening, or caring behaviors
2. **Social Contact and Companionship** - Seeking positive social interaction
3. **Belonging Support** - Seeking connection to a group or community
4. **Information and Guidance Support** - Seeking knowledge, advice, or problem-solving help
5. **Tangible Support** - Seeking practical or instrumental assistance

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

// Server-side Azure API call
async function callAzureOpenAI(prompt: string): Promise<unknown> {
  const AZURE_ENDPOINT = process.env.AZURE_ENDPOINT;
  const AZURE_KEY = process.env.AZURE_KEY;
  const DEPLOYMENT = process.env.AZURE_DEPLOYMENT || 'gpt-4o';
  const API_VERSION = process.env.AZURE_API_VERSION || '2024-12-01-preview';

  if (!AZURE_ENDPOINT || !AZURE_KEY) {
    throw new Error('Azure OpenAI credentials not configured');
  }

  const response = await fetch(
    `${AZURE_ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_KEY,
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

// Infer induct mental model (server-side)
export async function inferInductMentalModel(
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

// Infer types support mental model (server-side)
export async function inferTypesSupportMentalModel(
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
