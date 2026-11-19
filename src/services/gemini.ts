// Thin wrapper around the Gemini REST API (called directly from the browser, or via the optional Cloudflare Worker proxy).
import { getSettings, setSetting, DEFAULT_GEMINI_MODEL } from '../db/settings';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiError extends Error {
  constructor(message: string, public kind: 'no_key' | 'offline' | 'rate_limit' | 'auth' | 'model' | 'blocked' | 'timeout' | 'other', public status?: number, public raw?: string) {
    super(message);
  }
}

const TIMEOUT_MS = 90_000;

export interface Part {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}
export interface Content {
  role: 'user' | 'model';
  parts: Part[];
}

export interface GenerateOptions {
  system?: string;
  contents: Content[];
  json?: boolean;
  schema?: Record<string, unknown>;
  temperature?: number;
  model?: string;
}

async function endpoint(path: string): Promise<{ url: string; headers: Record<string, string> }> {
  const s = await getSettings();
  if (s.aiMode === 'proxy') {
    if (!s.proxyUrl) throw new GeminiError('Add your proxy URL in Settings → AI coach.', 'no_key');
    return { url: s.proxyUrl.replace(/\/$/, '') + '/' + path, headers: { 'Content-Type': 'application/json' } };
  }
  if (!s.geminiKey) throw new GeminiError('Add your Gemini API key in Settings → AI coach.', 'no_key');
  return { url: `${BASE}/${path}`, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.geminiKey } };
}

async function request(path: string, init: RequestInit = {}) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new GeminiError('Coach needs internet.', 'offline');
  const { url, headers } = await endpoint(path);
  let res: Response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new GeminiError('Gemini is taking too long right now. Try again in a moment.', 'timeout');
    throw new GeminiError('Network error — check your connection.', 'offline');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let msg = `Gemini error ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? msg;
    } catch {
      /* ignore */
    }
    if (res.status === 429) throw new GeminiError('Rate limit reached on the free tier. Wait a minute and try again.', 'rate_limit', 429);
    if (res.status === 401 || res.status === 403 || /API key/i.test(msg)) throw new GeminiError('API key rejected. Check it in Settings → AI coach.', 'auth', res.status);
    if (res.status === 404) throw new GeminiError(`Model not available. Pick another model in Settings → AI coach. (${msg})`, 'model', 404, msg);
    throw new GeminiError(msg, 'other', res.status, msg);
  }
  return res.json();
}

/** Pick a replacement when a model is retired: Google's suggestion in the error, else the newest stable Flash. */
async function replacementModel(errMsg: string | undefined, failed: string): Promise<string | null> {
  const suggested = errMsg?.match(/models\/([\w.\-]+)/g)?.map((m) => m.replace('models/', '')).find((m) => m !== failed);
  if (suggested) return suggested;
  try {
    const flash = (await listModels())
      .map((m) => m.name)
      .filter((n) => /^gemini-[\d.]+-flash$/.test(n) && n !== failed)
      .sort((a, b) => parseFloat(b.slice(7)) - parseFloat(a.slice(7)));
    return flash[0] ?? null;
  } catch {
    return null;
  }
}

let thinkingUnsupported = new Set<string>();

export async function generate(opts: GenerateOptions): Promise<string> {
  const s = await getSettings();
  let model = (opts.model || s.geminiModel || DEFAULT_GEMINI_MODEL).replace(/^models\//, '');
  const build = (withThinking: boolean) => {
    const body: Record<string, unknown> = {
      contents: opts.contents,
      generationConfig: {
        temperature: opts.temperature ?? 0.6,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
        ...(opts.schema ? { responseSchema: opts.schema } : {}),
        // Low thinking keeps answers fast; dropped automatically for models that don't support it.
        ...(withThinking ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
      },
    };
    if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
    return JSON.stringify(body);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let j: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      j = await request(`models/${model}:generateContent`, { method: 'POST', body: build(!thinkingUnsupported.has(model)) });
      break;
    } catch (e) {
      if (!(e instanceof GeminiError) || attempt === 2) throw e;
      if (e.status === 400 && /thinking/i.test(e.raw ?? '')) {
        thinkingUnsupported = new Set([...thinkingUnsupported, model]);
        continue;
      }
      if (e.kind === 'model' && !opts.model) {
        const next = await replacementModel(e.raw, model);
        if (!next) throw e;
        model = next;
        await setSetting('geminiModel', next); // remember the working model
        continue;
      }
      throw e;
    }
  }
  const cand = j?.candidates?.[0];
  const text: string = (cand?.content?.parts ?? []).map((p: Part) => p.text ?? '').join('');
  if (!text) {
    if (j?.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY') throw new GeminiError('The response was blocked. Try rephrasing.', 'blocked');
    throw new GeminiError('Empty response from Gemini.', 'other');
  }
  return text;
}

export async function generateJSON<T>(opts: Omit<GenerateOptions, 'json'>): Promise<T> {
  const text = await generate({ ...opts, json: true, temperature: opts.temperature ?? 0.2 });
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/[[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new GeminiError('Could not parse the AI response.', 'other');
  }
}

export interface ModelInfo {
  name: string;
  displayName: string;
  description?: string;
}

export async function listModels(): Promise<ModelInfo[]> {
  const out: ModelInfo[] = [];
  let token = '';
  for (let i = 0; i < 5; i++) {
    const j = await request(`models?pageSize=100${token ? `&pageToken=${token}` : ''}`);
    for (const m of j.models ?? []) {
      if ((m.supportedGenerationMethods ?? []).includes('generateContent')) out.push({ name: String(m.name).replace(/^models\//, ''), displayName: m.displayName, description: m.description });
    }
    token = j.nextPageToken;
    if (!token) break;
  }
  return out;
}

export async function testConnection(): Promise<string> {
  const text = await generate({ contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }], temperature: 0 });
  return text.trim();
}

/** Resize an image client-side to keep uploads small (returns base64 JPEG without prefix). */
export async function imageToBase64(file: Blob, maxDim = 1024, quality = 0.8): Promise<{ data: string; mime: string; blob: Blob }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', quality));
  const data = await new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.readAsDataURL(blob);
  });
  return { data, mime: 'image/jpeg', blob };
}

// ---------- Food parsing ----------
export interface ParsedFood {
  name: string;
  servingDesc: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const FOOD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          servingDesc: { type: 'STRING', description: 'Portion as eaten, e.g. "2 large eggs"' },
          calories: { type: 'NUMBER' },
          protein: { type: 'NUMBER', description: 'grams' },
          carbs: { type: 'NUMBER', description: 'grams' },
          fat: { type: 'NUMBER', description: 'grams' },
        },
        required: ['name', 'servingDesc', 'calories', 'protein', 'carbs', 'fat'],
      },
    },
  },
  required: ['items'],
};

const FOOD_SYSTEM =
  'You are a nutrition estimator. Split the meal into separate food items with realistic portion sizes and estimate calories and macros (grams) for the whole portion of each item, using USDA-style averages. If a portion is unspecified, assume a typical single serving. Be conservative and realistic. Return only JSON.';

export async function parseFoodText(text: string): Promise<ParsedFood[]> {
  const r = await generateJSON<{ items: ParsedFood[] }>({
    system: FOOD_SYSTEM,
    schema: FOOD_SCHEMA,
    contents: [{ role: 'user', parts: [{ text: `Meal description: ${text}` }] }],
  });
  return (r.items ?? []).map(cleanFood);
}

export async function parseFoodPhoto(image: { data: string; mime: string }, hint?: string): Promise<ParsedFood[]> {
  const r = await generateJSON<{ items: ParsedFood[] }>({
    system: FOOD_SYSTEM + ' Identify each visible food in the photo and estimate the portion from visual cues (plate size, utensils).',
    schema: FOOD_SCHEMA,
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: image.mime, data: image.data } }, { text: hint ? `Extra context: ${hint}` : 'Estimate this meal.' }] }],
  });
  return (r.items ?? []).map(cleanFood);
}

const cleanFood = (f: ParsedFood): ParsedFood => ({
  name: String(f.name ?? 'Food'),
  servingDesc: String(f.servingDesc ?? '1 serving'),
  calories: Math.max(0, Math.round(Number(f.calories) || 0)),
  protein: Math.max(0, Math.round((Number(f.protein) || 0) * 10) / 10),
  carbs: Math.max(0, Math.round((Number(f.carbs) || 0) * 10) / 10),
  fat: Math.max(0, Math.round((Number(f.fat) || 0) * 10) / 10),
});
