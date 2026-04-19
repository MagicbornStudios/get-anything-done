'use strict';

const {
  extractFrontmatterAndBody,
  extractFrontmatterField,
  toSingleLine,
  yamlIdentifier,
  yamlQuote,
} = require('./converter-utils.cjs');

const claudeToCursorTools = {
  Bash: 'Shell',
  Edit: 'StrReplace',
  AskUserQuestion: null,
  SlashCommand: null,
};

function convertCursorToolName(claudeTool) {
  if (claudeTool in claudeToCursorTools) {
    return claudeToCursorTools[claudeTool];
  }
  if (claudeTool.startsWith('mcp__')) {
    return claudeTool;
  }
  return claudeTool;
}

function convertSlashCommandsToCursorSkillMentions(content) {
  return content.replace(/gad:/gi, 'gad-');
}

function convertClaudeToCursorMarkdown(content) {
  let converted = convertSlashCommandsToCursorSkillMentions(content);
  converted = converted.replace(/\bBash\(/g, 'Shell(');
  converted = converted.replace(/\bEdit\(/g, 'StrReplace(');
  converted = converted.replace(/\bAskUserQuestion\b/g, 'conversational prompting');
  converted = converted.replace(/subagent_type="general-purpose"/g, 'subagent_type="generalPurpose"');
  converted = converted.replace(/\$ARGUMENTS\b/g, '{{GAD_ARGS}}');
  converted = converted.replace(/`\.\/CLAUDE\.md`/g, '`.cursor/rules/`');
  converted = converted.replace(/\.\/CLAUDE\.md/g, '.cursor/rules/');
  converted = converted.replace(/`CLAUDE\.md`/g, '`.cursor/rules/`');
  converted = converted.replace(/\bCLAUDE\.md\b/g, '.cursor/rules/');
  converted = converted.replace(/\.claude\/skills\//g, '.cursor/skills/');
  converted = converted.replace(/\*\*Known Claude Code bug \(classifyHandoffIfNeeded\):\*\*[^\n]*\n/g, '');
  converted = converted.replace(/- \*\*classifyHandoffIfNeeded false failure:\*\*[^\n]*\n/g, '');
  converted = converted.replace(/\bClaude Code\b/g, 'Cursor');
  return converted;
}

function getCursorSkillAdapterHeader(skillName) {
  return `<cursor_skill_adapter>
## A. Skill Invocation
- This skill is invoked when the user mentions \`${skillName}\` or describes a task matching this skill.
- Treat all user text after the skill mention as \`{{GAD_ARGS}}\`.
- If no arguments are present, treat \`{{GAD_ARGS}}\` as empty.

## B. User Prompting
When the workflow needs user input, prompt the user conversationally:
- Present options as a numbered list in your response text
- Ask the user to reply with their choice
- For multi-select, ask for comma-separated numbers

## C. Tool Usage
Use these Cursor tools when executing GAD workflows:
- \`Shell\` for running commands (terminal operations)
- \`StrReplace\` for editing existing files
- \`Read\`, \`Write\`, \`Glob\`, \`Grep\`, \`Task\`, \`WebSearch\`, \`WebFetch\`, \`TodoWrite\` as needed

## D. Subagent Spawning
When the workflow needs to spawn a subagent:
- Use \`Task(subagent_type="generalPurpose", ...)\`
- The \`model\` parameter maps to Cursor's model options (e.g., "fast")
</cursor_skill_adapter>`;
}

function convertClaudeCommandToCursorSkill(content, skillName) {
  const converted = convertClaudeToCursorMarkdown(content);
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
  const adapter = getCursorSkillAdapterHeader(skillName);

  return `---\nname: ${yamlIdentifier(skillName)}\ndescription: ${yamlQuote(shortDescription)}\n---\n\n${adapter}\n\n${body.trimStart()}`;
}

function convertClaudeAgentToCursorAgent(content) {
  const converted = convertClaudeToCursorMarkdown(content);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const cleanFrontmatter = `---\nname: ${yamlIdentifier(name)}\ndescription: ${yamlQuote(toSingleLine(description))}\n---`;

  return `${cleanFrontmatter}\n${body}`;
}

const claudeToWindsurfTools = {
  Bash: 'Shell',
  Edit: 'StrReplace',
  AskUserQuestion: null,
  SlashCommand: null,
};

function convertWindsurfToolName(claudeTool) {
  if (claudeTool in claudeToWindsurfTools) {
    return claudeToWindsurfTools[claudeTool];
  }
  if (claudeTool.startsWith('mcp__')) {
    return claudeTool;
  }
  return claudeTool;
}

function convertSlashCommandsToWindsurfSkillMentions(content) {
  return content.replace(/gad:/gi, 'gad-');
}

function convertClaudeToWindsurfMarkdown(content) {
  let converted = convertSlashCommandsToWindsurfSkillMentions(content);
  converted = converted.replace(/\bBash\(/g, 'Shell(');
  converted = converted.replace(/\bEdit\(/g, 'StrReplace(');
  converted = converted.replace(/\bAskUserQuestion\b/g, 'conversational prompting');
  converted = converted.replace(/subagent_type="general-purpose"/g, 'subagent_type="generalPurpose"');
  converted = converted.replace(/\$ARGUMENTS\b/g, '{{GAD_ARGS}}');
  converted = converted.replace(/`\.\/CLAUDE\.md`/g, '`.windsurf/rules`');
  converted = converted.replace(/\.\/CLAUDE\.md/g, '.windsurf/rules');
  converted = converted.replace(/`CLAUDE\.md`/g, '`.windsurf/rules`');
  converted = converted.replace(/\bCLAUDE\.md\b/g, '.windsurf/rules');
  converted = converted.replace(/\.claude\/skills\//g, '.windsurf/skills/');
  converted = converted.replace(/\*\*Known Claude Code bug \(classifyHandoffIfNeeded\):\*\*[^\n]*\n/g, '');
  converted = converted.replace(/- \*\*classifyHandoffIfNeeded false failure:\*\*[^\n]*\n/g, '');
  converted = converted.replace(/\bClaude Code\b/g, 'Windsurf');
  return converted;
}

function getWindsurfSkillAdapterHeader(skillName) {
  return `<windsurf_skill_adapter>
## A. Skill Invocation
- This skill is invoked when the user mentions \`${skillName}\` or describes a task matching this skill.
- Treat all user text after the skill mention as \`{{GAD_ARGS}}\`.
- If no arguments are present, treat \`{{GAD_ARGS}}\` as empty.

## B. User Prompting
When the workflow needs user input, prompt the user conversationally:
- Present options as a numbered list in your response text
- Ask the user to reply with their choice
- For multi-select, ask for comma-separated numbers

## C. Tool Usage
Use these Windsurf tools when executing GAD workflows:
- \`Shell\` for running commands (terminal operations)
- \`StrReplace\` for editing existing files
- \`Read\`, \`Write\`, \`Glob\`, \`Grep\`, \`Task\`, \`WebSearch\`, \`WebFetch\`, \`TodoWrite\` as needed

## D. Subagent Spawning
When the workflow needs to spawn a subagent:
- Use \`Task(subagent_type="generalPurpose", ...)\`
- The \`model\` parameter maps to Windsurf's model options (e.g., "fast")
</windsurf_skill_adapter>`;
}

function convertClaudeCommandToWindsurfSkill(content, skillName) {
  const converted = convertClaudeToWindsurfMarkdown(content);
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
  const adapter = getWindsurfSkillAdapterHeader(skillName);

  return `---\nname: ${yamlIdentifier(skillName)}\ndescription: ${yamlQuote(shortDescription)}\n---\n\n${adapter}\n\n${body.trimStart()}`;
}

function convertClaudeAgentToWindsurfAgent(content) {
  const converted = convertClaudeToWindsurfMarkdown(content);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const cleanFrontmatter = `---\nname: ${yamlIdentifier(name)}\ndescription: ${yamlQuote(toSingleLine(description))}\n---`;

  return `${cleanFrontmatter}\n${body}`;
}

const claudeToAugmentTools = {
  Bash: 'launch-process',
  Edit: 'str-replace-editor',
  AskUserQuestion: null,
  SlashCommand: null,
  TodoWrite: 'add_tasks',
};

function convertAugmentToolName(claudeTool) {
  if (claudeTool in claudeToAugmentTools) {
    return claudeToAugmentTools[claudeTool];
  }
  if (claudeTool.startsWith('mcp__')) {
    return claudeTool;
  }
  const toolMapping = {
    Read: 'view',
    Write: 'save-file',
    Glob: 'view',
    Grep: 'grep',
    Task: null,
    WebSearch: 'web-search',
    WebFetch: 'web-fetch',
  };
  return toolMapping[claudeTool] || claudeTool;
}

function convertSlashCommandsToAugmentSkillMentions(content) {
  return content.replace(/gad:/gi, 'gad-');
}

function convertClaudeToAugmentMarkdown(content) {
  let converted = convertSlashCommandsToAugmentSkillMentions(content);
  converted = converted.replace(/\bBash\(/g, 'launch-process(');
  converted = converted.replace(/\bEdit\(/g, 'str-replace-editor(');
  converted = converted.replace(/\bRead\(/g, 'view(');
  converted = converted.replace(/\bWrite\(/g, 'save-file(');
  converted = converted.replace(/\bTodoWrite\(/g, 'add_tasks(');
  converted = converted.replace(/\bAskUserQuestion\b/g, 'conversational prompting');
  converted = converted.replace(/subagent_type="general-purpose"/g, 'subagent_type="generalPurpose"');
  converted = converted.replace(/\$ARGUMENTS\b/g, '{{GAD_ARGS}}');
  converted = converted.replace(/`\.\/CLAUDE\.md`/g, '`.augment/rules/`');
  converted = converted.replace(/\.\/CLAUDE\.md/g, '.augment/rules/');
  converted = converted.replace(/`CLAUDE\.md`/g, '`.augment/rules/`');
  converted = converted.replace(/\bCLAUDE\.md\b/g, '.augment/rules/');
  converted = converted.replace(/\.claude\/skills\//g, '.augment/skills/');
  converted = converted.replace(/\*\*Known Claude Code bug \(classifyHandoffIfNeeded\):\*\*[^\n]*\n/g, '');
  converted = converted.replace(/- \*\*classifyHandoffIfNeeded false failure:\*\*[^\n]*\n/g, '');
  converted = converted.replace(/\bClaude Code\b/g, 'Augment');
  return converted;
}

function getAugmentSkillAdapterHeader(skillName) {
  return `<augment_skill_adapter>
## A. Skill Invocation
- This skill is invoked when the user mentions \`${skillName}\` or describes a task matching this skill.
- Treat all user text after the skill mention as \`{{GAD_ARGS}}\`.
- If no arguments are present, treat \`{{GAD_ARGS}}\` as empty.

## B. User Prompting
When the workflow needs user input, prompt the user conversationally:
- Present options as a numbered list in your response text
- Ask the user to reply with their choice
- For multi-select, ask for comma-separated numbers

## C. Tool Usage
Use these Augment tools when executing GAD workflows:
- \`launch-process\` for running commands (terminal operations)
- \`str-replace-editor\` for editing existing files
- \`view\` for reading files and listing directories
- \`save-file\` for creating new files
- \`grep\` for searching code (or use MCP servers for advanced search)
- \`web-search\`, \`web-fetch\` for web queries
- \`add_tasks\`, \`view_tasklist\`, \`update_tasks\` for task management

## D. Subagent Spawning
When the workflow needs to spawn a subagent:
- Use the built-in subagent spawning capability
- Define agent prompts in \`.augment/agents/\` directory
</augment_skill_adapter>`;
}

function convertClaudeCommandToAugmentSkill(content, skillName) {
  const converted = convertClaudeToAugmentMarkdown(content);
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
  const adapter = getAugmentSkillAdapterHeader(skillName);

  return `---\nname: ${yamlIdentifier(skillName)}\ndescription: ${yamlQuote(shortDescription)}\n---\n\n${adapter}\n\n${body.trimStart()}`;
}

function convertClaudeAgentToAugmentAgent(content) {
  const converted = convertClaudeToAugmentMarkdown(content);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const cleanFrontmatter = `---\nname: ${yamlIdentifier(name)}\ndescription: ${yamlQuote(toSingleLine(description))}\n---`;

  return `${cleanFrontmatter}\n${body}`;
}

module.exports = {
  convertCursorToolName,
  convertClaudeToCursorMarkdown,
  getCursorSkillAdapterHeader,
  convertClaudeCommandToCursorSkill,
  convertClaudeAgentToCursorAgent,
  convertWindsurfToolName,
  convertClaudeToWindsurfMarkdown,
  getWindsurfSkillAdapterHeader,
  convertClaudeCommandToWindsurfSkill,
  convertClaudeAgentToWindsurfAgent,
  convertAugmentToolName,
  convertClaudeToAugmentMarkdown,
  getAugmentSkillAdapterHeader,
  convertClaudeCommandToAugmentSkill,
  convertClaudeAgentToAugmentAgent,
};
