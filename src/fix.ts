import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { Fixer, ValeAlert } from './rdjson';

/** Vale's answer to `vale fix`. */
interface Solution {
  suggestions: string[];
  error: string;
}

/**
 * The flags that decide which configuration `vale fix` answers from.
 *
 * `fix` loads the project's configuration like every other subcommand does,
 * so it has to be pointed at the same one we linted with.
 */
const CONFIG_FLAGS = ['--config', '--no-global'];

/**
 * `createFixer` asks Vale how to resolve an alert -- the same `vale fix` call
 * that powers the language server's quick fixes.
 *
 * Every lookup costs a process, so we cache by what Vale actually looks at:
 * the rule, its action, and the text the action applies to. Caching the
 * pending call rather than its result also collapses the duplicates that a
 * repeated misspelling would otherwise fan out into.
 */
export function createFixer(
  exePath: string,
  cwd: string,
  flags: string[]
): Fixer {
  const config = configFlags(flags);
  const cache = new Map<string, Promise<string[]>>();

  return (alert: ValeAlert): Promise<string[]> => {
    const key = JSON.stringify([alert.Check, alert.Action, alert.Match]);

    let pending = cache.get(key);
    if (pending === undefined) {
      pending = fix(exePath, cwd, config, alert);
      cache.set(key, pending);
    }

    return pending;
  };
}

/**
 * `configFlags` picks the user's flags that `fix` needs to see too.
 */
export function configFlags(flags: string[]): string[] {
  const kept: string[] = [];

  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i];
    const name = flag.split('=')[0];

    if (!CONFIG_FLAGS.includes(name)) {
      continue;
    }
    kept.push(flag);

    // `--config path` is as valid as `--config=path`.
    if (name === '--config' && !flag.includes('=') && i + 1 < flags.length) {
      kept.push(flags[++i]);
    }
  }

  return kept;
}

async function fix(
  exePath: string,
  cwd: string,
  config: string[],
  alert: ValeAlert
): Promise<string[]> {
  const args = [...config, 'fix', JSON.stringify(alert)];

  const output = await exec.getExecOutput(exePath, args, {
    cwd,
    silent: true,
    ignoreReturnCode: true
  });

  if (output.exitCode !== 0) {
    // An alert we can't fix isn't worth failing the run over.
    core.debug(`Unable to fix '${alert.Check}': ${output.stderr.trim()}`);
    return [];
  }

  try {
    const solution: Solution = JSON.parse(output.stdout);
    if (solution.error) {
      core.debug(`Unable to fix '${alert.Check}': ${solution.error}`);
      return [];
    }
    return solution.suggestions || [];
  } catch (error) {
    core.debug(`Unable to read Vale's fix for '${alert.Check}': ${error}`);
    return [];
  }
}
