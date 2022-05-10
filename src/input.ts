import * as core from '@actions/core';
import * as exec from '@actions/exec';

import * as fs from 'fs';
import * as path from 'path';
import * as request from 'request-promise-native';
import {modifiedFiles, GHFile} from './git';

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
  version: string;
  args: string[];
  files: Record<string, GHFile>;
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
  let modified: Record<string, GHFile> = {};

  // Get the current version of Vale:
  let version = '';
  await exec.exec('vale', ['-v'], {
    silent: true,
    listeners: {
      stdout: (buffer: Buffer) => (version = buffer.toString().trim())
    }
  });

  version = version.split(' ').slice(-1)[0];
  logIfDebug(`Using Vale ${version}`);

  let args: string[] = ['--no-exit', '--output=JSON'];

  // Figure out what we're supposed to lint:
  const files = core.getInput('files');
  if (
    core.getInput('onlyAnnotateModifiedLines') != 'false' ||
    files == '__onlyModified'
  ) {
    let payload = await modifiedFiles();

    let names = new Set<string>();
    payload.forEach(file => {
      if (fs.existsSync(file.name)) {
        names.add(file.name);
        modified[file.name] = file;
      }
    });
    // add empty file is there is no file to lint
    // else execa will wait forever as --no-exit flag is given
    // and there is no argument given
    if (names.size === 0) {
      names.add('{}');
    }
    args = args.concat(Array.from(names));
  } else if (files == 'all') {
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

  logIfDebug(`Vale set-up comeplete; using '${args}'.`);

  return {
    token: tok,
    workspace: dir,
    args: args,
    version: version,
    files: modified
  };
}
