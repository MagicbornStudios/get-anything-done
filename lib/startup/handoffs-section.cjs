'use strict';
/**
 * startup/handoffs-section.cjs — render the "HANDOFFS FOR YOU" block.
 *
 * Wraps buildHandoffsSection + printSection with runtime-aware defaults.
 * Non-fatal: any error is swallowed so snapshot still runs.
 */

function printHandoffsSection({
  baseDir,
  detectRuntimeIdentity,
  buildHandoffsSection,
  printSection,
  logger = console,
  limit = 5,
}) {
  try {
    const detectedRuntime = detectRuntimeIdentity().id;
    const knownRuntime = detectedRuntime && detectedRuntime !== 'unknown' ? detectedRuntime : undefined;
    const section = buildHandoffsSection({
      baseDir,
      runtime: knownRuntime,
      mineFirst: !!knownRuntime,
      limit,
    });
    if (!section) return;

    logger.log('');
    printSection(section);
    if (knownRuntime) {
      logger.log(`Auto-claim the best match for your runtime: \`gad handoffs claim-next --runtime ${knownRuntime}\``);
    } else {
      logger.log('Runtime not auto-detected — pass `--runtime <id>` to `gad handoffs claim-next` to pick up.');
    }
  } catch {
    /* non-fatal — snapshot still runs without handoffs section */
  }
}

module.exports = { printHandoffsSection };
