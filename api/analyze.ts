export const config = {
  runtime: 'edge',
};

type AnalyzeRequest = {
  prompt?: unknown;
};

const analysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    supportingFactors: {
      type: 'array',
      items: { type: 'string' },
    },
    blockingFactors: {
      type: 'array',
      items: { type: 'string' },
    },
    hypotheses: {
      type: 'array',
      items: { type: 'string' },
    },
    nextLever: { type: 'string' },
    caveats: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'supportingFactors', 'blockingFactors', 'hypotheses', 'nextLever', 'caveats'],
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: 'OPENAI_API_KEY is not configured' }, 500);

  let body: AnalyzeRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return json({ error: 'Prompt is required' }, 400);
  }

  if (body.prompt.length > 120_000) {
    return json({ error: 'Prompt is too large for this endpoint' }, 413);
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-5.6',
      input: body.prompt,
      text: {
        format: {
          type: 'json_schema',
          name: 'trajectory_analysis',
          strict: true,
          schema: analysisSchema,
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return json({ error: 'OpenAI request failed', details: compactOpenAiError(data) }, response.status);
  }

  const outputText = extractOutputText(data);
  if (!outputText) return json({ error: 'Empty model response' }, 502);

  try {
    return json({ analysis: JSON.parse(outputText) });
  } catch {
    return json({ error: 'Model returned invalid JSON' }, 502);
  }
}

function extractOutputText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  if ('output_text' in data && typeof data.output_text === 'string') return data.output_text;

  const output = 'output' in data && Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object' || !('content' in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content && typeof content === 'object' && 'type' in content && content.type === 'output_text' && 'text' in content && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  return '';
}

function compactOpenAiError(data: unknown): unknown {
  if (!data || typeof data !== 'object' || !('error' in data)) return data;
  return data.error;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
