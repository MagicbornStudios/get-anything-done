'use strict';

function createPlayCommand({ defineCommand, outputError, servePreservedGenerationBuildArtifact }) {
  return defineCommand({
    meta: {
      name: 'play',
      description:
        "HTTP preview of a preserved generation's **build artifact** (HTML). Same as `gad generation open`. Not `gad site serve`. Use `--no-browser` for editor iframe workflows.",
    },
    args: {
      target: { type: 'positional', description: 'Project/species/version (e.g. escape-the-dungeon/bare/v3)', required: true },
      noBrowser: {
        type: 'boolean',
        description: 'Do not open a system browser; print the preview URL only.',
        default: false,
      },
    },
    run({ args }) {
      const parts = args.target.split('/');
      if (parts.length < 3) {
        outputError('Usage: gad play <project>/<species>/<version>');
        process.exit(1);
      }

      const version = parts[parts.length - 1];
      const project = parts.slice(0, -1).join('/');
      const noBrowser = args.noBrowser === true || args['no-browser'] === true;
      servePreservedGenerationBuildArtifact({
        project,
        version,
        logPrefix: '[gad play]',
        noBrowser,
      });
    },
  });
}

module.exports = { createPlayCommand };
