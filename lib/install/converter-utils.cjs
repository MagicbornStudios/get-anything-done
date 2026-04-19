'use strict';

function toSingleLine(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function yamlQuote(value) {
  return JSON.stringify(value);
}

function yamlIdentifier(value) {
  const text = String(value).trim();
  if (/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(text)) {
    return text;
  }
  return yamlQuote(text);
}

function extractFrontmatterAndBody(content) {
  if (!content.startsWith('---')) {
    return { frontmatter: null, body: content };
  }

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return { frontmatter: null, body: content };
  }

  return {
    frontmatter: content.substring(3, endIndex).trim(),
    body: content.substring(endIndex + 3),
  };
}

function extractFrontmatterField(frontmatter, fieldName) {
  const regex = new RegExp(`^${fieldName}:\\s*(.+)$`, 'm');
  const match = frontmatter.match(regex);
  if (!match) return null;
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

/**
 * Runtime-neutral agent name and instruction file replacement.
 * Used by non-Claude runtime converters to avoid Claude-specific references.
 */
function neutralizeAgentReferences(content, instructionFile) {
  let c = content;
  c = c.replace(/\bClaude(?! Code| Opus| Sonnet| Haiku| native| based|-)\b(?!\.md)/g, 'the agent');
  if (instructionFile) {
    c = c.replace(/CLAUDE\.md/g, instructionFile);
  }
  c = c.replace(/Do NOT load full `AGENTS\.md` files[^\n]*/g, '');
  return c;
}

function stripSubTags(content) {
  return content.replace(/<sub>(.*?)<\/sub>/g, '*($1)*');
}

module.exports = {
  toSingleLine,
  yamlQuote,
  yamlIdentifier,
  extractFrontmatterAndBody,
  extractFrontmatterField,
  neutralizeAgentReferences,
  stripSubTags,
};
