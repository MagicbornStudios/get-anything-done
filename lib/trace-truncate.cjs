/**
 * Trace output truncation — head+tail split at a byte budget.
 *
 * Decision gad-60 pins the cap at 4 KB per event `outputs` field. When a
 * captured tool output exceeds the cap, we keep the first 2 KB and the last
 * 2 KB joined by a "... [truncated N bytes] ..." marker, and the caller
 * stamps `truncated: true` on the event.
 *
 * Full untruncated output stays in Claude Code's session.jsonl which is
 * accessible on disk — the cap only applies to what lands inside TRACE.json.
 *
 * Referenced by phase 25 plan (25-03) and decision gad-60.
 */

'use strict';

const DEFAULT_CAP_BYTES = 4096;
const DEFAULT_HEAD_BYTES = 2048;
const DEFAULT_TAIL_BYTES = 2048;

/**
 * Truncate a string to at most `cap` bytes (UTF-8 byte length), splitting
 * into `head` bytes of prefix and `tail` bytes of suffix joined by a marker
 * that indicates how many bytes were removed.
 *
 * @param {string} input - The raw output string.
 * @param {object} [opts]
 * @param {number} [opts.cap=4096]
 * @param {number} [opts.head=2048]
 * @param {number} [opts.tail=2048]
 * @returns {{ value: string, truncated: boolean, originalBytes: number }}
 */
function truncateOutput(input, opts = {}) {
  const cap = opts.cap ?? DEFAULT_CAP_BYTES;
  const head = opts.head ?? DEFAULT_HEAD_BYTES;
  const tail = opts.tail ?? DEFAULT_TAIL_BYTES;

  if (input == null) {
    return { value: '', truncated: false, originalBytes: 0 };
  }
  const str = typeof input === 'string' ? input : String(input);
  const buf = Buffer.from(str, 'utf8');
  const originalBytes = buf.length;

  if (originalBytes <= cap) {
    return { value: str, truncated: false, originalBytes };
  }

  // Slice at byte boundaries, then repair any incomplete multibyte sequence
  // at the slice edge by decoding with the replacement-char fallback.
  const headBuf = buf.subarray(0, head);
  const tailBuf = buf.subarray(originalBytes - tail);
  const removedBytes = originalBytes - head - tail;
  const marker = `\n... [truncated ${removedBytes} bytes] ...\n`;

  const value = headBuf.toString('utf8') + marker + tailBuf.toString('utf8');
  return { value, truncated: true, originalBytes };
}

/**
 * Truncate each field in an object. Used for tool `inputs` objects where
 * individual field values might be large but the whole object is usually
 * small. Non-string values are left untouched.
 */
function truncateInputsObject(inputs, opts = {}) {
  if (!inputs || typeof inputs !== 'object') return inputs;
  const out = {};
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value === 'string') {
      out[key] = truncateOutput(value, opts).value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

module.exports = {
  DEFAULT_CAP_BYTES,
  DEFAULT_HEAD_BYTES,
  DEFAULT_TAIL_BYTES,
  truncateOutput,
  truncateInputsObject,
};
