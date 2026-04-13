import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { QueryPhase } from './types.js';

function planningFile(projectDir: string, fileName: string): string {
  return join(projectDir, '.planning', fileName);
}

export async function readRoadmapPhases(projectDir: string): Promise<QueryPhase[]> {
  const xmlFile = planningFile(projectDir, 'ROADMAP.xml');
  if (!existsSync(xmlFile)) return [];
  return parseRoadmapXml(await readFile(xmlFile, 'utf8'));
}

export function parseRoadmapXml(content: string): QueryPhase[] {
  const phases: QueryPhase[] = [];
  const phaseRe = /<phase\b([^>]*)>([\s\S]*?)<\/phase>/g;
  let match: RegExpExecArray | null;
  while ((match = phaseRe.exec(content)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const id = attrs.match(/\bid="([^"]*)"/)?.[1] || '';
    if (!id) continue;
    const goal = (body.match(/<goal>([\s\S]*?)<\/goal>/)?.[1] || '').replace(/<[^>]+>/g, '').trim();
    const title = (body.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').trim() || goal;
    const rawStatus = (body.match(/<status>([\s\S]*?)<\/status>/)?.[1] || 'planned').trim().toLowerCase();
    const status = rawStatus === 'done' || rawStatus === 'closed' || rawStatus === 'complete' || rawStatus === 'completed'
      ? 'done'
      : rawStatus === 'active' || rawStatus === 'in-progress'
        ? 'active'
        : rawStatus === 'cancelled' || rawStatus === 'canceled' || rawStatus === 'superseded'
          ? 'cancelled'
          : 'planned';
    phases.push({
      id,
      title,
      goal,
      status,
      depends: (body.match(/<depends>([\s\S]*?)<\/depends>/)?.[1] || '').trim(),
      milestone: (body.match(/<milestone>([\s\S]*?)<\/milestone>/)?.[1] || '').trim(),
      plans: (body.match(/<plans>([\s\S]*?)<\/plans>/)?.[1] || '').trim(),
      requirements: (body.match(/<requirements>([\s\S]*?)<\/requirements>/)?.[1] || '').trim(),
      description: goal,
    });
  }
  return phases;
}

export async function readStateXml(projectDir: string): Promise<string | null> {
  const stateFile = planningFile(projectDir, 'STATE.xml');
  if (!existsSync(stateFile)) return null;
  return readFile(stateFile, 'utf8');
}

export async function readDocsMapXml(projectDir: string): Promise<string | null> {
  const docsMapFile = planningFile(projectDir, 'DOCS-MAP.xml');
  if (!existsSync(docsMapFile)) return null;
  return readFile(docsMapFile, 'utf8');
}
