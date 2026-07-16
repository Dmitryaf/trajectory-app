export type AiAnalysis = {
  summary: string;
  supportingFactors: string[];
  blockingFactors: string[];
  hypotheses: string[];
  nextLever: string;
  caveats: string[];
};

type AiAnalysisResponse = {
  analysis?: AiAnalysis;
  error?: string;
};

export async function requestAiAnalysis(prompt: string): Promise<AiAnalysis> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(payload.error ?? 'Не удалось получить ИИ-анализ');
  }

  if (!payload.analysis) {
    throw new Error('Сервер вернул пустой ИИ-анализ');
  }

  return payload.analysis;
}

async function readJson(response: Response): Promise<AiAnalysisResponse> {
  try {
    return await response.json();
  } catch {
    return { error: 'Сервер вернул некорректный ответ' };
  }
}
