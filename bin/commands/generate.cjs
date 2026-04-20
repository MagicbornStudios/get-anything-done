'use strict';
/**
 * gad generate — AI generation fundamentals (decision gad-217).
 * Currently exposes `generate text`. Image / audio / video to follow.
 *
 * Required deps: outputError.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createGenerateCommand(deps) {
  const { outputError } = deps;

  const generateText = defineCommand({
    meta: { name: 'text', description: 'Generate text from a prompt and write to file' },
    args: {
      prompt: { type: 'positional', description: 'The prompt text', required: true },
      out: { type: 'string', alias: 'o', description: 'Output file path (default: stdout)', default: '' },
      model: { type: 'string', alias: 'm', description: 'Model to use (default: claude-sonnet-4-20250514)', default: 'claude-sonnet-4-20250514' },
      system: { type: 'string', alias: 's', description: 'System prompt', default: '' },
      maxTokens: { type: 'string', description: 'Max output tokens', default: '4096' },
    },
    async run({ args }) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        outputError('ANTHROPIC_API_KEY not set. Export it or add to .env');
        process.exit(1);
      }

      const body = {
        model: args.model,
        max_tokens: parseInt(args.maxTokens, 10),
        messages: [{ role: 'user', content: args.prompt }],
      };
      if (args.system) body.system = args.system;

      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const err = await resp.text();
          outputError(`API error ${resp.status}: ${err}`);
          process.exit(1);
        }

        const data = await resp.json();
        const text = data.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n');

        if (args.out) {
          const outPath = path.resolve(args.out);
          const dir = path.dirname(outPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(outPath, text, 'utf8');
          console.log(`Written to ${args.out} (${text.length} chars)`);
        } else {
          console.log(text);
        }
      } catch (err) {
        outputError(`Generation failed: ${err.message}`);
        process.exit(1);
      }
    },
  });

  const generateCmd = defineCommand({
    meta: { name: 'generate', description: 'AI generation fundamentals — prompt in, file out' },
    subCommands: { text: generateText },
  });

  return { generateCmd };
}

module.exports = { createGenerateCommand };
module.exports.register = (ctx) => ({ generate: createGenerateCommand(ctx.common).generateCmd });
