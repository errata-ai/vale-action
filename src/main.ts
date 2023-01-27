import * as core from '@actions/core';

import path from 'path';
import execa from 'execa';

import * as input from './input';

/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const {GITHUB_TOKEN, GITHUB_WORKSPACE} = process.env;

type Severity = 'suggestion' | 'warning' | 'error';

interface Alert {
    readonly Check: string;
    readonly Line: number;
    readonly Message: string;
    readonly Span: [number, number];
    readonly Severity: Severity;
  }

  interface ValeJSON {
    readonly [propName: string]: ReadonlyArray<Alert>;
  }


function annotate(output: string) {
    const alerts = JSON.parse(output) as ValeJSON;
    for (const filename of Object.getOwnPropertyNames(alerts)) {
        for (const a of alerts[filename]) {
            const annotation = `file=${filename},line=${a.Line},col=${a.Span[0]}::${a.Message}`;
            switch (a.Severity) {
                case 'suggestion':
                    core.info(`::notice ${annotation}`)
                    break;
                case 'warning':
                    core.info(`::warning ${annotation}`)
                    break;
                default:
                    core.info(`::error ${annotation}`)
                    break;
            }
        }
    }
}

export async function run(actionInput: input.Input): Promise<void> {
  const workdir = core.getInput('workdir') || '.';
  const cwd = path.relative(
    process.env['GITHUB_WORKSPACE'] || process.cwd(),
    workdir
  );

  try {
    const {stdout} = await execa(actionInput.exePath, actionInput.args);
    annotate(stdout);
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
            [{data: 'File', header: true}, {data: 'Result', header: true}],
            ['foo.js', 'Pass ✅'],
            ['bar.js', 'Fail ❌'],
            ['test.js', 'Pass ✅']
        ])
        .addLink('View staging deployment!', 'https://github.com')
        .write()

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error);
    } else {
      core.setFailed(`${error}`);
    }
  }
}

main();
