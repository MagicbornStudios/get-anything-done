/**
 * Workflow flow-control tag parser (v0) — decision gad-196.
 *
 * Parses the seven-tag vocabulary from
 * `.planning/notes/workflow-flow-control-dsl-exploration-2026-04-15.md`
 * Position B proposal:
 *
 *   <workflow>   — root element (one per file)
 *   <step>       — leaf execution unit (id, name, tool, skill, output)
 *   <branch>     — conditional block (if)
 *   <else>       — sibling of <branch>
 *   <loop>       — iteration (for)
 *   <parallel>   — siblings run concurrently
 *   <output>     — step-emitted value declaration (var, type)
 *
 * Tags are ADVISORY annotations on top of free-form Markdown. The parser
 * extracts structural nodes into an expected graph used by
 * `gad workflow validate` and `site/scripts/build-site-data.mjs` for
 * workflow_conformance measurement. Prose inside each tag is preserved
 * as `content` on the parsed node and is what the agent actually executes.
 *
 * Expressions in `if=` / `for=` attributes are parsed but NOT evaluated in
 * v0 — they are structural hints for the expected graph.
 *
 * This is a minimal parser: regex-based, tolerant of whitespace, does not
 * require strict XML validity (attributes may be unquoted short tokens).
 * It is NOT a full XML parser and should not be used for arbitrary HTML.
 */

'use strict';

const KNOWN_TAGS = new Set(['workflow', 'step', 'branch', 'else', 'loop', 'parallel', 'output', 'objective', 'inputs', 'outputs', 'process', 'references', 'notes', 'param', 'file', 'metric', 'tasklist', 'task', 'agent-prompt-template', 'ref']);

function parseAttributes(raw) {
  const attrs = {};
  // Match key="value", key='value', or key=bare-token
  const re = /([a-z][a-z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const key = m[1];
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
    attrs[key] = value;
  }
  return attrs;
}

function parse(source) {
  // Strip outside-fenced-block blocks first so mermaid/code fences don't
  // interfere with tag matching.
  const lines = source.split(/\r?\n/);
  const stripped = [];
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      stripped.push(''); // preserve line numbering
      continue;
    }
    if (inFence) {
      stripped.push('');
      continue;
    }
    stripped.push(line);
  }
  const text = stripped.join('\n');

  // Tokenize by tags. Each token is either:
  //   { kind: 'open', tag, attrs, start, end }
  //   { kind: 'close', tag, start, end }
  //   { kind: 'self', tag, attrs, start, end }  (self-closing <tag/>)
  const tokens = [];
  // Match opening/closing/self-closing tags. Attribute body may contain
  // quoted strings (with embedded '>'), so we alternate quoted segments
  // with non-'>' characters instead of a naive [^>]*.
  const tagRe = /<(\/?)([a-z][a-z0-9_-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/gi;
  let m;
  while ((m = tagRe.exec(text)) !== null) {
    const isClose = m[1] === '/';
    const tag = m[2].toLowerCase();
    const rawAttrs = m[3];
    const isSelf = m[4] === '/';
    if (!KNOWN_TAGS.has(tag)) continue; // ignore unknown tags
    const attrs = parseAttributes(rawAttrs);
    if (isClose) tokens.push({ kind: 'close', tag, start: m.index, end: m.index + m[0].length });
    else if (isSelf) tokens.push({ kind: 'self', tag, attrs, start: m.index, end: m.index + m[0].length });
    else tokens.push({ kind: 'open', tag, attrs, start: m.index, end: m.index + m[0].length });
  }

  // Build tree via stack
  const root = { tag: '$root', children: [], attrs: {}, content: '' };
  const stack = [root];
  let cursor = 0;
  for (const tok of tokens) {
    // Capture interstitial prose between previous cursor and this token start
    // and attach it to the top-of-stack node as content fragment.
    if (tok.start > cursor) {
      const prose = text.slice(cursor, tok.start);
      stack[stack.length - 1].content = (stack[stack.length - 1].content || '') + prose;
    }
    if (tok.kind === 'open') {
      const node = { tag: tok.tag, attrs: tok.attrs, children: [], content: '' };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (tok.kind === 'self') {
      const node = { tag: tok.tag, attrs: tok.attrs, children: [], content: '' };
      stack[stack.length - 1].children.push(node);
    } else if (tok.kind === 'close') {
      // Pop until we find a matching open. Tolerate mismatches.
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tok.tag) {
          stack.length = i;
          break;
        }
      }
    }
    cursor = tok.end;
  }
  if (cursor < text.length) {
    root.content = (root.content || '') + text.slice(cursor);
  }

  return root;
}

/**
 * Flatten a parsed tree into an expected-graph representation:
 *   {
 *     steps: [{ id, name, tool, skill, parent, kind: 'step'|'branch'|'loop'|'parallel' }],
 *     edges: [{ from: stepId, to: stepId, condition? }]
 *   }
 *
 * The flattener assigns ids to branch/loop/parallel nodes if they lack one.
 */
function flatten(tree) {
  const steps = [];
  const edges = [];
  let anonCounter = 0;
  const anon = (prefix) => `${prefix}-${++anonCounter}`;

  function walk(node, parentId, previousStepId, branchCondition) {
    let lastStepId = previousStepId;
    for (const child of node.children || []) {
      if (child.tag === 'step') {
        const id = child.attrs.id || anon('step');
        steps.push({
          id,
          name: child.attrs.name || id,
          tool: child.attrs.tool || null,
          skill: child.attrs.skill || null,
          output: child.attrs.output || null,
          kind: 'step',
          parent: parentId,
          content: (child.content || '').trim().slice(0, 500),
        });
        if (lastStepId) {
          edges.push({
            from: lastStepId,
            to: id,
            condition: branchCondition || null,
          });
        }
        lastStepId = id;
      } else if (child.tag === 'branch') {
        const id = child.attrs.id || anon('branch');
        steps.push({ id, name: 'branch', kind: 'branch', parent: parentId, condition: child.attrs.if || null });
        if (lastStepId) edges.push({ from: lastStepId, to: id, condition: null });
        walk(child, id, null, child.attrs.if);
        lastStepId = id;
      } else if (child.tag === 'else') {
        const id = anon('else');
        steps.push({ id, name: 'else', kind: 'else', parent: parentId });
        if (lastStepId) edges.push({ from: lastStepId, to: id, condition: null });
        walk(child, id, null, '!prev');
        lastStepId = id;
      } else if (child.tag === 'loop') {
        const id = child.attrs.id || anon('loop');
        steps.push({ id, name: 'loop', kind: 'loop', parent: parentId, over: child.attrs.for || null });
        if (lastStepId) edges.push({ from: lastStepId, to: id, condition: null });
        walk(child, id, null, null);
        lastStepId = id;
      } else if (child.tag === 'parallel') {
        const id = child.attrs.id || anon('parallel');
        steps.push({ id, name: 'parallel', kind: 'parallel', parent: parentId });
        if (lastStepId) edges.push({ from: lastStepId, to: id, condition: null });
        walk(child, id, null, null);
        lastStepId = id;
      } else {
        // Containers (workflow, process, objective, etc.) — descend without
        // introducing a new step id, keeping edge chain continuous.
        if (child.children && child.children.length > 0) {
          lastStepId = walk(child, parentId, lastStepId, branchCondition) || lastStepId;
        }
      }
    }
    return lastStepId;
  }

  walk(tree, null, null, null);
  return { steps, edges };
}

function parseAndFlatten(source) {
  const tree = parse(source);
  return flatten(tree);
}

module.exports = {
  parse,
  flatten,
  parseAndFlatten,
  KNOWN_TAGS,
};
