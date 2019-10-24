import * as core from '@actions/core';
import * as exec from '@actions/exec';

import * as fs from 'fs';
import * as path from 'path';
import * as request from 'request-promise-native';

/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const {
  GITHUB_TOKEN,
  GITHUB_WORKSPACE
} = process.env;


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
  token: string,
  workspace: string,
  version: string,
  args: string[]
}

/**
 * Parse our user input and set up our Vale environment.
 */
export async function get(tmp: any): Promise<Input> {
  // Add Vale, as copied in Docker, to the `$PATH` for later use:
  //
  // NOTE: This *should* be done already by the container `jdkato/vale`.
  core.addPath('/bin');

  const userToken = GITHUB_TOKEN as string;
  const workspace = GITHUB_WORKSPACE as string;

  // Get the current version of Vale:
  let version = '';
  await exec.exec('vale', ['-v'], {
    listeners: {
      stdout: (buffer: Buffer) => version = buffer.toString().trim(),
    }
  });
  version = version.split(' ').slice(-1)[0];

  // Install our user-specified styles:
  const styles = core.getInput('styles').split(' ');
  for (const style of styles) {
    if (style !== '') {
      const name = style.split('/').slice(-1)[0].split('.zip')[0];
      core.info(`Installing style '${name}' ...`);
      await exec.exec('vale', ['install', name, style], {
        cwd: workspace,
        silent: true,
        ignoreReturnCode: true
      });
    }
  }

  let args: string[] = ['--no-exit', '--output=JSON'];

  // Check if we were given an external config file:
  const config = core.getInput('config');
  if (config !== '') {
    core.info(`Downloading external config '${config}' ...`);
    await request.get(config)
        .catch((error) => {
          core.warning(`Failed to fetch remote config: ${error}.`);
        })
        .then((body) => {
          try {
            fs.writeFileSync(tmp.name, body);
            core.info(`Successfully fetched remote config.`);
            args.push('--mode-rev-compat');
            args.push(`--config=${tmp.name}`);
          } catch (e) {
            core.warning(`Failed to write config: ${e}.`);
          }
        });
  }

  // Figure out what we're supposed to lint:
  const files = core.getInput('files');
  if (files == 'all') {
    args.push('.');
  } else if (fs.existsSync(path.resolve(workspace, files))) {
      args.push(files)
  } else {
    core.warning(
      `User-specified path (${files}) doesn't exist; falling back to 'all'.`)
    args.push('.');
  }

  core.info(`Vale set-up comeplete; using '${args}'.`);
  return {
    token: userToken, workspace: workspace, args: args, version: version
  }
}
