import type { Hooks, Plugin, PluginInput } from '@opencode-ai/plugin';
import { appendFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Guardrails for this project.
 *
 * All three hooks REMIND. They never throw and never block a tool. The rule text
 * stays out of the instruction files and appears at the moment it matters instead.
 *
 * Every fire is appended to `.opencode/_observations/hook-log.md` so you can tell
 * later whether a hook earns its place or is just noise.
 */

const LOG_RELATIVE = '.opencode/_observations/hook-log.md';
const MAP_RELATIVE = '.opencode/repo-map.md';

/** Paths where new markdown is already sanctioned. */
const MARKDOWN_ALLOWLIST: readonly RegExp[] = [
  /^TODO\.md$/,
  /^README\.md$/,
  /^docs\/.+\.md$/,
  /^\.opencode\/.+\.md$/,
  /(^|\/)README\.md$/,
];

/** Commands that discard work irreversibly. */
const DESTRUCTIVE_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\brm\s+(-[a-zA-Z]*[rf][a-zA-Z]*\s+)+/, label: 'rm -rf' },
  { pattern: /\bgit\s+reset\s+--hard\b/, label: 'git reset --hard' },
  { pattern: /\bgit\s+clean\s+-[a-zA-Z]*f/, label: 'git clean -f' },
  { pattern: /\bgit\s+push\b[^\n]*(--force|-f)\b/, label: 'git push --force' },
  { pattern: /\bgit\s+branch\s+-D\b/, label: 'git branch -D' },
];

/** File types that belong in the repo map. Keeps the reminder focused. */
const MAPPED_EXTENSIONS: readonly string[] = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.md',
];

/** Path fragments that never belong in the map. */
const MAPPED_EXCLUDES: readonly RegExp[] = [
  /(^|\/)node_modules\//,
  /(^|\/)\.next\//,
  /(^|\/)dist\//,
  /(^|\/)coverage\//,
  /(^|\/)\.git\//,
];

/**
 * A reminder fires at most once per this window. Without it every single file write
 * would fire, including the writes made while updating the map itself.
 */
const MAP_DEBOUNCE_MS = 5 * 60 * 1000;

function isAllowedMarkdown(relativePath: string): boolean {
  return MARKDOWN_ALLOWLIST.some((rule) => rule.test(relativePath));
}

function isMappable(relativePath: string): boolean {
  if (relativePath.startsWith('.opencode/')) return false;
  if (MAPPED_EXCLUDES.some((rule) => rule.test(relativePath))) return false;
  return MAPPED_EXTENSIONS.some((extension) => relativePath.endsWith(extension));
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function logFire(directory: string, hook: string, detail: string): Promise<void> {
  const target = path.join(directory, LOG_RELATIVE);
  const line = `- ${new Date().toISOString()} | ${hook} | ${detail}\n`;

  try {
    await mkdir(path.dirname(target), { recursive: true });
    if (!(await exists(target))) {
      await appendFile(
        target,
        '# Hook fire log\n\nAppend-only. Signals whether a hook earns its place.\n\n',
      );
    }
    await appendFile(target, line);
  } catch {
    // A failed log write must never affect the session.
  }
}

/** Relative path for a tool argument, or null when it cannot be resolved. */
function relativeTo(directory: string, filePath: unknown): string | null {
  if (typeof filePath !== 'string' || filePath.length === 0) return null;
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(directory, filePath);
  return path.relative(directory, absolute);
}

export const Guardrails: Plugin = async ({ directory, client }: PluginInput): Promise<Hooks> => {
  let lastMapReminder = 0;

  const toast = async (message: string): Promise<void> => {
    try {
      await client.tui.showToast({
        body: { message, variant: 'warning', duration: 6000 },
      });
    } catch {
      // Toasts are best-effort; the log is the durable record.
    }
  };

  return {
    'tool.execute.before': async (input, output) => {
      const args = output.args as Record<string, unknown> | undefined;
      const relative = relativeTo(directory, args?.filePath ?? args?.path);
      const command = args?.command;

      // A new markdown file outside the sanctioned paths.
      if (input.tool === 'write' && relative?.endsWith('.md')) {
        const absolute = path.join(directory, relative);

        if (!isAllowedMarkdown(relative) && !(await exists(absolute))) {
          const message = `New markdown: ${relative}. Ask first unless it was requested.`;
          await toast(message);
          await logFire(directory, 'markdown', relative);
        }
      }

      // A command that discards work permanently.
      if (input.tool === 'bash' && typeof command === 'string') {
        const hit = DESTRUCTIVE_PATTERNS.find(({ pattern }) => pattern.test(command));

        if (hit) {
          const message = `Destructive: ${hit.label}. Confirm the target first.`;
          await toast(message);
          await logFire(directory, 'destructive', `${hit.label} :: ${command.slice(0, 120)}`);
        }
      }
    },

    /**
     * Keeps the repo map honest. A hook cannot judge whether the map is accurate, so
     * this only reports that a mappable file was added or removed. Accuracy stays the
     * author's responsibility.
     */
    'tool.execute.after': async (input) => {
      const args = input.args as Record<string, unknown> | undefined;
      const relative = relativeTo(directory, args?.filePath ?? args?.path);

      if (!relative || !isMappable(relative)) return;
      if (relative === MAP_RELATIVE) return;

      const now = Date.now();
      if (now - lastMapReminder < MAP_DEBOUNCE_MS) return;

      const mapPath = path.join(directory, MAP_RELATIVE);
      if (!(await exists(mapPath))) return;

      const verb = input.tool === 'write' ? 'file' : 'change';
      lastMapReminder = now;

      const message = `Repo map: one ${verb} touches ${relative}. Update .opencode/repo-map.md.`;
      await toast(message);
      await logFire(directory, 'repo-map', relative);
    },
  };
};
