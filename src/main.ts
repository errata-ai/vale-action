import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { issueCommand } from "@actions/core/lib/command"

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
    const matcherFile = path.resolve(__dirname, "vale.json");

    issueCommand("add-matcher", {}, matcherFile);

    const code = await exec.exec(
        actionInput.exePath,
        actionInput.args,
        {
          cwd,
          ignoreReturnCode: true
        }
    );

    issueCommand("remove-matcher", {owner: "vale"}, "");
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
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error);
    } else {
      core.setFailed(`${error}`);
    }
  }
}

main();
