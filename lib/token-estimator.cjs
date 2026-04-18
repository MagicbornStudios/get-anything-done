"use strict";

/**
 * Token estimation for Claude/GPT-family models.
 *
 * Default: deps-free heuristic calibrated against Claude's tokenizer on
 * mixed prose+XML+code corpora. chars/3.5 beats the old chars/4 heuristic
 * by ~15% on XML-heavy planning docs (gad snapshot output) and ~5% on
 * English prose — chars/4 under-counts because Claude's tokenizer
 * splits XML tags and punctuation more than GPT's cl100k does.
 *
 * Opt-in: set GAD_TOKENIZER=tiktoken to use js-tiktoken (cl100k_base)
 * when installed. Still an approximation for Claude — Anthropic's
 * tokenizer is proprietary — but closer on code-heavy inputs. If the
 * package is missing, falls back silently to the heuristic.
 *
 * Zero-deps first, optional dep as lazy capability (convention from
 * 2026-04-14). Add js-tiktoken locally to opt in:
 *   npm install --no-save js-tiktoken
 */

const CHARS_PER_TOKEN = 3.5;

let tiktokenEncoder = null;
let tiktokenLoadAttempted = false;

function loadTiktoken() {
  if (tiktokenLoadAttempted) return tiktokenEncoder;
  tiktokenLoadAttempted = true;
  try {
    const tk = require("js-tiktoken");
    tiktokenEncoder = tk.getEncoding("cl100k_base");
  } catch {
    tiktokenEncoder = null;
  }
  return tiktokenEncoder;
}

function estimateTokens(value) {
  if (!value) return 0;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return 0;

  if (process.env.GAD_TOKENIZER === "tiktoken") {
    const enc = loadTiktoken();
    if (enc) return enc.encode(text).length;
  }
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function tokenizerBackend() {
  if (process.env.GAD_TOKENIZER === "tiktoken" && loadTiktoken()) {
    return "tiktoken:cl100k_base";
  }
  return `heuristic:chars/${CHARS_PER_TOKEN}`;
}

module.exports = { estimateTokens, tokenizerBackend, CHARS_PER_TOKEN };
