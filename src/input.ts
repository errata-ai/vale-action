import * as core from '@actions/core';
import * as exec from '@actions/exec';

import * as fs from 'fs';
import path from 'path';

import {installLint, installTool} from './install';

const rd = 'https://github.com/reviewdog/reviewdog/releases/download/v0.14.1/reviewdog_0.14.1_Linux_x86_64.tar.gz';

export function parse(flags: string): string[] {
    flags = flags.trim();
    if (flags === "") {
      return [];
    }

    // TODO: need to simulate bash?
    return flags.split(/\s+/);
  }

/**
 * Our expected input.
 *
 * @token is automatically created; see https://bit.ly/336fZSk.
 *
 * @workspace is the directory that Vale is run within.
 *
 * @args are Vale's run-time arguments.
 */
export interface Input {
  token: string;
  workspace: string;
  exePath: string;
  reviewdog: string;
  args: string[];
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
  //const reviewdog = await installTool('reviewdog', rd);
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

  const parsedFlags = parse(valeFlags);
  const userArgNames = new Set<string>(
    valeFlags
      .trim()
      .split(/\s+/)
      .map((arg) => arg.split(`=`)[0])
      .filter((arg) => arg.startsWith(`-`))
      .map((arg) => arg.replace(/^-+/, ``))
  )

  if (userArgNames.has(`output`)) {
    throw new Error(`please, don't change the --output style.`)
  }

  let stderr = '';
  let resp = await exec.exec(localVale, [...parsedFlags, 'sync'], {
    cwd: dir,
    listeners: {
      stderr: (data: Buffer) => {
        stderr += data.toString();
      }
    }
  });

  if (resp !== 0) {
    core.setFailed(stderr);
  }

  let args: string[] = [
    `--no-wrap`,
    //`--output=${path.resolve(__dirname, 'rdjsonl.tmpl')}`,
    ...parsedFlags,
  ];

  // Figure out what we're supposed to lint:
  const files = core.getInput('files');

  if (files == 'all') {
    args.push('.');
  } else if (fs.existsSync(path.resolve(dir, files))) {
    args.push(files);
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

  logIfDebug(`Vale set-up complete; using '${args}'.`);

  return {
    token: tok,
    workspace: dir,
    exePath: localVale,
    reviewdog: path.resolve(__dirname, 'reviewdog'),
    args: args
  };
}
