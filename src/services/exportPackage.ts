import { buildAiReportPayload, buildAiReportPrompt, buildAiReportRangePayload, type AiReportPayload, type AiReportSourceData } from './aiReport';
import type { AppSettings } from '../types';

export function buildPeriodPackage(period: 'week' | 'month', anchor: string, source: AiReportSourceData) {
  return buildAiReportPayload(period, anchor, source);
}

export function buildRangePackage(rangeMonths: number, anchor: string, source: AiReportSourceData) {
  return buildAiReportRangePayload(rangeMonths, anchor, source);
}

export function downloadAiPackage(payload: AiReportPayload) {
  const suffix = payload.period === 'range' ? `${payload.rangeMonths}-months` : payload.period;
  downloadJson(payload, `trajectory-ai-${suffix}-${payload.start}-${payload.end}.json`);
}

export async function copyAiPrompt(payload: AiReportPayload, settings: AppSettings) {
  await navigator.clipboard.writeText(buildAiReportPrompt(payload, settings));
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
