import * as core from '@actions/core';
import * as exec from '@actions/exec';

import execa from 'execa';
import * as path from 'path';

import * as input from './input';

/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const {GITHUB_TOKEN, GITHUB_WORKSPACE} = process.env;

export async function run(actionInput: input.Input): Promise<void> {
  const workdir = core.getInput('workdir') || '.';
  const cwd = path.relative(
    process.env['GITHUB_WORKSPACE'] || process.cwd(),
    workdir
  );

  try {
    // Vale output ...
    const alertResp = await execa(actionInput.exePath, actionInput.args, {
      cwd: cwd
    });

    if (core.getInput('debug') == 'true') {
        core.info(alertResp.stdout);
        core.info(alertResp.stderr);
    }

    // Pipe to reviewdog ...
    process.env['REVIEWDOG_GITHUB_API_TOKEN'] = GITHUB_TOKEN;
    await exec.exec(
      '/bin/reviewdog',
      [
        '-f=rdjsonl',
        `-name=vale`,
        `-reporter=${core.getInput('reporter')}`,
        `-fail-on-error=${core.getInput('fail_on_error')}`,
        `-filter-mode=${core.getInput('filter_mode')}`,
        `-level=${core.getInput('level')}`
      ],
      {
        cwd,
        input: Buffer.from(alertResp.stdout, 'utf-8'),
        ignoreReturnCode: true
      }
    );
  } catch (error) {
    core.setFailed(error.stderr);
  }
}

async function main(): Promise<void> {
  try {
    const userToken = GITHUB_TOKEN as string;
    const workspace = GITHUB_WORKSPACE as string;

    const actionInput = await input.get(userToken, workspace);
    await run(actionInput);
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
