#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TARGETS = ["skills", "workflows", "templates", "agents", "sdk/src", "site/app/security"];
const IGNORE_PATTERNS = [
  /(^|\/)skills\/candidates\//,
  /(^|\/)sdk\/src\/.*\.test\.ts$/,
];

const RULES = [
  {
    id: "gsd-branding",
    pattern: /\bGSD\b|get-shit-done|\/gsd:|gsd-/gi,
    severity: "warn",
    message: "Legacy GSD branding or command surface still present.",
  },
  {
    id: "repo-root-ref",
    pattern: /vendor\/get-anything-done\//gi,
    severity: "error",
    message: "Repo-internal framework path referenced from portable content.",
  },
  {
    id: "claude-home-ref",
    pattern: /\$HOME\/\.claude|~\/\.claude|\.claude\/bin\/gad-tools\.cjs|\.claude\/get-anything-done\/bin\/gad-tools\.cjs/gi,
    severity: "error",
    message: "Claude-local install path hardcoded.",
  },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "public") continue;
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function isTextFile(file) {
  return /\.(md|mdx|txt|json|ts|tsx|js|cjs|mjs)$/i.test(file);
}

function shouldIgnore(file) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  return IGNORE_PATTERNS.some((pattern) => pattern.test(rel));
}

const findings = [];

for (const target of TARGETS) {
  const abs = join(ROOT, target);
  for (const file of walk(abs).filter(isTextFile).filter((file) => !shouldIgnore(file))) {
    const content = readFileSync(file, "utf8");
    for (const rule of RULES) {
      const lines = content.split(/\r?\n/);
      for (let lineNo = 0; lineNo < lines.length; lineNo += 1) {
        if (!rule.pattern.test(lines[lineNo])) continue;
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          file: relative(ROOT, file).replace(/\\/g, "/"),
          line: lineNo + 1,
          text: lines[lineNo].trim().slice(0, 180),
          message: rule.message,
        });
        rule.pattern.lastIndex = 0;
      }
    }
  }
}

const totals = findings.reduce(
  (acc, finding) => {
    acc.total += 1;
    acc[finding.severity] += 1;
    return acc;
  },
  { total: 0, error: 0, warn: 0 },
);

console.log(JSON.stringify({ totals, findings }, null, 2));
process.exit(totals.error > 0 ? 1 : 0);
