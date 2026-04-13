import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { QueryTask } from './types.js';

function planningFile(projectDir: string, fileName: string): string {
  return join(projectDir, '.planning', fileName);
}

function xmlAttr(attrs: string, name: string): string {
  const match = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'i'));
  return match ? match[1] : '';
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function setAttr(attrs: string, name: string, value: string): string {
  const escapedValue = escapeXmlAttr(value);
  const re = new RegExp(`(^|\\s)${escapeRegex(name)}="[^"]*"`, 'i');
  if (re.test(attrs)) {
    return attrs.replace(re, `$1${name}="${escapedValue}"`);
  }
  return `${attrs.trim()} ${name}="${escapedValue}"`.trim();
}

function clearAttr(attrs: string, name: string): string {
  const re = new RegExp(`\\s*${escapeRegex(name)}="[^"]*"`, 'ig');
  return attrs.replace(re, '').replace(/\s+/g, ' ').trim();
}

export async function readTaskRegistry(projectDir: string): Promise<QueryTask[]> {
  const xmlFile = planningFile(projectDir, 'TASK-REGISTRY.xml');
  if (!existsSync(xmlFile)) return [];
  return parseTaskRegistryXml(await readFile(xmlFile, 'utf8'));
}

export function parseTaskRegistryXml(content: string): QueryTask[] {
  const tasks: QueryTask[] = [];
  const taskRe = /<task\s([^>]*)>([\s\S]*?)<\/task>/g;
  let match: RegExpExecArray | null;
  while ((match = taskRe.exec(content)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const id = xmlAttr(attrs, 'id');
    if (!id) continue;

    const goal = (body.match(/<goal>([\s\S]*?)<\/goal>/)?.[1] || '').replace(/<[^>]+>/g, '').trim();
    const keywords = (body.match(/<keywords>([\s\S]*?)<\/keywords>/)?.[1] || '').trim();
    const depends = (body.match(/<depends>([\s\S]*?)<\/depends>/)?.[1] || '').trim();

    const commands: string[] = [];
    const commandsBlock = body.match(/<commands>([\s\S]*?)<\/commands>/)?.[1] || '';
    const commandRe = /<command>([\s\S]*?)<\/command>/g;
    let commandMatch: RegExpExecArray | null;
    while ((commandMatch = commandRe.exec(commandsBlock)) !== null) {
      const command = commandMatch[1].trim();
      if (command) commands.push(command);
    }

    const files: string[] = [];
    const filesBlock = body.match(/<files>([\s\S]*?)<\/files>/)?.[1] || '';
    const fileRe = /<file>([\s\S]*?)<\/file>/g;
    let fileMatch: RegExpExecArray | null;
    while ((fileMatch = fileRe.exec(filesBlock)) !== null) {
      const file = fileMatch[1].trim();
      if (file) files.push(file);
    }

    tasks.push({
      id,
      agentId: xmlAttr(attrs, 'agent-id'),
      agentRole: xmlAttr(attrs, 'agent-role'),
      runtime: xmlAttr(attrs, 'runtime'),
      modelProfile: xmlAttr(attrs, 'model-profile'),
      resolvedModel: xmlAttr(attrs, 'resolved-model'),
      claimed: xmlAttr(attrs, 'claimed').toLowerCase() === 'true',
      claimedAt: xmlAttr(attrs, 'claimed-at'),
      leaseExpiresAt: xmlAttr(attrs, 'lease-expires-at'),
      skill: xmlAttr(attrs, 'skill'),
      type: xmlAttr(attrs, 'type'),
      goal,
      status: (xmlAttr(attrs, 'status') || 'planned').toLowerCase(),
      phase: id.split('-')[0] || '',
      keywords,
      depends,
      commands,
      files,
    });
  }
  return tasks;
}

export async function readTaskById(projectDir: string, taskId: string): Promise<QueryTask | null> {
  const tasks = await readTaskRegistry(projectDir);
  return tasks.find((task) => task.id === taskId) || null;
}

export async function updateTaskRecord(projectDir: string, taskId: string, updater: (attrs: string, body: string) => string): Promise<void> {
  const xmlFile = planningFile(projectDir, 'TASK-REGISTRY.xml');
  const source = await readFile(xmlFile, 'utf8');
  let found = false;
  const next = source.replace(/<task\s([^>]*)>([\s\S]*?)<\/task>/g, (full: string, attrs: string, body: string) => {
    if (xmlAttr(String(attrs), 'id') !== taskId) return full;
    found = true;
    return `<task ${updater(String(attrs), String(body))}>${body}</task>`;
  });
  if (!found) throw new Error(`Task not found in TASK-REGISTRY.xml: ${taskId}`);
  await writeFile(xmlFile, next, 'utf8');
}

export async function claimTaskRecord(projectDir: string, taskId: string, claim: {
  agentId: string;
  agentRole?: string | null;
  runtime?: string | null;
  modelProfile?: string | null;
  resolvedModel?: string | null;
  claimedAt?: string;
  leaseExpiresAt?: string | null;
  status?: string;
}): Promise<void> {
  const claimedAt = claim.claimedAt || new Date().toISOString();
  await updateTaskRecord(projectDir, taskId, (attrs) => {
    const currentStatus = xmlAttr(attrs, 'status').toLowerCase();
    let next = attrs.trim();
    next = setAttr(next, 'status', currentStatus === 'done' ? 'done' : (claim.status || 'in-progress'));
    next = setAttr(next, 'agent-id', claim.agentId);
    if (claim.agentRole) next = setAttr(next, 'agent-role', claim.agentRole);
    if (claim.runtime) next = setAttr(next, 'runtime', claim.runtime);
    if (claim.modelProfile) next = setAttr(next, 'model-profile', claim.modelProfile);
    if (claim.resolvedModel) next = setAttr(next, 'resolved-model', claim.resolvedModel);
    next = setAttr(next, 'claimed', 'true');
    next = setAttr(next, 'claimed-at', claimedAt);
    if (claim.leaseExpiresAt) next = setAttr(next, 'lease-expires-at', claim.leaseExpiresAt);
    return next;
  });
}

export async function releaseTaskRecord(projectDir: string, taskId: string, options: { done?: boolean; status?: string } = {}): Promise<void> {
  await updateTaskRecord(projectDir, taskId, (attrs) => {
    const done = options.done === true || String(options.status || '').toLowerCase() === 'done';
    let next = attrs.trim();
    next = setAttr(next, 'status', done ? 'done' : (options.status || 'planned'));
    next = clearAttr(next, 'claimed');
    next = clearAttr(next, 'claimed-at');
    next = clearAttr(next, 'lease-expires-at');
    if (!done) {
      next = clearAttr(next, 'agent-id');
      next = clearAttr(next, 'agent-role');
      next = clearAttr(next, 'runtime');
      next = clearAttr(next, 'model-profile');
      next = clearAttr(next, 'resolved-model');
    }
    return next;
  });
}
