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
      vale: actionInput.version
    }
  });
}

async function main(): Promise<void> {
  try {
    // TODO: core.info('::add-matcher::vale.json');

    const tmpobj = tmp.fileSync({postfix: '.ini'});
    const actionInput = await input.get(tmpobj);

    await run(actionInput);

    tmpobj.removeCallback();
    // TODO: core.info('::remove-matcher owner=vale::');
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
