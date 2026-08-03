import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import { installLint, installReviewDog } from './install';



/**
 * `parse` splits a line of flags the way a shell would.
 *
 * Quotes group what's inside them, so a Vale 3 filter -- which has spaces and
 * quotes of its own, as in `--filter='.Level == "error"'` -- survives the
 * trip. A backslash is left alone: it's a path separator far more often than
 * an escape in what we're given here.
 */
export function parse(flags: string): string[] {
  const args: string[] = [];

  let arg = '';
  let quote = '';
  let started = false;

  for (const char of flags) {
    if (quote !== '') {
      if (char === quote) {
        quote = '';
      } else {
        arg += char;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) {
        args.push(arg);
        arg = '';
        started = false;
      }
    } else {
      arg += char;
      started = true;
    }
  }

  if (quote !== '') {
    throw new Error(`Unbalanced ${quote} in vale_flags: ${flags}`);
  } else if (started) {
    args.push(arg);
  }

  return args;
}

/**
 * Our expected input.
 *
 * @token is automatically created; see https://bit.ly/336fZSk.
 *
 * @workspace is the directory that Vale is run within.
 *
 * @args are Vale's run-time arguments.
 *
 * @flags are every Vale flag the user asked for, which we also need on their
 * own to ask Vale about individual alerts.
 *
 * @paths are what we were asked to lint. An empty one means the user asked
 * for a list of files and gave us none.
 */
export interface Input {
  token: string;
  workspace: string;
  exePath: string;
  reviewdogPath: string;
  args: string[];
  flags: string[];
  paths: string[];
}

/**
 * Log debugging information to `stdout`.
 *
 * @msg is the message to log.
 */
function logIfDebug(msg: string) {
  const debug = core.getInput('debug') == 'true';
  if (debug) {
    core.info(msg);
  }
}

/**
 * The Vale flags that have an input of their own.
 *
 * All of them are reachable through `vale_flags`, but a filter expression
 * carries quotes that then have to survive a YAML string, and a flag you have
 * to look up isn't one you'll use.
 */
const namedFlags: [string, string][] = [
  ['config', '--config'],
  ['filter', '--filter'],
  ['glob', '--glob'],
  ['min_alert_level', '--minAlertLevel']
];

/**
 * `flagsFromInputs` collects the named flags the user set.
 */
function flagsFromInputs(): string[] {
  const flags: string[] = [];

  for (const [name, flag] of namedFlags) {
    const value = core.getInput(name);
    if (value !== '') {
      flags.push(`${flag}=${value}`);
    }
  }

  return flags;
}

/**
 * Parse our user input and set up our Vale environment.
 */
export async function get(tok: string, dir: string): Promise<Input> {
  const localVale = await installLint(core.getInput('version'));
  const localReviewDog = await installReviewDog(
    core.getInput('reviewdog_version'),
    core.getInput('reviewdog_url')
  );

  // `vale_flags` comes last so that it still has the final say on anything
  // it names twice.
  const flags = [...flagsFromInputs(), ...parse(core.getInput('vale_flags'))];

  let version = '';
  await exec.exec(localVale, ['-v'], {
    silent: true,
    listeners: {
      stdout: (buffer: Buffer) => (version = buffer.toString().trim())
    }
  });
  version = version.split(' ').slice(-1)[0];
  logIfDebug(`Using Vale ${version}`);

  // `sync` re-downloads every package each time it runs, so a user who has
  // restored their `StylesPath` from a cache needs a way to say so.
  if (core.getInput('sync') !== 'false') {
    let stderr = '';
    let resp = await exec.exec(localVale, [...flags, 'sync'], {
      cwd: dir,
      // Report what Vale said rather than the exit code `exec` would throw.
      ignoreReturnCode: true,
      listeners: {
        stderr: (data: Buffer) => {
          stderr += data.toString();
        }
      }
    });

    if (resp !== 0) {
      // Linting against a StylesPath that didn't finish downloading tells the
      // user nothing about their prose, so stop here rather than carry on.
      throw new Error(stderr.trim() || 'Unable to sync the StylesPath.');
    }
  } else {
    logIfDebug('Skipping sync; using the existing StylesPath.');
  }

  // We convert Vale's JSON into reviewdog's format ourselves, rather than
  // having Vale template it directly, so that we can ask Vale how to fix what
  // it found.
  let args: string[] = ['--output=JSON', ...flags];

  // Figure out what we're supposed to lint:
  const files = core.getInput('files');
  const delim = core.getInput('separator');

  let paths: string[] = [];

  if (files.trim() === '') {
    // A step that lists the changed files and finds none leaves us an empty
    // string. That's an answer, not an oversight -- and passing it along as a
    // path has Vale looking for a file with no name.
    paths = [];
  } else if (files == 'all') {
    paths = ['.'];
  } else if (fs.existsSync(path.resolve(dir, files))) {
    paths = [files];
  } else if (delim !== "") {
    paths = files.split(delim);
  } else {
    try {
      // Support for an array of inputs.
      //
      // e.g., '[".github/workflows/main.yml"]'
      paths = JSON.parse(files);
    } catch (e) {
      // A pattern is the likeliest reason to be here: it works from a shell,
      // which expands it before Vale ever sees it, and does nothing as an
      // argument. Vale matches patterns of its own through `--glob`.
      const hint = /[*?[]/.test(files)
        ? ` Use the 'glob' input to match a pattern: glob: '${files}'.`
        : '';

      core.warning(
        `User-specified path (${files}) is invalid; falling back to 'all'.${hint}`
      );
      paths = ['.'];
    }
  }

  // A list can arrive with a trailing separator, or a stray one in the middle.
  paths = paths.map(p => p.trim()).filter(p => p !== '');
  args = args.concat(paths);

  logIfDebug(`Vale set-up complete; using '${args}' with ${localReviewDog}.`);

  return {
    token: tok,
    workspace: dir,
    exePath: localVale,
    args: args,
    flags: flags,
    paths: paths,
    reviewdogPath: localReviewDog,
  };
}
