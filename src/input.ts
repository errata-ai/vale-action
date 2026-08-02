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
 * @flags are the user's `vale_flags`, which we also need on their own to ask
 * Vale about individual alerts.
 */
export interface Input {
  token: string;
  workspace: string;
  exePath: string;
  reviewdogPath: string;
  args: string[];
  flags: string[];
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
 * Parse our user input and set up our Vale environment.
 */
export async function get(tok: string, dir: string): Promise<Input> {
  const localVale = await installLint(core.getInput('version'));
  const localReviewDog = await installReviewDog("0.17.0", core.getInput('reviewdog_url'));
  const valeFlags = core.getInput("vale_flags");

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
    let resp = await exec.exec(localVale, [...parse(valeFlags), 'sync'], {
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
  const flags = parse(valeFlags);
  let args: string[] = ['--output=JSON', ...flags];

  // Figure out what we're supposed to lint:
  const files = core.getInput('files');
  const delim = core.getInput('separator');

  if (files == 'all') {
    args.push('.');
  } else if (fs.existsSync(path.resolve(dir, files))) {
    args.push(files);
  } else if (delim !== "") {
    args = args.concat(files.split(delim));
  } else {
    try {
      // Support for an array of inputs.
      //
      // e.g., '[".github/workflows/main.yml"]'
      args = args.concat(JSON.parse(files));
    } catch (e) {
      core.warning(
        `User-specified path (${files}) is invalid; falling back to 'all'.`
      );
      args.push('.');
    }
  }

  logIfDebug(`Vale set-up complete; using '${args}' with ${localReviewDog}.`);

  return {
    token: tok,
    workspace: dir,
    exePath: localVale,
    args: args,
    flags: flags,
    reviewdogPath: localReviewDog,
  };
}
