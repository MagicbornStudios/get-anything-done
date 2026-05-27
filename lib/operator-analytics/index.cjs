'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { estimateTokens } = require('../token-estimator.cjs');

const DEFAULT_PERIOD = '7d';
const EVENT_TYPES = new Set(['user_message', 'tool_call']);

function nowIso() {
  return new Date().toISOString();
}

function parsePeriod(period) {
  const text = String(period || DEFAULT_PERIOD).trim();
  const compact = text.match(/^(\d+)([dhw])$/i);
  if (compact) {
    const amount = Number(compact[1]);
    const unit = compact[2].toLowerCase();
    const msPerUnit = { d: 86400000, h: 3600000, w: 604800000 }[unit];
    const endMs = Date.now();
    const startMs = endMs - amount * msPerUnit;
    return {
      period: text,
      startMs,
      endMs,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      durationMs: endMs - startMs,
    };
  }

  const ts = Date.parse(text);
  if (Number.isFinite(ts)) {
    const endMs = Date.now();
    return {
      period: text,
      startMs: ts,
      endMs,
      start: new Date(ts).toISOString(),
      end: new Date(endMs).toISOString(),
      durationMs: Math.max(0, endMs - ts),
    };
  }

  const endMs = Date.now();
  const fallbackDays = 7;
  const startMs = endMs - fallbackDays * 86400000;
  return {
    period: DEFAULT_PERIOD,
    startMs,
    endMs,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    durationMs: endMs - startMs,
  };
}

function tryReadDir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEventText(row) {
  if (!row || typeof row !== 'object') return '';
  const candidates = [
    row.input_summary,
    row.message,
    row.content,
    row.text,
    row.prompt,
    row.summary,
    row.input,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return normalizeWhitespace(value);
  }

  if (row.tool && typeof row.tool === 'string') return normalizeWhitespace(row.tool);
  if (row.cmd && typeof row.cmd === 'string') return normalizeWhitespace(row.cmd);
  return '';
}

function sessionKeyFor(row, filename) {
  if (typeof row.session_id === 'string' && row.session_id.trim()) return row.session_id.trim();
  if (typeof row.sessionId === 'string' && row.sessionId.trim()) return row.sessionId.trim();
  if (typeof row.pid === 'number' || typeof row.pid === 'string') return `pid:${row.pid}`;
  return `file:${path.basename(filename)}`;
}

function isInWindow(row, startMs, endMs) {
  if (!row || typeof row.ts !== 'string') return false;
  const ts = Date.parse(row.ts);
  if (!Number.isFinite(ts)) return false;
  return ts >= startMs && ts < endMs;
}

function sentenceFragments(text) {
  return normalizeWhitespace(text)
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .split(/[.?!]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function stripPoliteLead(text) {
  return text
    .replace(/^(please|could you|can you|would you|will you|do you|let's|lets|kindly)\s+/i, '')
    .replace(/^(i need you to|i want you to|i'd like you to|i would like you to)\s+/i, '')
    .replace(/^(make sure to|be sure to|try to|help me to)\s+/i, '')
    .trim();
}

function normalizePhrase(text) {
  const fragments = sentenceFragments(text);
  const first = stripPoliteLead(fragments[0] || text || '');
  return first
    .toLowerCase()
    .replace(/\b(my|the|a|an|this|that|these|those|our|your)\b/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifySpeechPattern(text) {
  const normalized = normalizeWhitespace(text).toLowerCase();
  const cleaned = normalized.replace(/[“”"']/g, '');

  const approvalPatterns = [
    /\b(ok|okay|okey|great|good|perfect|sounds good|looks good|approved|approve|proceed|go ahead|ship it|yes please|thank you|thanks)\b/i,
    /\b(that works|fine by me|all set|let's do it|lets do it)\b/i,
  ];
  if (approvalPatterns.some((re) => re.test(cleaned))) return 'approval';

  const clarificationPatterns = [
    /\b(can you clarify|could you clarify|please clarify|clarify|what do you mean|which one|what about|why is|how does|how should|am i missing|i'm missing|i am missing)\b/i,
    /\b(need more detail|need more context|help me understand|can you explain)\b/i,
  ];
  if (clarificationPatterns.some((re) => re.test(cleaned))) return 'clarification';

  if (/\?$/.test(cleaned) || /\b(what|why|how|when|where|who|which)\b/i.test(cleaned)) {
    return 'question';
  }

  const directivePatterns = [
    /\b(please|need you to|must|should|run|use|update|change|remove|add|fix|make|build|ship|write|refactor|implement|check|verify|inspect|create)\b/i,
    /^(do|make|use|run|check|update|fix|add|remove|refactor|implement)\b/i,
  ];
  if (directivePatterns.some((re) => re.test(cleaned))) return 'directive';

  return 'directive';
}

function pressureWeight(category) {
  switch (category) {
    case 'question':
      return 1.4;
    case 'clarification':
      return 1.8;
    case 'approval':
      return 0.25;
    case 'directive':
    default:
      return 0.9;
  }
}

function buildEmptyReport(window, trendWindow) {
  return {
    profile_version: '1.0',
    generated_at: nowIso(),
    period: window.period,
    window: { start: window.start, end: window.end },
    comparison_window: trendWindow ? { start: trendWindow.start, end: trendWindow.end } : null,
    total_input_tokens: 0,
    sessions_analyzed: 0,
    events_analyzed: 0,
    ask_like_events: 0,
    redundant_ask_count: 0,
    redundancy_rate: 0,
    speech_breakdown: {
      directive: 0,
      question: 0,
      clarification: 0,
      approval: 0,
    },
    top_redundant_phrases: [],
    pressure_contribution_pct: 0,
    input_optimization_suggestions: [
      'No operator input found in the selected window. Re-run after more sessions are logged.',
    ],
    improvement_trend: {
      compared_period: trendWindow ? trendWindow.label : null,
      input_tokens_delta: 0,
      input_tokens_delta_pct: 0,
      redundancy_rate_delta: 0,
      pressure_contribution_delta_pct: 0,
      signal: 'insufficient-data',
      summary: 'No input history was available in the selected window.',
    },
    method: {
      token_estimator: 'heuristic:chars/3.5',
      redundancy_definition: 'same normalized ask-like phrase repeated within the same session',
      pressure_formula: 'weighted speech categories + redundant ask penalty normalized against total influence',
    },
  };
}

function summarizeMetrics(events) {
  const bySession = new Map();
  const phraseCounts = new Map();
  const allEvents = [];
  let totalInputTokens = 0;
  let askLikeEvents = 0;
  let redundantAskCount = 0;
  const speechBreakdown = {
    directive: 0,
    question: 0,
    clarification: 0,
    approval: 0,
  };

  for (const event of events) {
    const text = extractEventText(event.row);
    if (!text) continue;

    const category = classifySpeechPattern(text);
    speechBreakdown[category] += 1;
    const tokens = estimateTokens(text);
    totalInputTokens += tokens;

    const sessionKey = event.sessionKey;
    if (!bySession.has(sessionKey)) {
      bySession.set(sessionKey, {
        seenPhrases: new Map(),
      });
    }

    const session = bySession.get(sessionKey);
    const normalizedPhrase = normalizePhrase(text);
    const askLike = category === 'question' || category === 'clarification';
    if (askLike) askLikeEvents += 1;

    if (normalizedPhrase.length >= 12 && askLike) {
      const current = session.seenPhrases.get(normalizedPhrase) || 0;
      if (current > 0) {
        redundantAskCount += 1;
        phraseCounts.set(normalizedPhrase, (phraseCounts.get(normalizedPhrase) || 0) + 1);
      }
      session.seenPhrases.set(normalizedPhrase, current + 1);
    }

    allEvents.push({
      category,
      tokens,
      text,
      sessionKey,
      normalizedPhrase,
      askLike,
    });
  }

  const pressureScore =
    (speechBreakdown.directive * pressureWeight('directive')) +
    (speechBreakdown.question * pressureWeight('question')) +
    (speechBreakdown.clarification * pressureWeight('clarification')) +
    (speechBreakdown.approval * pressureWeight('approval')) +
    (redundantAskCount * 3);

  const influenceScore = totalInputTokens + pressureScore;
  const pressureContributionPct = influenceScore > 0
    ? Math.round((pressureScore / influenceScore) * 100)
    : 0;
  const redundancyRate = askLikeEvents > 0
    ? redundantAskCount / askLikeEvents
    : 0;

  const topRedundantPhrases = [...phraseCounts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 5)
    .map(([phrase]) => phrase);

  return {
    totalInputTokens,
    askLikeEvents,
    redundantAskCount,
    redundancyRate,
    speechBreakdown,
    topRedundantPhrases,
    pressureContributionPct,
    pressureScore,
    influenceScore,
    bySession,
    allEvents,
  };
}

function improvementSignal(current, previous) {
  if (!previous || previous.eventsAnalyzed === 0) {
    return {
      input_tokens_delta: 0,
      input_tokens_delta_pct: 0,
      redundancy_rate_delta: 0,
      pressure_contribution_delta_pct: 0,
      signal: 'insufficient-data',
      summary: 'No prior window was available for comparison.',
    };
  }

  const tokenDelta = current.total_input_tokens - previous.total_input_tokens;
  const tokenDeltaPct = previous.total_input_tokens > 0
    ? tokenDelta / previous.total_input_tokens
    : 0;
  const redundancyDelta = current.redundancy_rate - previous.redundancy_rate;
  const pressureDeltaPct = current.pressure_contribution_pct - previous.pressure_contribution_pct;
  const score = (tokenDeltaPct * -1) + (redundancyDelta * -2) + (pressureDeltaPct * -0.02);
  let signal = 'flat';
  if (score > 0.1) signal = 'improving';
  else if (score < -0.1) signal = 'worsening';

  return {
    input_tokens_delta: tokenDelta,
    input_tokens_delta_pct: Math.round(tokenDeltaPct * 1000) / 1000,
    redundancy_rate_delta: Math.round(redundancyDelta * 1000) / 1000,
    pressure_contribution_delta_pct: pressureDeltaPct,
    signal,
    summary:
      signal === 'improving'
        ? 'The operator is spending fewer tokens, asking fewer repeated questions, or generating less pressure in the comparison window.'
        : signal === 'worsening'
          ? 'The operator is generating more tokens, more repetition, or more pressure than the comparison window.'
          : 'The current window is broadly similar to the comparison window.',
  };
}

async function readEventsInWindow(rootDir, window) {
  const dir = path.join(rootDir, '.planning', '.gad-log');
  const files = tryReadDir(dir)
    .filter((file) => file.endsWith('.jsonl'))
    .sort();

  const events = [];
  for (const filename of files) {
    const filePath = path.join(dir, filename);
    let stream;
    try {
      stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    } catch {
      continue;
    }

    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let lineNum = 0;
    for await (const line of rl) {
      lineNum += 1;
      const trimmed = line.trim();
      if (!trimmed) continue;

      let row;
      try {
        row = JSON.parse(trimmed);
      } catch {
        continue;
      }

      if (!isInWindow(row, window.startMs, window.endMs)) continue;
      const eventType = typeof row.type === 'string' ? row.type : typeof row.kind === 'string' ? row.kind : '';
      if (!EVENT_TYPES.has(eventType)) continue;

      const text = extractEventText(row);
      if (!text) continue;

      events.push({
        row,
        text,
        eventType,
        sessionKey: sessionKeyFor(row, filename),
        filename,
        lineNum,
      });
    }
  }

  return events;
}

async function buildReport({ rootDir = process.cwd(), period = DEFAULT_PERIOD } = {}) {
  const window = parsePeriod(period);
  const periodMs = Math.max(1, window.durationMs);
  const trendWindow = {
    label: `previous ${window.period}`,
    startMs: window.startMs - periodMs,
    endMs: window.startMs,
    start: new Date(window.startMs - periodMs).toISOString(),
    end: new Date(window.startMs).toISOString(),
  };

  const [currentEvents, previousEvents] = await Promise.all([
    readEventsInWindow(rootDir, window),
    readEventsInWindow(rootDir, trendWindow),
  ]);

  const current = summarizeMetrics(currentEvents);
  const previous = summarizeMetrics(previousEvents);

  const report = {
    profile_version: '1.0',
    generated_at: nowIso(),
    period: window.period,
    window: { start: window.start, end: window.end },
    comparison_window: { start: trendWindow.start, end: trendWindow.end },
    total_input_tokens: current.totalInputTokens,
    sessions_analyzed: current.bySession.size,
    events_analyzed: currentEvents.length,
    ask_like_events: current.askLikeEvents,
    redundant_ask_count: current.redundantAskCount,
    redundancy_rate: Math.round(current.redundancyRate * 1000) / 1000,
    speech_breakdown: current.speechBreakdown,
    top_redundant_phrases: current.topRedundantPhrases,
    pressure_contribution_pct: current.pressureContributionPct,
    input_optimization_suggestions: buildSuggestions(current, previous),
    improvement_trend: improvementSignal({
      total_input_tokens: current.totalInputTokens,
      redundancy_rate: current.redundancyRate,
      pressure_contribution_pct: current.pressureContributionPct,
    }, {
      eventsAnalyzed: previousEvents.length,
      total_input_tokens: previous.totalInputTokens,
      redundancy_rate: previous.redundancyRate,
      pressure_contribution_pct: previous.pressureContributionPct,
    }),
    method: {
      token_estimator: 'heuristic:chars/3.5',
      redundancy_definition: 'same normalized ask-like phrase repeated within the same session',
      pressure_formula: 'weighted speech categories + redundant ask penalty normalized against total influence',
      event_types: [...EVENT_TYPES],
    },
  };

  if (currentEvents.length === 0) {
    return buildEmptyReport(window, trendWindow);
  }

  return report;
}

function buildSuggestions(current, previous) {
  const suggestions = [];

  if (current.redundantAskCount > 0) {
    const repeated = current.redundantAskCount;
    suggestions.push(
      `Collapse repeated questions (${repeated} redundant ask${repeated === 1 ? '' : 's'}) into a single prompt with the needed context up front.`,
    );
  }

  if (current.speechBreakdown.question > current.speechBreakdown.directive) {
    suggestions.push('Convert some open-ended questions into explicit directives when the next action is already known.');
  }

  if (current.speechBreakdown.clarification > 0) {
    suggestions.push('Front-load missing context before asking for clarification so follow-up messages stay singular.');
  }

  if (previous && previous.eventsAnalyzed > 0) {
    if (current.redundancyRate < previous.redundancyRate) {
      suggestions.push('Keep the current prompting style: redundancy is trending down versus the comparison window.');
    } else if (current.redundancyRate > previous.redundancyRate) {
      suggestions.push('Tighten question framing; redundancy is trending up versus the comparison window.');
    }
  }

  if (suggestions.length === 0) {
    suggestions.push('No optimization signal detected. Continue using the current interaction style.');
  }

  return suggestions.slice(0, 5);
}

async function main(argv = process.argv.slice(2)) {
  const args = [...argv];
  let period = DEFAULT_PERIOD;
  let rootDir = process.cwd();

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--period' && args[i + 1]) {
      period = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--root' && args[i + 1]) {
      rootDir = path.resolve(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      process.stdout.write([
        'Usage: node vendor/get-anything-done/lib/operator-analytics/index.cjs --period 7d [--root <repo-root>]',
        '',
        'Outputs a JSON operator influence report for the selected window.',
      ].join('\n') + '\n');
      return 0;
    }
  }

  const report = await buildReport({ rootDir, period });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    process.stderr.write(`${err.stack || err.message || String(err)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildReport,
  buildSuggestions,
  classifySpeechPattern,
  extractEventText,
  normalizePhrase,
  parsePeriod,
  pressureWeight,
};
