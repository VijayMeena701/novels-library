import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureDir } from './mongodb-tools.js';
import type { ReportData, BackupResult, VerifyResult } from './types.js';

export async function writeReport({
  identifier,
  startedAt,
  steps,
  pre,
  post,
  verify,
}: {
  identifier: string;
  startedAt: string;
  steps: { name: string; ok: boolean; message: string }[];
  pre: BackupResult;
  post?: BackupResult;
  verify?: VerifyResult;
}): Promise<void> {
  const reportDir = join('backups', identifier);
  await ensureDir(reportDir);

  const completedAt = new Date().toISOString();

  const lines: string[] = [];
  lines.push(`Deployment report: ${identifier}`);
  lines.push(`Started : ${startedAt}`);
  lines.push(`Completed: ${completedAt}`);
  lines.push('');

  lines.push('Steps:');
  for (const step of steps) {
    const status = step.ok ? '[OK]' : '[FAIL]';
    lines.push(`  ${status} ${step.name}: ${step.message}`);
  }
  lines.push('');

  lines.push('Pre-backup counts:');
  for (const [name, count] of Object.entries(pre.counts).sort()) {
    lines.push(`  ${name}: ${count}`);
  }
  lines.push('');

  if (post) {
    lines.push('Post-backup counts:');
    for (const [name, count] of Object.entries(post.counts).sort()) {
      lines.push(`  ${name}: ${count}`);
    }
    lines.push('');
  }

  if (verify) {
    lines.push(...verify.messages);
    lines.push('');
  }

  const logPath = join(reportDir, 'report.log');
  const countsPath = join(reportDir, 'counts.json');
  const diffPath = join(reportDir, 'diff.json');

  await writeFile(logPath, lines.join('\n'));

  const countsData = {
    pre: pre.counts,
    post: post?.counts ?? {},
    checks: steps.map((s) => ({ name: s.name, ok: s.ok, message: s.message })),
  };
  await writeFile(countsPath, JSON.stringify(countsData, null, 2));

  const diffData = verify?.mismatches ?? { missing: [], extra: [], altered: [] };
  await writeFile(diffPath, JSON.stringify(diffData, null, 2));
}
