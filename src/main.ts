import * as core from '@actions/core';
import * as exec from '@actions/exec';

import path from 'path';
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
            switch (a.Severity) {
                case 'suggestion':
                    core.info(`::notice file=${filename},line=${a.Line},col=${a.Span[0]}::${a.Message}`)
                    break;
                case 'warning':
                    core.info(`::warning file=${filename},line=${a.Line},col=${a.Span[0]}::${a.Message}`)
                    break;
                default:
                    core.info(`::error file=${filename},line=${a.Line},col=${a.Span[0]}::${a.Message}`)
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
    const matchersPath = path.join(__dirname, 'vale.json');
    //core.info(`##[add-matcher]${matchersPath}`);

    // echo "::error file=app.js,line=10,col=15::$text"

    const alerts = await exec.getExecOutput(
        actionInput.exePath,
        actionInput.args,
        {
          cwd,
          ignoreReturnCode: true
        }
    );
    annotate(alerts.stdout);
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
