'use strict';
/**
 * issues.cjs — durable operator issue inbox helpers.
 *
 * Layout:
 *   <planningDir>/issues/{open,closed}/i-<timestamp>-<projectid>-<slug>.md
 *
 * One file per record keeps capture safe while agents are working in other
 * planning files. Issues are deliberately broader than ERRORS-AND-ATTEMPTS:
 * they are an inbox for later triage into tasks, decisions, handoffs, or errors.
 */

const fs = require('fs');
const path = require('path');

const BUCKETS = ['open', 'closed'];

class IssueError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'IssueError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

function defaultFs() {
  return {
    readdirSync: fs.readdirSync.bind(fs),
    readFileSync: (p) => fs.readFileSync(p, 'utf8'),
    writeFileSync: (p, d) => fs.writeFileSync(p, d, 'utf8'),
    renameSync: fs.renameSync.bind(fs),
    mkdirSync: fs.mkdirSync.bind(fs),
    existsSync: fs.existsSync.bind(fs),
    unlinkSync: fs.unlinkSync.bind(fs),
  };
}

function planningDirFor(root, baseDir) {
  return path.join(baseDir, root.path || '.', root.planningDir || '.planning');
}

function issuesDir(root, baseDir) {
  return path.join(planningDirFor(root, baseDir), 'issues');
}

function bucketDir(root, baseDir, bucket) {
  return path.join(issuesDir(root, baseDir), bucket);
}

function slugify(input, fallback = 'issue') {
  const slug = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

function timestampForId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function escapeFrontmatterValue(value) {
  return String(value == null ? '' : value).replace(/\r?\n/g, ' ').trim();
}

function parseFrontmatter(text) {
  const match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: String(text || '') };
  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    frontmatter[key] = value === 'null' ? null : value;
  }
  return { frontmatter, body: match[2] || '' };
}

function stringifyFrontmatter(frontmatter, body) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    lines.push(`${key}: ${value == null || value === '' ? 'null' : escapeFrontmatterValue(value)}`);
  }
  lines.push('---', '');
  return lines.join('\n') + String(body || '').trim() + '\n';
}

function locateIssue(root, baseDir, id, fsImpl) {
  for (const bucket of BUCKETS) {
    const filePath = path.join(bucketDir(root, baseDir, bucket), `${id}.md`);
    if (fsImpl.existsSync(filePath)) return { bucket, filePath };
  }
  return null;
}

function issueFromFile(root, baseDir, bucket, filePath, fsImpl) {
  const id = path.basename(filePath).replace(/\.md$/, '');
  const text = fsImpl.readFileSync(filePath);
  const { frontmatter, body } = parseFrontmatter(text);
  return {
    id,
    bucket,
    projectid: root.id,
    filePath,
    frontmatter: { ...frontmatter, id: frontmatter.id || id, projectid: frontmatter.projectid || root.id },
    body,
  };
}

function createIssue(root, baseDir, issue, fsImpl) {
  const fsi = fsImpl || defaultFs();
  const projectid = String(issue.projectid || root.id || '').trim();
  const title = String(issue.title || '').trim();
  const body = String(issue.body || '').trim();
  if (!projectid) throw new IssueError('VALIDATION_FAILED', 'projectid is required');
  if (!title) throw new IssueError('VALIDATION_FAILED', 'title is required');
  if (!body) throw new IssueError('VALIDATION_FAILED', 'body is required');

  const now = new Date().toISOString();
  const id = `i-${timestampForId()}-${slugify(projectid, 'project')}-${slugify(title)}`;
  const frontmatter = {
    id,
    projectid,
    status: 'open',
    title,
    severity: issue.severity || 'normal',
    type: issue.type || 'note',
    phase: issue.phase || null,
    task_id: issue.taskId || null,
    source: issue.source || 'operator',
    created_at: now,
    closed_at: null,
  };
  const openDir = bucketDir(root, baseDir, 'open');
  const filePath = path.join(openDir, `${id}.md`);
  try {
    fsi.mkdirSync(openDir, { recursive: true });
    fsi.writeFileSync(filePath, stringifyFrontmatter(frontmatter, body));
  } catch (error) {
    throw new IssueError('WRITE_FAILED', `Failed to write issue: ${error.message}`, error);
  }
  return { id, filePath, frontmatter, body };
}

function listIssues(root, baseDir, filter = {}, fsImpl) {
  const fsi = fsImpl || defaultFs();
  const bucket = filter.status && BUCKETS.includes(filter.status) ? filter.status : (filter.bucket || 'open');
  const buckets = bucket === 'all' ? BUCKETS : [bucket];
  const issues = [];

  for (const b of buckets) {
    const dir = bucketDir(root, baseDir, b);
    let files = [];
    try {
      files = fsi.readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      try {
        const issue = issueFromFile(root, baseDir, b, path.join(dir, file), fsi);
        const fm = issue.frontmatter;
        if (filter.phase && String(fm.phase || '') !== String(filter.phase)) continue;
        if (filter.type && String(fm.type || '') !== String(filter.type)) continue;
        issues.push(issue);
      } catch {
        continue;
      }
    }
  }

  issues.sort((a, b) => String(b.frontmatter.created_at || b.id).localeCompare(String(a.frontmatter.created_at || a.id)));
  return issues;
}

function readIssue(root, baseDir, id, fsImpl) {
  const fsi = fsImpl || defaultFs();
  const found = locateIssue(root, baseDir, id, fsi);
  if (!found) throw new IssueError('ISSUE_NOT_FOUND', `Issue not found: ${id}`);
  return issueFromFile(root, baseDir, found.bucket, found.filePath, fsi);
}

function closeIssue(root, baseDir, id, fsImpl) {
  const fsi = fsImpl || defaultFs();
  const found = locateIssue(root, baseDir, id, fsi);
  if (!found) throw new IssueError('ISSUE_NOT_FOUND', `Issue not found: ${id}`);
  if (found.bucket === 'closed') return found.filePath;

  const text = fsi.readFileSync(found.filePath);
  const { frontmatter, body } = parseFrontmatter(text);
  frontmatter.status = 'closed';
  frontmatter.closed_at = new Date().toISOString();

  const closedDir = bucketDir(root, baseDir, 'closed');
  const destPath = path.join(closedDir, `${id}.md`);
  try {
    fsi.mkdirSync(closedDir, { recursive: true });
    fsi.writeFileSync(found.filePath, stringifyFrontmatter(frontmatter, body));
    if (fsi.existsSync(destPath)) fsi.unlinkSync(destPath);
    fsi.renameSync(found.filePath, destPath);
  } catch (error) {
    throw new IssueError('WRITE_FAILED', `Failed to close issue ${id}: ${error.message}`, error);
  }
  return destPath;
}

module.exports = {
  IssueError,
  parseFrontmatter,
  stringifyFrontmatter,
  createIssue,
  listIssues,
  readIssue,
  closeIssue,
};
