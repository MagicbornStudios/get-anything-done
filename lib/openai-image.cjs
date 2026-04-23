'use strict';
/**
 * openai-image.cjs — shared OpenAI image-generation helper.
 *
 * Lifted out of bin/commands/evolution-images.cjs so every surface that
 * needs "prompt in → PNG out" (evolution images, `gad generate image`,
 * `gad media`, desktop app via sidecar) goes through the same code path.
 *
 * API-key resolution:
 *   Accepts an explicit `apiKey` to stay usable in non-project contexts
 *   (evolution sprite generation runs from framework root, no projectid).
 *   The `gad generate image` command tries the project BYOK bag first via
 *   openai-client.createApiKeyResolver and only falls back to env; that
 *   policy lives in the command, not here, so this module stays a thin
 *   HTTP client with no opinions about where the key came from.
 *
 * Returns a Node Buffer with raw PNG bytes (caller decides where to write).
 */

/**
 * @typedef {{
 *   apiKey: string,
 *   prompt: string,
 *   model?: string,     // default 'gpt-image-1'
 *   size?: string,      // default '1024x1024'
 *   fetchImpl?: typeof fetch,
 * }} GenerateOpenAiImageInput
 */

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const DEFAULT_MODEL = 'gpt-image-1';
const DEFAULT_SIZE = '1024x1024';

/**
 * Generate a single PNG from a prompt and return it as a Buffer.
 *
 * @param {GenerateOpenAiImageInput} input
 * @returns {Promise<Buffer>}
 */
async function generateOpenAiImage(input) {
  const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : '';
  const prompt = typeof input?.prompt === 'string' ? input.prompt.trim() : '';
  if (!apiKey) throw new Error('generateOpenAiImage: apiKey is required');
  if (!prompt) throw new Error('generateOpenAiImage: prompt is required');

  const model = (input.model && input.model.trim()) || DEFAULT_MODEL;
  const size = (input.size && input.size.trim()) || DEFAULT_SIZE;
  const fetchImpl = input.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('generateOpenAiImage: globalThis.fetch missing and no fetchImpl provided');
  }

  const res = await fetchImpl(OPENAI_IMAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, prompt, size, n: 1 }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `OpenAI image generation failed (${res.status}): ${body.slice(0, 400)}`,
    );
  }

  const json = await res.json().catch(() => null);
  const b64 = json && json.data && json.data[0] && json.data[0].b64_json;
  if (typeof b64 === 'string' && b64.length > 0) {
    return Buffer.from(b64, 'base64');
  }

  // Some model variants (older DALL·E flows) return a URL instead of b64.
  const url = json && json.data && json.data[0] && json.data[0].url;
  if (typeof url === 'string' && url.length > 0) {
    const imgRes = await fetchImpl(url);
    if (!imgRes.ok) {
      throw new Error(`OpenAI image URL fetch failed (${imgRes.status})`);
    }
    const arr = await imgRes.arrayBuffer();
    return Buffer.from(arr);
  }

  throw new Error('OpenAI response did not include data[0].b64_json or data[0].url');
}

module.exports = {
  generateOpenAiImage,
  OPENAI_IMAGES_URL,
  DEFAULT_MODEL,
  DEFAULT_SIZE,
};
