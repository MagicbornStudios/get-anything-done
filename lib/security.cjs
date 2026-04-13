/**
 * Security - input validation, path traversal prevention, and prompt injection guards
 *
 * This module centralizes security checks for GAD tooling. Because GAD generates
 * markdown files that become LLM system prompts (agent instructions, workflow state,
 * phase plans, eval prompts), any user-controlled text that flows into these files
 * is a potential indirect prompt injection vector.
 *
 * Threat model:
 *   1. Path traversal: user-supplied file paths escape the project directory
 *   2. Prompt injection: malicious text in args/PRDs embeds LLM instructions
 *   3. Shell metacharacter injection: user text interpreted by shell
 *   4. JSON injection: malformed JSON crashes or corrupts state
 *   5. Regex DoS / encoded payloads: crafted input hides instructions
 */
'use strict';

const fs = require('fs');
const path = require('path');

function validatePath(filePath, baseDir, opts = {}) {
  if (!filePath || typeof filePath !== 'string') {
    return { safe: false, resolved: '', error: 'Empty or invalid file path' };
  }

  if (!baseDir || typeof baseDir !== 'string') {
    return { safe: false, resolved: '', error: 'Empty or invalid base directory' };
  }

  if (filePath.includes('\0')) {
    return { safe: false, resolved: '', error: 'Path contains null bytes' };
  }

  let resolvedBase;
  try {
    resolvedBase = fs.realpathSync(path.resolve(baseDir));
  } catch {
    resolvedBase = path.resolve(baseDir);
  }

  let resolvedPath;
  if (path.isAbsolute(filePath)) {
    if (!opts.allowAbsolute) {
      return { safe: false, resolved: '', error: 'Absolute paths not allowed' };
    }
    resolvedPath = path.resolve(filePath);
  } else {
    resolvedPath = path.resolve(baseDir, filePath);
  }

  try {
    resolvedPath = fs.realpathSync(resolvedPath);
  } catch {
    const parentDir = path.dirname(resolvedPath);
    try {
      const realParent = fs.realpathSync(parentDir);
      resolvedPath = path.join(realParent, path.basename(resolvedPath));
    } catch {}
  }

  const normalizedBase = resolvedBase + path.sep;
  const normalizedPath = resolvedPath + path.sep;

  if (resolvedPath !== resolvedBase && !normalizedPath.startsWith(normalizedBase)) {
    return {
      safe: false,
      resolved: resolvedPath,
      error: `Path escapes allowed directory: ${resolvedPath} is outside ${resolvedBase}`,
    };
  }

  return { safe: true, resolved: resolvedPath };
}

function requireSafePath(filePath, baseDir, label, opts = {}) {
  const result = validatePath(filePath, baseDir, opts);
  if (!result.safe) {
    throw new Error(`${label || 'Path'} validation failed: ${result.error}`);
  }
  return result.resolved;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(all\s+)?(your\s+)?instructions/i,
  /override\s+(system|previous)\s+(prompt|instructions)/i,
  /you\s+are\s+now\s+(?:a|an|the)\s+/i,
  /act\s+as\s+(?:a|an|the)\s+(?!plan|phase|wave)/i,
  /pretend\s+(?:you(?:'re| are)\s+|to\s+be\s+)/i,
  /from\s+now\s+on,?\s+you\s+(?:are|will|should|must)/i,
  /(?:print|output|reveal|show|display|repeat)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions)/i,
  /what\s+(?:are|is)\s+your\s+(?:system\s+)?(?:prompt|instructions)/i,
  /<\/?(?:system|assistant|human)>/i,
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<<\s*SYS\s*>>/i,
  /(?:send|post|fetch|curl|wget)\s+(?:to|from)\s+https?:\/\//i,
  /(?:base64|btoa|encode)\s+(?:and\s+)?(?:send|exfiltrate|output)/i,
  /(?:run|execute|call|invoke)\s+(?:the\s+)?(?:bash|shell|exec|spawn)\s+(?:tool|command)/i,
];

const OBFUSCATION_PATTERN_ENTRIES = [
  {
    pattern: /\b(\w\s){4,}\w\b/,
    message: 'Character-spacing obfuscation pattern detected (e.g. "i g n o r e")',
  },
  {
    pattern: /<\/?(system|human|assistant|user)\s*>/i,
    message: 'Delimiter injection pattern: <system>/<assistant>/<user> tag detected',
  },
  {
    pattern: /0x[0-9a-fA-F]{16,}/,
    message: 'Long hex sequence detected - possible encoded payload',
  },
];

function scanForInjection(text, opts = {}) {
  if (!text || typeof text !== 'string') {
    return { clean: true, findings: [] };
  }

  const findings = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      findings.push(`Matched injection pattern: ${pattern.source}`);
    }
  }

  for (const entry of OBFUSCATION_PATTERN_ENTRIES) {
    if (entry.pattern.test(text)) {
      findings.push(entry.message);
    }
  }

  if (opts.strict) {
    if (/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/.test(text)) {
      findings.push('Contains suspicious zero-width or invisible Unicode characters');
    }

    if (/[\uDB40\uDC00-\uDB40\uDC7F]/u.test(text) || /[\u{E0000}-\u{E007F}]/u.test(text)) {
      findings.push('Contains Unicode tag block characters (U+E0000-E007F) - invisible instruction injection vector');
    }

    const normalizedLength = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').length;
    if (normalizedLength > 50000) {
      findings.push(`Suspicious text length: ${normalizedLength} chars (potential prompt stuffing)`);
    }
  }

  return { clean: findings.length === 0, findings };
}

function sanitizeForPrompt(text) {
  if (!text || typeof text !== 'string') return text;

  let sanitized = text;
  sanitized = sanitized.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, '');
  sanitized = sanitized.replace(/<(\/?)(?:system|assistant|human)>/gi, (_, slash) => `＜${slash || ''}system-text＞`);
  sanitized = sanitized.replace(/\[(SYSTEM|INST)\]/gi, '[$1-TEXT]');
  sanitized = sanitized.replace(/<<\s*SYS\s*>>/gi, '«SYS-TEXT»');
  return sanitized;
}

function sanitizeForDisplay(text) {
  if (!text || typeof text !== 'string') return text;

  let sanitized = sanitizeForPrompt(text);
  const protocolLeakPatterns = [
    /^\s*(?:assistant|user|system)\s+to=[^:\s]+:[^\n]+$/i,
    /^\s*<\|(?:assistant|user|system)[^|]*\|>\s*$/i,
  ];

  sanitized = sanitized
    .split('\n')
    .filter(line => !protocolLeakPatterns.some(pattern => pattern.test(line)))
    .join('\n');

  return sanitized;
}

function validateShellArg(value, label) {
  if (!value || typeof value !== 'string') {
    throw new Error(`${label || 'Argument'}: empty or invalid value`);
  }

  if (value.includes('\0')) {
    throw new Error(`${label || 'Argument'}: contains null bytes`);
  }

  if (/[$`]/.test(value) && /\$\(|`/.test(value)) {
    throw new Error(`${label || 'Argument'}: contains potential command substitution`);
  }

  return value;
}

function safeJsonParse(text, opts = {}) {
  const maxLength = opts.maxLength || 1048576;
  const label = opts.label || 'JSON';

  if (!text || typeof text !== 'string') {
    return { ok: false, error: `${label}: empty or invalid input` };
  }

  if (text.length > maxLength) {
    return { ok: false, error: `${label}: input exceeds ${maxLength} byte limit (got ${text.length})` };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: `${label}: parse error - ${err.message}` };
  }
}

function validatePhaseNumber(phase) {
  if (!phase || typeof phase !== 'string') {
    return { valid: false, error: 'Phase number is required' };
  }

  const trimmed = phase.trim();
  if (/^\d{1,4}[A-Z]?(?:\.\d{1,3})*$/i.test(trimmed)) {
    return { valid: true, normalized: trimmed };
  }
  if (/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){1,4}$/i.test(trimmed) && trimmed.length <= 30) {
    return { valid: true, normalized: trimmed };
  }
  return { valid: false, error: `Invalid phase number format: "${trimmed}"` };
}

function validateFieldName(field) {
  if (!field || typeof field !== 'string') {
    return { valid: false, error: 'Field name is required' };
  }
  if (/^[A-Za-z][A-Za-z0-9 _.\-/]{0,60}$/.test(field)) {
    return { valid: true };
  }
  return { valid: false, error: `Invalid field name: "${field}"` };
}

const KNOWN_VALID_TAGS = new Set([
  'objective', 'process', 'step', 'success_criteria', 'critical_rules',
  'available_agent_types', 'purpose', 'required_reading',
]);

function validatePromptStructure(text, fileType) {
  if (!text || typeof text !== 'string') {
    return { valid: true, violations: [] };
  }
  if (fileType !== 'agent' && fileType !== 'workflow') {
    return { valid: true, violations: [] };
  }

  const violations = [];
  const tagRegex = /<([A-Za-z][A-Za-z0-9_-]*)/g;
  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    const tag = match[1].toLowerCase();
    if (!KNOWN_VALID_TAGS.has(tag)) {
      violations.push(`Unknown XML tag in ${fileType} file: <${tag}>`);
    }
  }
  return { valid: violations.length === 0, violations };
}

function shannonEntropy(text) {
  if (!text || text.length === 0) return 0;
  const freq = {};
  for (const ch of text) freq[ch] = (freq[ch] || 0) + 1;
  const len = text.length;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function scanEntropyAnomalies(text) {
  if (!text || typeof text !== 'string') {
    return { clean: true, findings: [] };
  }

  const findings = [];
  const paragraphs = text.split(/\n\n+/);
  for (const para of paragraphs) {
    if (para.length <= 50) continue;
    const entropy = shannonEntropy(para);
    if (entropy > 5.5) {
      findings.push(`High-entropy paragraph detected (${entropy.toFixed(2)} bits/char) - possible encoded payload`);
    }
  }
  return { clean: findings.length === 0, findings };
}

module.exports = {
  validatePath,
  requireSafePath,
  INJECTION_PATTERNS,
  scanForInjection,
  sanitizeForPrompt,
  sanitizeForDisplay,
  validateShellArg,
  safeJsonParse,
  validatePhaseNumber,
  validateFieldName,
  validatePromptStructure,
  scanEntropyAnomalies,
};
