import * as core from '@actions/core';
import * as github from '@actions/github';

import {CheckRunner} from './check';
import * as input from './input';
import {installLint} from './install';

import execa from 'execa';

/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const {GITHUB_TOKEN, GITHUB_WORKSPACE} = process.env;

export async function run(actionInput: input.Input): Promise<void> {
  try {
    const startedAt = new Date().toISOString();
    const localVale = await installLint(actionInput.version);
    const alertResp = await execa(localVale, actionInput.args);
    core.info(alertResp.stdout);
  } catch (error) {
    if (typeof error === 'string') {
      core.setFailed(error.toUpperCase());
    } else if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

async function main(): Promise<void> {
  try {
    const userToken = GITHUB_TOKEN as string;
    const workspace = GITHUB_WORKSPACE as string;

    const actionInput = await input.get(userToken, workspace);
    await run(actionInput);
  } catch (error) {
    if (typeof error === 'string') {
      core.setFailed(error.toUpperCase());
    } else if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

main();
