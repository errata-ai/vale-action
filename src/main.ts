import * as core from '@actions/core';
import * as github from '@actions/github';

import * as path from 'path';
import * as tmp from 'tmp';

import execa = require('execa');

import {CheckRunner} from './check';
import * as input from './input';

/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const {GITHUB_TOKEN, GITHUB_WORKSPACE} = process.env;

export async function run(actionInput: input.Input): Promise<void> {
  const alertResp = await execa('vale', actionInput.args);
  core.info(alertResp.stdout);

  const matchersPath = path.join(__dirname, '..', '.github');
  core.info(`##[add-matcher]${path.join(matchersPath, 'vale.json')}`);
}

async function main(): Promise<void> {
  try {
    const userToken = GITHUB_TOKEN as string;
    const workspace = GITHUB_WORKSPACE as string;

    const tmpobj = tmp.fileSync({postfix: '.ini', dir: workspace});
    const actionInput = await input.get(tmpobj, userToken, workspace);

    await run(actionInput);

    tmpobj.removeCallback();
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
