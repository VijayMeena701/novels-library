import * as cheerio from 'cheerio';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
const GEMINI_CHAT_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
const MAX_TRANSLATION_INPUT_CHARS = getNumberFromEnv('AI_TRANSLATION_MAX_INPUT_CHARS', 60000, 1000, 200000);
const TRANSLATION_TIMEOUT_MS = getNumberFromEnv('AI_TRANSLATION_TIMEOUT_MS', 60000, 5000, 300000);

type TranslationProvider = 'openai' | 'gemini';

interface Logger {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
}

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

function detectProvider(): TranslationProvider {
  const explicit = process.env.AI_TRANSLATION_PROVIDER?.toLowerCase();
  if (explicit === 'gemini' || explicit === 'openai') {
    return explicit;
  }

  if (process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    return 'gemini';
  }

  return 'openai';
}

function extractOpenAIResponseText(data: any): string {
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

function extractGeminiResponseText(data: any): string {
  const choice = data?.choices?.[0];
  if (choice?.message?.content) {
    return String(choice.message.content).trim();
  }

  if (typeof choice?.text === 'string') {
    return choice.text.trim();
  }

  return '';
}

function extractResponseText(data: any, provider: TranslationProvider): string {
  if (provider === 'gemini') {
    return extractGeminiResponseText(data);
  }

  return extractOpenAIResponseText(data);
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

interface ProviderConfig {
  provider: TranslationProvider;
  url: string;
  apiKey: string;
  model: string;
  body: Record<string, unknown>;
}

function getProviderConfig(prompt: string): ProviderConfig {
  const provider = detectProvider();

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new TranslationConfigurationError('GEMINI_API_KEY is not configured for Gemini translation.');
    }

    const model = process.env.GEMINI_TRANSLATION_MODEL || DEFAULT_GEMINI_MODEL;
    return {
      provider,
      url: GEMINI_CHAT_URL,
      apiKey,
      model,
      body: {
        model,
        messages: [{ role: 'user', content: prompt }],
      },
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new TranslationConfigurationError('OPENAI_API_KEY is not configured for AI chapter translation.');
  }

  const model = process.env.OPENAI_TRANSLATION_MODEL || DEFAULT_OPENAI_MODEL;
  return {
    provider,
    url: OPENAI_RESPONSES_URL,
    apiKey,
    model,
    body: {
      model,
      input: prompt,
    },
  };
}

function getAbortSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener('abort', () => clearTimeout(timer));
  return controller.signal;
}

export async function translateChapterHtml(input: {
  html: string;
  title: string;
  targetLanguage?: string;
  sourceLanguage?: string;
  logger?: Logger;
}): Promise<{ title: string; content: string; model: string }> {
  const log = input.logger || console;
  const targetLanguage = input.targetLanguage?.trim() || process.env.DEFAULT_TRANSLATION_TARGET_LANGUAGE || 'English';
  const sourceLanguage = input.sourceLanguage?.trim() || 'auto-detected source language';
  const html = normalizeHtmlFragment(input.html);
  const title = input.title || 'Untitled Chapter';

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
    `Title: ${title}`,
    '',
    'HTML:',
    html,
  ].join('\n');

  const start = Date.now();
  const { provider, url, apiKey, model, body } = getProviderConfig(prompt);

  log.info(`[translation] provider=${provider} model=${model} target=${targetLanguage} promptChars=${prompt.length} timeoutMs=${TRANSLATION_TIMEOUT_MS} title="${title}"`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: getAbortSignal(TRANSLATION_TIMEOUT_MS),
    });

    const duration = Date.now() - start;
    log.info(`[translation] response received after ${duration}ms status=${response.status} provider=${provider} model=${model}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      log.error(`[translation] provider=${provider} model=${model} status=${response.status} errorBody=${errorText || response.statusText}`);
      throw new Error(`AI translation request failed (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    const outputText = stripCodeFence(extractResponseText(data, provider));
    if (!outputText) {
      log.error(`[translation] provider=${provider} model=${model} empty outputText rawResponseKeys=${Object.keys(data).join(',')}`);
      throw new Error('AI translation response did not include translated text.');
    }

    log.info(`[translation] outputText length=${outputText.length} provider=${provider} model=${model}`);

    try {
      const parsed = JSON.parse(outputText);
      log.info(`[translation] parsed JSON response title="${parsed.title || title}" provider=${provider} model=${model}`);
      return {
        title: String(parsed.title || title).trim(),
        content: normalizeHtmlFragment(String(parsed.html || '')),
        model,
      };
    } catch {
      log.warn(`[translation] provider=${provider} model=${model} returned non-JSON text; using raw text as html`);
      return {
        title,
        content: normalizeHtmlFragment(outputText),
        model,
      };
    }
  } catch (error: any) {
    const duration = Date.now() - start;
    if (error.name === 'AbortError') {
      log.error(`[translation] provider=${provider} model=${model} timed out after ${duration}ms (timeoutMs=${TRANSLATION_TIMEOUT_MS})`);
      throw new Error(`AI translation timed out after ${duration}ms (timeoutMs=${TRANSLATION_TIMEOUT_MS}). Increase AI_TRANSLATION_TIMEOUT_MS if needed.`);
    }

    log.error(`[translation] provider=${provider} model=${model} failed after ${duration}ms: ${error.message}`);
    throw error;
  }
}
