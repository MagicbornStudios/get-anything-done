'use strict';

const {
  extractFrontmatterAndBody,
  extractFrontmatterField,
  neutralizeAgentReferences,
  stripSubTags,
  toSingleLine,
  yamlIdentifier,
  yamlQuote,
} = require('./converter-utils.cjs');

const {
  convertClaudeAgentToAugmentAgent,
  convertClaudeAgentToCursorAgent,
  convertClaudeAgentToWindsurfAgent,
  convertClaudeCommandToAugmentSkill,
  convertClaudeCommandToCursorSkill,
  convertClaudeCommandToWindsurfSkill,
  convertClaudeToAugmentMarkdown,
  convertClaudeToCursorMarkdown,
  convertClaudeToWindsurfMarkdown,
  getAugmentSkillAdapterHeader,
  getCursorSkillAdapterHeader,
  getWindsurfSkillAdapterHeader,
} = require('./editor-converters.cjs');

// Copilot tool name mapping - Claude Code tools to GitHub Copilot tools
// Tool mapping applies ONLY to agents, NOT to skills (per CONTEXT.md decision)
const claudeToCopilotTools = {
  Read: 'read',
  Write: 'edit',
  Edit: 'edit',
  Bash: 'execute',
  Grep: 'search',
  Glob: 'search',
  Task: 'agent',
  WebSearch: 'web',
  WebFetch: 'web',
  TodoWrite: 'todo',
  AskUserQuestion: 'ask_user',
  SlashCommand: 'skill',
};

/**
 * Convert Claude Code frontmatter to opencode format
 * - Converts 'allowed-tools:' array to 'permission:' object
 * @param {string} content - Markdown file content with YAML frontmatter
 * @returns {string} - Content with converted frontmatter
 */
// Color name to hex mapping for opencode compatibility
const colorNameToHex = {
  cyan: '#00FFFF',
  red: '#FF0000',
  green: '#00FF00',
  blue: '#0000FF',
  yellow: '#FFFF00',
  magenta: '#FF00FF',
  orange: '#FFA500',
  purple: '#800080',
  pink: '#FFC0CB',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#808080',
  grey: '#808080',
};

// Tool name mapping from Claude Code to OpenCode
// OpenCode uses lowercase tool names; special mappings for renamed tools
const claudeToOpencodeTools = {
  AskUserQuestion: 'question',
  SlashCommand: 'skill',
  TodoWrite: 'todowrite',
  WebFetch: 'webfetch',
  WebSearch: 'websearch',  // Plugin/MCP - keep for compatibility
};

// Tool name mapping from Claude Code to Gemini CLI
// Gemini CLI uses snake_case built-in tool names
const claudeToGeminiTools = {
  Read: 'read_file',
  Write: 'write_file',
  Edit: 'replace',
  Bash: 'run_shell_command',
  Glob: 'glob',
  Grep: 'search_file_content',
  WebSearch: 'google_web_search',
  WebFetch: 'web_fetch',
  TodoWrite: 'write_todos',
  AskUserQuestion: 'ask_user',
};

/**
 * Convert a Claude Code tool name to OpenCode format
 * - Applies special mappings (AskUserQuestion -> question, etc.)
 * - Converts to lowercase (except MCP tools which keep their format)
 */
function convertToolName(claudeTool) {
  // Check for special mapping first
  if (claudeToOpencodeTools[claudeTool]) {
    return claudeToOpencodeTools[claudeTool];
  }
  // MCP tools (mcp__*) keep their format
  if (claudeTool.startsWith('mcp__')) {
    return claudeTool;
  }
  // Default: convert to lowercase
  return claudeTool.toLowerCase();
}

/**
 * Convert a Claude Code tool name to Gemini CLI format
 * - Applies Claude→Gemini mapping (Read→read_file, Bash→run_shell_command, etc.)
 * - Filters out MCP tools (mcp__*) — they are auto-discovered at runtime in Gemini
 * - Filters out Task — agents are auto-registered as tools in Gemini
 * @returns {string|null} Gemini tool name, or null if tool should be excluded
 */
function convertGeminiToolName(claudeTool) {
  // MCP tools: exclude — auto-discovered from mcpServers config at runtime
  if (claudeTool.startsWith('mcp__')) {
    return null;
  }
  // Task: exclude — agents are auto-registered as callable tools
  if (claudeTool === 'Task') {
    return null;
  }
  // Check for explicit mapping
  if (claudeToGeminiTools[claudeTool]) {
    return claudeToGeminiTools[claudeTool];
  }
  // Default: lowercase
  return claudeTool.toLowerCase();
}

/**
 * Convert a Claude Code tool name to GitHub Copilot format.
 * - Applies explicit mapping from claudeToCopilotTools
 * - Handles mcp__context7__* prefix → io.github.upstash/context7/*
 * - Falls back to lowercase for unknown tools
 */
function convertCopilotToolName(claudeTool) {
  // mcp__context7__* wildcard → io.github.upstash/context7/*
  if (claudeTool.startsWith('mcp__context7__')) {
    return 'io.github.upstash/context7/' + claudeTool.slice('mcp__context7__'.length);
  }
  // Check explicit mapping
  if (claudeToCopilotTools[claudeTool]) {
    return claudeToCopilotTools[claudeTool];
  }
  // Default: lowercase
  return claudeTool.toLowerCase();
}

/**
 * Apply Copilot-specific content conversion — CONV-06 (paths) + CONV-07 (command names).
 * Path mappings depend on install mode:
 *   Global: ~/.claude/ → ~/.copilot/, ./.claude/ → ./.github/
 *   Local:  ~/.claude/ → ./.github/, ./.claude/ → ./.github/
 * Applied to ALL Copilot content (skills, agents, engine files).
 * @param {string} content - Source content to convert
 * @param {boolean} [isGlobal=false] - Whether this is a global install
 */
function convertClaudeToCopilotContent(content, isGlobal = false) {
  let c = content;
  // CONV-06: Path replacement — most specific first to avoid substring matches
  if (isGlobal) {
    c = c.replace(/\$HOME\/\.claude\//g, '$HOME/.copilot/');
    c = c.replace(/~\/\.claude\//g, '~/.copilot/');
  } else {
    c = c.replace(/\$HOME\/\.claude\//g, '.github/');
    c = c.replace(/~\/\.claude\//g, '.github/');
    c = c.replace(/~\/\.claude\n/g, '.github/');
  }
  c = c.replace(/\.\/\.claude\//g, './.github/');
  c = c.replace(/\.claude\//g, '.github/');
  // CONV-07: Command name conversion (all gad: references → gad-)
  c = c.replace(/gad:/g, 'gad-');
  // Runtime-neutral agent name replacement (#766)
  c = neutralizeAgentReferences(c, 'copilot-instructions.md');
  return c;
}

/**
 * Convert a Claude command (.md) to a Copilot skill (SKILL.md).
 * Transforms frontmatter only — body passes through with CONV-06/07 applied.
 * Skills keep original tool names (no mapping) per CONTEXT.md decision.
 */
function convertClaudeCommandToCopilotSkill(content, skillName, isGlobal = false) {
  const converted = convertClaudeToCopilotContent(content, isGlobal);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const argumentHint = extractFrontmatterField(frontmatter, 'argument-hint');
  const agent = extractFrontmatterField(frontmatter, 'agent');

  // CONV-02: Extract allowed-tools YAML multiline list → comma-separated string
  const toolsMatch = frontmatter.match(/^allowed-tools:\s*\n((?:\s+-\s+.+\n?)*)/m);
  let toolsLine = '';
  if (toolsMatch) {
    const tools = toolsMatch[1].match(/^\s+-\s+(.+)/gm);
    if (tools) {
      toolsLine = tools.map(t => t.replace(/^\s+-\s+/, '').trim()).join(', ');
    }
  }

  // Reconstruct frontmatter in Copilot format
  let fm = `---\nname: ${skillName}\ndescription: ${description}\n`;
  if (argumentHint) fm += `argument-hint: ${yamlQuote(argumentHint)}\n`;
  if (agent) fm += `agent: ${agent}\n`;
  if (toolsLine) fm += `allowed-tools: ${toolsLine}\n`;
  fm += '---';

  return `${fm}\n${body}`;
}

/**
 * Convert a Claude command (.md) to a Claude skill (SKILL.md).
 * Claude Code is the native format, so minimal conversion needed —
 * preserve allowed-tools as YAML multiline list, preserve argument-hint,
 * convert name from gad:xxx to gad-xxx format.
 */
function convertClaudeCommandToClaudeSkill(content, skillName) {
  const { frontmatter, body } = extractFrontmatterAndBody(content);
  if (!frontmatter) return content;

  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const argumentHint = extractFrontmatterField(frontmatter, 'argument-hint');
  const agent = extractFrontmatterField(frontmatter, 'agent');

  // Preserve allowed-tools as YAML multiline list (Claude native format)
  const toolsMatch = frontmatter.match(/^allowed-tools:\s*\n((?:\s+-\s+.+\n?)*)/m);
  let toolsBlock = '';
  if (toolsMatch) {
    toolsBlock = 'allowed-tools:\n' + toolsMatch[1];
    // Ensure trailing newline
    if (!toolsBlock.endsWith('\n')) toolsBlock += '\n';
  }

  // Reconstruct frontmatter in Claude skill format
  let fm = `---\nname: ${skillName}\ndescription: ${yamlQuote(description)}\n`;
  if (argumentHint) fm += `argument-hint: ${yamlQuote(argumentHint)}\n`;
  if (agent) fm += `agent: ${agent}\n`;
  if (toolsBlock) fm += toolsBlock;
  fm += '---';

  return `${fm}\n${body}`;
}

/**
 * Convert a Claude agent (.md) to a Copilot agent (.agent.md).
 * Applies tool mapping + deduplication, formats tools as JSON array.
 * CONV-04: JSON array format. CONV-05: Tool name mapping.
 */
function convertClaudeAgentToCopilotAgent(content, isGlobal = false) {
  const converted = convertClaudeToCopilotContent(content, isGlobal);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const color = extractFrontmatterField(frontmatter, 'color');
  const toolsRaw = extractFrontmatterField(frontmatter, 'tools') || '';

  // CONV-04 + CONV-05: Map tools, deduplicate, format as JSON array
  const claudeTools = toolsRaw.split(',').map(t => t.trim()).filter(Boolean);
  const mappedTools = claudeTools.map(t => convertCopilotToolName(t));
  const uniqueTools = [...new Set(mappedTools)];
  const toolsArray = uniqueTools.length > 0
    ? "['" + uniqueTools.join("', '") + "']"
    : '[]';

  // Reconstruct frontmatter in Copilot format
  let fm = `---\nname: ${name}\ndescription: ${description}\ntools: ${toolsArray}\n`;
  if (color) fm += `color: ${color}\n`;
  fm += '---';

  return `${fm}\n${body}`;
}

/**
 * Apply Antigravity-specific content conversion — path replacement + command name conversion.
 * Path mappings depend on install mode:
 *   Global: ~/.claude/ → ~/.gemini/antigravity/, ./.claude/ → ./.agent/
 *   Local:  ~/.claude/ → .agent/, ./.claude/ → ./.agent/
 * Applied to ALL Antigravity content (skills, agents, engine files).
 * @param {string} content - Source content to convert
 * @param {boolean} [isGlobal=false] - Whether this is a global install
 */
function convertClaudeToAntigravityContent(content, isGlobal = false) {
  let c = content;
  if (isGlobal) {
    c = c.replace(/\$HOME\/\.claude\//g, '$HOME/.gemini/antigravity/');
    c = c.replace(/~\/\.claude\//g, '~/.gemini/antigravity/');
  } else {
    c = c.replace(/\$HOME\/\.claude\//g, '.agent/');
    c = c.replace(/~\/\.claude\//g, '.agent/');
  }
  c = c.replace(/\.\/\.claude\//g, './.agent/');
  c = c.replace(/\.claude\//g, '.agent/');
  // Command name conversion (all gad: references → gad-)
  c = c.replace(/gad:/g, 'gad-');
  // Runtime-neutral agent name replacement (#766)
  c = neutralizeAgentReferences(c, 'GEMINI.md');
  return c;
}

/**
 * Convert a Claude command (.md) to an Antigravity skill (SKILL.md).
 * Transforms frontmatter to minimal name + description only.
 * Body passes through with path/command conversions applied.
 */
function convertClaudeCommandToAntigravitySkill(content, skillName, isGlobal = false) {
  const converted = convertClaudeToAntigravityContent(content, isGlobal);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = skillName || extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';

  const fm = `---\nname: ${name}\ndescription: ${description}\n---`;
  return `${fm}\n${body}`;
}

/**
 * Convert a Claude agent (.md) to an Antigravity agent.
 * Uses Gemini tool names since Antigravity runs on Gemini 3 backend.
 */
function convertClaudeAgentToAntigravityAgent(content, isGlobal = false) {
  const converted = convertClaudeToAntigravityContent(content, isGlobal);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const color = extractFrontmatterField(frontmatter, 'color');
  const toolsRaw = extractFrontmatterField(frontmatter, 'tools') || '';

  // Map tools to Gemini equivalents (reuse existing convertGeminiToolName)
  const claudeTools = toolsRaw.split(',').map(t => t.trim()).filter(Boolean);
  const mappedTools = claudeTools.map(t => convertGeminiToolName(t)).filter(Boolean);

  let fm = `---\nname: ${name}\ndescription: ${description}\ntools: ${mappedTools.join(', ')}\n`;
  if (color) fm += `color: ${color}\n`;
  fm += '---';

  return `${fm}\n${body}`;
}

function convertSlashCommandsToCodexSkillMentions(content) {
  let converted = content.replace(/\/gad:([a-z0-9-]+)/gi, (_, commandName) => {
    return `$gad-${String(commandName).toLowerCase()}`;
  });
  converted = converted.replace(/\/gad-help\b/g, '$gad-help');
  return converted;
}

function convertClaudeToCodexMarkdown(content) {
  let converted = convertSlashCommandsToCodexSkillMentions(content);
  converted = converted.replace(/\$ARGUMENTS\b/g, '{{GAD_ARGS}}');
  // Path replacement: .claude → .codex (#1430)
  converted = converted.replace(/\$HOME\/\.claude\//g, '$HOME/.codex/');
  converted = converted.replace(/\$HOME\/\.claude\b/g, '$HOME/.codex');
  converted = converted.replace(/~\/\.claude\//g, '~/.codex/');
  converted = converted.replace(/~\/\.claude\b/g, '~/.codex');
  converted = converted.replace(/\.\/\.claude\//g, './.codex/');
  // Runtime-neutral agent name replacement (#766)
  converted = neutralizeAgentReferences(converted, 'AGENTS.md');
  return converted;
}

function getCodexSkillAdapterHeader(skillName) {
  const invocation = `$${skillName}`;
  return `<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by mentioning \`${invocation}\`.
- Treat all user text after \`${invocation}\` as \`{{GAD_ARGS}}\`.
- If no arguments are present, treat \`{{GAD_ARGS}}\` as empty.

## B. AskUserQuestion → request_user_input Mapping
GAD workflows use \`AskUserQuestion\` (Claude Code syntax). Translate to Codex \`request_user_input\`:

Parameter mapping:
- \`header\` → \`header\`
- \`question\` → \`question\`
- Options formatted as \`"Label" — description\` → \`{label: "Label", description: "description"}\`
- Generate \`id\` from header: lowercase, replace spaces with underscores

Batched calls:
- \`AskUserQuestion([q1, q2])\` → single \`request_user_input\` with multiple entries in \`questions[]\`

Multi-select workaround:
- Codex has no \`multiSelect\`. Use sequential single-selects, or present a numbered freeform list asking the user to enter comma-separated numbers.

Execute mode fallback:
- When \`request_user_input\` is rejected (Execute mode), present a plain-text numbered list and pick a reasonable default.

## C. Task() → spawn_agent Mapping
GAD workflows use \`Task(...)\` (Claude Code syntax). Translate to Codex collaboration tools:

Direct mapping:
- \`Task(subagent_type="X", prompt="Y")\` → \`spawn_agent(agent_type="X", message="Y")\`
- \`Task(model="...")\` → omit (Codex uses per-role config, not inline model selection)
- \`fork_context: false\` by default — GAD agents load their own context via \`<files_to_read>\` blocks

Parallel fan-out:
- Spawn multiple agents → collect agent IDs → \`wait(ids)\` for all to complete

Result parsing:
- Look for structured markers in agent output: \`CHECKPOINT\`, \`PLAN COMPLETE\`, \`SUMMARY\`, etc.
- \`close_agent(id)\` after collecting results from each agent
</codex_skill_adapter>`;
}

function convertClaudeCommandToCodexSkill(content, skillName) {
  const converted = convertClaudeToCodexMarkdown(content);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  let description = `Run GAD workflow ${skillName}.`;
  if (frontmatter) {
    const maybeDescription = extractFrontmatterField(frontmatter, 'description');
    if (maybeDescription) {
      description = maybeDescription;
    }
  }
  description = toSingleLine(description);
  const shortDescription = description.length > 180 ? `${description.slice(0, 177)}...` : description;
  const adapter = getCodexSkillAdapterHeader(skillName);

  return `---\nname: ${yamlQuote(skillName)}\ndescription: ${yamlQuote(description)}\nmetadata:\n  short-description: ${yamlQuote(shortDescription)}\n---\n\n${adapter}\n\n${body.trimStart()}`;
}

/**
 * Convert Claude Code agent markdown to Codex agent format.
 * Applies base markdown conversions, then adds a <codex_agent_role> header
 * and cleans up frontmatter (removes tools/color fields).
 */
function convertClaudeAgentToCodexAgent(content) {
  let converted = convertClaudeToCodexMarkdown(content);

  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const tools = extractFrontmatterField(frontmatter, 'tools') || '';

  const roleHeader = `<codex_agent_role>
role: ${name}
tools: ${tools}
purpose: ${toSingleLine(description)}
</codex_agent_role>`;

  const cleanFrontmatter = `---\nname: ${yamlQuote(name)}\ndescription: ${yamlQuote(toSingleLine(description))}\n---`;

  return `${cleanFrontmatter}\n\n${roleHeader}\n${body}`;
}


/**
 * Convert Claude Code agent frontmatter to Gemini CLI format
 * Gemini agents use .md files with YAML frontmatter, same as Claude,
 * but with different field names and formats:
 * - tools: must be a YAML array (not comma-separated string)
 * - tool names: must use Gemini built-in names (read_file, not Read)
 * - color: must be removed (causes validation error)
 * - skills: must be removed (causes validation error)
 * - mcp__* tools: must be excluded (auto-discovered at runtime)
 */
function convertClaudeToGeminiAgent(content) {
  if (!content.startsWith('---')) return content;

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) return content;

  const frontmatter = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3);

  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  let inSkippedArrayField = false;
  const tools = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (inSkippedArrayField) {
      if (!trimmed || trimmed.startsWith('- ')) {
        continue;
      }
      inSkippedArrayField = false;
    }

    // Convert allowed-tools YAML array to tools list
    if (trimmed.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    // Handle inline tools: field (comma-separated string)
    if (trimmed.startsWith('tools:')) {
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) {
        const parsed = toolsValue.split(',').map(t => t.trim()).filter(t => t);
        for (const t of parsed) {
          const mapped = convertGeminiToolName(t);
          if (mapped) tools.push(mapped);
        }
      } else {
        // tools: with no value means YAML array follows
        inAllowedTools = true;
      }
      continue;
    }

    // Strip color field (not supported by Gemini CLI, causes validation error)
    if (trimmed.startsWith('color:')) continue;

    // Strip skills field (not supported by Gemini CLI, causes validation error)
    if (trimmed.startsWith('skills:')) {
      inSkippedArrayField = true;
      continue;
    }

    // Collect allowed-tools/tools array items
    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) {
        const mapped = convertGeminiToolName(trimmed.substring(2).trim());
        if (mapped) tools.push(mapped);
        continue;
      } else if (trimmed && !trimmed.startsWith('-')) {
        inAllowedTools = false;
      }
    }

    if (!inAllowedTools) {
      newLines.push(line);
    }
  }

  // Add tools as YAML array (Gemini requires array format)
  if (tools.length > 0) {
    newLines.push('tools:');
    for (const tool of tools) {
      newLines.push(`  - ${tool}`);
    }
  }

  const newFrontmatter = newLines.join('\n').trim();

  // Escape ${VAR} patterns in agent body for Gemini CLI compatibility.
  // Gemini's templateString() treats all ${word} patterns as template variables
  // and throws "Template validation failed: Missing required input parameters"
  // when they can't be resolved. GAD agents use ${PHASE}, ${PLAN}, etc. as
  // shell variables in bash code blocks — convert to $VAR (no braces) which
  // is equivalent bash and invisible to Gemini's /\$\{(\w+)\}/g regex.
  const escapedBody = body.replace(/\$\{(\w+)\}/g, '$$$1');

  // Runtime-neutral agent name replacement (#766)
  const neutralBody = neutralizeAgentReferences(escapedBody, 'GEMINI.md');
  return `---\n${newFrontmatter}\n---${stripSubTags(neutralBody)}`;
}

function convertClaudeToOpencodeFrontmatter(content, { isAgent = false } = {}) {
  // Replace tool name references in content (applies to all files)
  let convertedContent = content;
  convertedContent = convertedContent.replace(/\bAskUserQuestion\b/g, 'question');
  convertedContent = convertedContent.replace(/\bSlashCommand\b/g, 'skill');
  convertedContent = convertedContent.replace(/\bTodoWrite\b/g, 'todowrite');
  // Replace /gad:command with /gad-command for opencode (flat command structure)
  convertedContent = convertedContent.replace(/\/gad:/g, '/gad-');
  // Replace ~/.claude and $HOME/.claude with OpenCode's config location
  convertedContent = convertedContent.replace(/~\/\.claude\b/g, '~/.config/opencode');
  convertedContent = convertedContent.replace(/\$HOME\/\.claude\b/g, '$HOME/.config/opencode');
  // Replace general-purpose subagent type with OpenCode's equivalent "general"
  convertedContent = convertedContent.replace(/subagent_type="general-purpose"/g, 'subagent_type="general"');
  // Runtime-neutral agent name replacement (#766)
  convertedContent = neutralizeAgentReferences(convertedContent, 'AGENTS.md');

  // Check if content has frontmatter
  if (!convertedContent.startsWith('---')) {
    return convertedContent;
  }

  // Find the end of frontmatter
  const endIndex = convertedContent.indexOf('---', 3);
  if (endIndex === -1) {
    return convertedContent;
  }

  const frontmatter = convertedContent.substring(3, endIndex).trim();
  const body = convertedContent.substring(endIndex + 3);

  // Parse frontmatter line by line (simple YAML parsing)
  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  let inSkippedArray = false;
  const allowedTools = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // For agents: skip commented-out lines (e.g. hooks blocks)
    if (isAgent && trimmed.startsWith('#')) {
      continue;
    }

    // Detect start of allowed-tools array
    if (trimmed.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    // Detect inline tools: field (comma-separated string)
    if (trimmed.startsWith('tools:')) {
      if (isAgent) {
        // Agents: strip tools entirely (not supported in OpenCode agent frontmatter)
        inSkippedArray = true;
        continue;
      }
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) {
        // Parse comma-separated tools
        const tools = toolsValue.split(',').map(t => t.trim()).filter(t => t);
        allowedTools.push(...tools);
      }
      continue;
    }

    // For agents: strip skills:, color:, memory:, maxTurns:, permissionMode:, disallowedTools:
    if (isAgent && /^(skills|color|memory|maxTurns|permissionMode|disallowedTools):/.test(trimmed)) {
      inSkippedArray = true;
      continue;
    }

    // Skip continuation lines of a stripped array/object field
    if (inSkippedArray) {
      if (trimmed.startsWith('- ') || trimmed.startsWith('#') || /^\s/.test(line)) {
        continue;
      }
      inSkippedArray = false;
    }

    // For commands: remove name: field (opencode uses filename for command name)
    // For agents: keep name: (required by OpenCode agents)
    if (!isAgent && trimmed.startsWith('name:')) {
      continue;
    }

    // Strip model: field — OpenCode doesn't support Claude Code model aliases
    // like 'haiku', 'sonnet', 'opus', or 'inherit'. Omitting lets OpenCode use
    // its configured default model. See #1156.
    if (trimmed.startsWith('model:')) {
      continue;
    }

    // Convert color names to hex for opencode (commands only; agents strip color above)
    if (trimmed.startsWith('color:')) {
      const colorValue = trimmed.substring(6).trim().toLowerCase();
      const hexColor = colorNameToHex[colorValue];
      if (hexColor) {
        newLines.push(`color: "${hexColor}"`);
      } else if (colorValue.startsWith('#')) {
        // Validate hex color format (#RGB or #RRGGBB)
        if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(colorValue)) {
          // Already hex and valid, keep as is
          newLines.push(line);
        }
        // Skip invalid hex colors
      }
      // Skip unknown color names
      continue;
    }

    // Collect allowed-tools items
    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) {
        allowedTools.push(trimmed.substring(2).trim());
        continue;
      } else if (trimmed && !trimmed.startsWith('-')) {
        // End of array, new field started
        inAllowedTools = false;
      }
    }

    // Keep other fields
    if (!inAllowedTools) {
      newLines.push(line);
    }
  }

  // For agents: add required OpenCode agent fields
  // Note: Do NOT add 'model: inherit' — OpenCode does not recognize the 'inherit'
  // keyword and throws ProviderModelNotFoundError. Omitting model: lets OpenCode
  // use its default model for subagents. See #1156.
  if (isAgent) {
    newLines.push('mode: subagent');
  }

  // For commands: add tools object if we had allowed-tools or tools
  if (!isAgent && allowedTools.length > 0) {
    newLines.push('tools:');
    for (const tool of allowedTools) {
      newLines.push(`  ${convertToolName(tool)}: true`);
    }
  }

  // Rebuild frontmatter (body already has tool names converted)
  const newFrontmatter = newLines.join('\n').trim();
  return `---\n${newFrontmatter}\n---${body}`;
}

/**
 * Convert Claude Code markdown command to Gemini TOML format
 * @param {string} content - Markdown file content with YAML frontmatter
 * @returns {string} - TOML content
 */
function convertClaudeToGeminiToml(content) {
  // Check if content has frontmatter
  if (!content.startsWith('---')) {
    return `prompt = ${JSON.stringify(content)}\n`;
  }

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return `prompt = ${JSON.stringify(content)}\n`;
  }

  const frontmatter = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3).trim();
  
  // Extract description from frontmatter
  let description = '';
  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('description:')) {
      description = trimmed.substring(12).trim();
      break;
    }
  }

  // Construct TOML
  let toml = '';
  if (description) {
    toml += `description = ${JSON.stringify(description)}\n`;
  }
  
  toml += `prompt = ${JSON.stringify(body)}\n`;
  
  return toml;
}


module.exports = {
  yamlIdentifier,
  yamlQuote,
  toSingleLine,
  extractFrontmatterAndBody,
  extractFrontmatterField,
  stripSubTags,
  neutralizeAgentReferences,
  claudeToCopilotTools,
  convertToolName,
  convertGeminiToolName,
  convertCopilotToolName,
  convertClaudeToCopilotContent,
  convertClaudeCommandToCopilotSkill,
  convertClaudeAgentToCopilotAgent,
  convertClaudeCommandToClaudeSkill,
  convertClaudeToAntigravityContent,
  convertClaudeCommandToAntigravitySkill,
  convertClaudeAgentToAntigravityAgent,
  convertClaudeCommandToCursorSkill,
  convertClaudeAgentToCursorAgent,
  convertClaudeToCursorMarkdown,
  getCursorSkillAdapterHeader,
  convertClaudeToWindsurfMarkdown,
  convertClaudeCommandToWindsurfSkill,
  convertClaudeAgentToWindsurfAgent,
  getWindsurfSkillAdapterHeader,
  convertClaudeToAugmentMarkdown,
  convertClaudeCommandToAugmentSkill,
  convertClaudeAgentToAugmentAgent,
  getAugmentSkillAdapterHeader,
  convertClaudeToCodexMarkdown,
  getCodexSkillAdapterHeader,
  convertClaudeCommandToCodexSkill,
  convertClaudeAgentToCodexAgent,
  convertClaudeToGeminiAgent,
  convertClaudeToOpencodeFrontmatter,
  convertClaudeToGeminiToml,
};
