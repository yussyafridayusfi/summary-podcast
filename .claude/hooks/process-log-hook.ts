/**
 * Git Hook: Process Log Updater
 * Automatically updates PROCESS_LOG.md when project files are modified
 *
 * Hook triggered on: pre-commit, post-commit
 * This ensures changes are documented as they happen
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface ProcessLogEntry {
  date: string;
  type: 'Feature' | 'Fix' | 'Enhancement' | 'Refactor' | 'Documentation' | 'Chore';
  component: string;
  files: string[];
  description: string;
}

const PROJECT_ROOT = process.cwd();
const PROCESS_LOG_PATH = path.join(PROJECT_ROOT, 'PROCESS_LOG.md');

/**
 * Get current git status to determine what changed
 */
function getChangedFiles(): {
  added: string[];
  modified: string[];
  deleted: string[];
} {
  try {
    const output = execSync('git diff --cached --name-status', { encoding: 'utf-8' });
    const lines = output.trim().split('\n');

    const result = { added: [], modified: [], deleted: [] };

    lines.forEach(line => {
      const [status, file] = line.split('\t');
      if (status === 'A') result.added.push(file);
      else if (status === 'M') result.modified.push(file);
      else if (status === 'D') result.deleted.push(file);
    });

    return result;
  } catch {
    return { added: [], modified: [], deleted: [] };
  }
}

/**
 * Categorize the type of change based on files modified
 */
function categorizeChange(files: string[]): {
  type: ProcessLogEntry['type'];
  component: string;
} {
  const hasBackend = files.some(f => f.startsWith('backend/'));
  const hasFrontend = files.some(f => f.startsWith('frontend/'));
  const hasDoc = files.some(f => f.includes('.md') || f.includes('README'));

  let component = hasFrontend && hasBackend ? 'Both' : hasFrontend ? 'Frontend' : 'Backend';

  // Determine type based on file patterns
  let type: ProcessLogEntry['type'] = 'Chore';
  const allFiles = files.join(' ').toLowerCase();

  if (hasDoc || allFiles.includes('readme') || allFiles.includes('license')) {
    type = 'Documentation';
  } else if (
    allFiles.includes('fix') ||
    allFiles.includes('bug') ||
    allFiles.includes('patch')
  ) {
    type = 'Fix';
  } else if (
    allFiles.includes('feature') ||
    allFiles.includes('new') ||
    allFiles.includes('add')
  ) {
    type = 'Feature';
  } else if (
    allFiles.includes('refactor') ||
    allFiles.includes('rewrite') ||
    allFiles.includes('cleanup')
  ) {
    type = 'Refactor';
  } else if (allFiles.includes('enhance') || allFiles.includes('improve')) {
    type = 'Enhancement';
  }

  return { type, component };
}

/**
 * Generate ISO timestamp
 */
function getTimestamp(): string {
  const now = new Date();
  const offset = -now.getTimezoneOffset();
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}`
  );
}

/**
 * Format file paths for logging
 */
function formatFilePaths(files: string[]): string {
  if (files.length === 0) return 'N/A';
  if (files.length <= 3) return files.map(f => `\`${f}\``).join(', ');
  return `${files.slice(0, 3).map(f => `\`${f}\``).join(', ')} +${files.length - 3} more`;
}

/**
 * Update the process log file
 */
export function updateProcessLog(entry: Partial<ProcessLogEntry>): void {
  try {
    if (!fs.existsSync(PROCESS_LOG_PATH)) {
      console.warn('⚠️  PROCESS_LOG.md not found. Skipping update.');
      return;
    }

    const currentLog = fs.readFileSync(PROCESS_LOG_PATH, 'utf-8');
    const timestamp = getTimestamp();
    const componentStr = entry.component || 'General';
    const typeStr = entry.type || 'Chore';
    const filesStr = formatFilePaths(entry.files || []);
    const description = entry.description || 'Project modification';

    // Find the insert point (after the "Log Entries" header, before any existing entries)
    const insertPoint = currentLog.indexOf('---\n\n## Log Entries\n\n') +
                       '---\n\n## Log Entries\n\n'.length;

    const newEntry = `### ${timestamp}
- **Type**: ${typeStr}
- **Component**: ${componentStr}
- **Files**: ${filesStr}
- **Description**: ${description}

`;

    const updatedLog =
      currentLog.slice(0, insertPoint) +
      newEntry +
      currentLog.slice(insertPoint);

    fs.writeFileSync(PROCESS_LOG_PATH, updatedLog, 'utf-8');
    console.log(`✅ Process log updated: ${typeStr} in ${componentStr}`);
  } catch (error) {
    console.error('❌ Error updating process log:', error);
  }
}

/**
 * Main hook execution
 */
export function executeHook(): void {
  const changed = getChangedFiles();
  const allChanged = [...changed.added, ...changed.modified, ...changed.deleted];

  if (allChanged.length === 0) {
    console.log('ℹ️  No changes to log');
    return;
  }

  const { type, component } = categorizeChange(allChanged);

  updateProcessLog({
    type,
    component,
    files: allChanged,
    description: `${changed.added.length ? 'Added' : ''} ${changed.modified.length ? 'Modified' : ''} ${changed.deleted.length ? 'Deleted' : ''} files`.trim(),
  });
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  executeHook();
}
