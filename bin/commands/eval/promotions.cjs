'use strict';

function promoteEvalAliases({ services, subCommands }) {
  Object.assign(subCommands.species.subCommands, {
    run: services['eval-run'].cmd,
    suite: services['eval-suite'].evalSuite,
  });

  Object.assign(subCommands.generation.subCommands, {
    preserve: services['eval-artifacts'].evalPreserve,
    verify: services['eval-artifacts'].evalVerify,
    open: services['eval-preview'].evalOpen,
    review: services['eval-preview'].evalReview,
    report: services['eval-suite'].evalReport,
  });
}

module.exports = { promoteEvalAliases };
