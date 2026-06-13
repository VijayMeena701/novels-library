import * as cheerio from 'cheerio';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_TRANSLATION_MODEL = 'gpt-5-mini';
const MAX_TRANSLATION_INPUT_CHARS = getNumberFromEnv('AI_TRANSLATION_MAX_INPUT_CHARS', 60000, 1000, 200000);

export class TranslationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranslationConfigurationError';
  }
}

function getNumberFromEnv(name: string, defaultValue: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(max, Math.max(min, parsed));
}

function extractResponseText(data: any): string {
  if (typeof data?.output_text === 'string') {
    return data.output_text;
  }

  const parts: string[] = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') {
        parts.push(content.text);
      }
    }
  }

  return parts.join('\n').trim();
}

function stripCodeFence(value: string): string {
  return value
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function normalizeHtmlFragment(html: string): string {
  const $ = cheerio.load(`<div id="translation-root">${html}</div>`);
  $('#translation-root script, #translation-root style, #translation-root iframe').remove();
  return $('#translation-root').html()?.trim() || '';
}

export async function translateChapterHtml(input: {
  html: string;
  title: string;
  targetLanguage?: string;
  sourceLanguage?: string;
}): Promise<{ title: string; content: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new TranslationConfigurationError('OPENAI_API_KEY is not configured for AI chapter translation.');
  }

  const model = process.env.OPENAI_TRANSLATION_MODEL || DEFAULT_TRANSLATION_MODEL;
  const targetLanguage = input.targetLanguage?.trim() || process.env.DEFAULT_TRANSLATION_TARGET_LANGUAGE || 'English';
  const sourceLanguage = input.sourceLanguage?.trim() || 'auto-detected source language';
  const html = normalizeHtmlFragment(input.html);

  if (!html || html.length < 20) {
    throw new Error('Raw chapter content is empty or too short to translate.');
  }

  if (html.length > MAX_TRANSLATION_INPUT_CHARS) {
    throw new Error(`Raw chapter content is too large to translate in one request (${html.length} chars).`);
  }

  const prompt = [
    `Translate this web novel chapter from ${sourceLanguage} to ${targetLanguage}.`,
    'Return only a JSON object with exactly these keys: "title" and "html".',
    'The "html" value must be an HTML fragment suitable for display in the reader.',
    'Preserve paragraph breaks and basic inline formatting. Do not summarize, censor, add notes, or wrap the JSON in markdown.',
    '',
    `Title: ${input.title || 'Untitled Chapter'}`,
    '',
    'HTML:',
    html,
  ].join('\n');

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`AI translation request failed (${response.status}): ${errorText || response.statusText}`);
  }

  const data = await response.json();
  const outputText = stripCodeFence(extractResponseText(data));
  if (!outputText) {
    throw new Error('AI translation response did not include translated text.');
  }

  try {
    const parsed = JSON.parse(outputText);
    return {
      title: String(parsed.title || input.title || 'Translated Chapter').trim(),
      content: normalizeHtmlFragment(String(parsed.html || '')),
      model,
    };
  } catch {
    return {
      title: input.title || 'Translated Chapter',
      content: normalizeHtmlFragment(outputText),
      model,
    };
  }
}
