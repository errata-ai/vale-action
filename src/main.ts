import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';

import * as tmp from 'tmp';

import {CheckRunner} from './check';
import * as input from './input';

export async function run(actionInput: input.Input): Promise<void> {
  const startedAt = new Date().toISOString();

  let output = '';
  await exec.exec('vale', actionInput.args, {
    silent: true,
    cwd: actionInput.workspace,
    listeners: {
      stdout: (buffer: Buffer) => output = buffer.toString().trim(),
    }
  });
  let runner = new CheckRunner();

  runner.makeAnnotations(output);
  await runner.executeCheck({
    token: actionInput.token,
    name: 'Vale',
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    head_sha: github.context.sha,
    started_at: startedAt,
    context: {
      // TODO: get as `actionInput`
      vale: 'v2.0.0'
    }
  });
}

async function main(): Promise<void> {
  try {
    const tmpobj = tmp.fileSync({postfix: '.ini'});

    const actionInput = await input.get(tmpobj);
    await run(actionInput);

    tmpobj.removeCallback();
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
