import * as core from '@actions/core';

import path from 'path';
import execa from 'execa';

import * as input from './input';
import * as annotate from './annotate';

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
    // Run Vale on given input ...
    const {stdout} = await execa(actionInput.exePath, actionInput.args, {
      cwd: cwd
    });

    // Create annotations from Vale's JSON ouput ...
    annotate.annotate(stdout);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error);
    } else {
      core.setFailed(`${error}`);
    }
  }
}

async function main(): Promise<void> {
  try {
    const userToken = GITHUB_TOKEN as string;
    const workspace = GITHUB_WORKSPACE as string;

    const actionInput = await input.get(userToken, workspace);
    await run(actionInput);

    await core.summary
      .addHeading('Test Results')
      .addTable([
        [
          {data: 'File', header: true},
          {data: 'Result', header: true}
        ],
        ['foo.js', 'Pass ✅'],
        ['bar.js', 'Fail ❌'],
        ['test.js', 'Pass ✅']
      ])
      .addLink('View staging deployment!', 'https://github.com')
      .write();
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error);
    } else {
      core.setFailed(`${error}`);
    }
  }
}

main();
