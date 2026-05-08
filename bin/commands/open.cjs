'use strict';
/**
 * gad open — open operator dashboard routes in the default browser.
 *
 * Subcommands:
 *   gad open dashboard [--report closures|throughput|worker-utilization]
 *   gad open handoffs
 *   gad open reports
 *
 * Base URL: GAD_PLATFORM_URL env var, or http://localhost:3002 default.
 *
 * Platform detection: Windows → start, macOS → open, Linux → xdg-open.
 */

const { defineCommand } = require('citty');
const { execSync } = require('child_process');

const DEFAULT_PLATFORM_URL = 'http://localhost:3002';

const VALID_REPORTS = ['closures', 'throughput', 'worker-utilization'];

function getBaseUrl() {
  return (process.env.GAD_PLATFORM_URL || DEFAULT_PLATFORM_URL).replace(/\/$/, '');
}

function openUrl(url) {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore', shell: true });
    } else if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    }
    console.log(`Opened: ${url}`);
  } catch (err) {
    console.error(`Failed to open browser: ${err.message}`);
    console.error(`URL: ${url}`);
    process.exitCode = 1;
  }
}

const dashboardCmd = defineCommand({
  meta: {
    name: 'dashboard',
    description: 'Open operator dashboard (default: closures report)',
  },
  args: {
    report: {
      type: 'string',
      description: `Report to open: ${VALID_REPORTS.join(' | ')}`,
      default: 'closures',
    },
  },
  run({ args }) {
    const report = args.report || 'closures';
    if (!VALID_REPORTS.includes(report)) {
      console.error(
        `Unknown report "${report}". Valid: ${VALID_REPORTS.join(', ')}`
      );
      process.exitCode = 1;
      return;
    }
    const url = `${getBaseUrl()}/operator/reports/${report}`;
    openUrl(url);
  },
});

const handoffsCmd = defineCommand({
  meta: {
    name: 'handoffs',
    description: 'Open handoffs page in default browser',
  },
  run() {
    openUrl(`${getBaseUrl()}/handoffs`);
  },
});

const reportsCmd = defineCommand({
  meta: {
    name: 'reports',
    description: 'Open operator reports (defaults to closures)',
  },
  args: {
    report: {
      type: 'string',
      description: `Report to open: ${VALID_REPORTS.join(' | ')}`,
      default: 'closures',
    },
  },
  run({ args }) {
    const report = args.report || 'closures';
    if (!VALID_REPORTS.includes(report)) {
      console.error(
        `Unknown report "${report}". Valid: ${VALID_REPORTS.join(', ')}`
      );
      process.exitCode = 1;
      return;
    }
    const url = `${getBaseUrl()}/operator/reports/${report}`;
    openUrl(url);
  },
});

function createOpenCommand(_deps) {
  return defineCommand({
    meta: {
      name: 'open',
      description: 'Open operator dashboard routes in the default browser',
    },
    subCommands: {
      dashboard: dashboardCmd,
      handoffs: handoffsCmd,
      reports: reportsCmd,
    },
  });
}

exports.register = function register(ctx) {
  const openCmd = createOpenCommand(ctx.common || {});
  return { open: openCmd };
};
