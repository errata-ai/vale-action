import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from 'path';
import * as input from './input';



/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const { GITHUB_WORKSPACE } = process.env;

export async function run(actionInput: input.Input): Promise<void> {
  const workdir = core.getInput('workdir') || '.';
  const cwd = path.relative(
    process.env['GITHUB_WORKSPACE'] || process.cwd(),
    workdir
  );

  try {
    const code = await core.group(
      'Running vale...',
      async (): Promise<number> => {
        // Vale output ...
        const output = await exec.getExecOutput(
          actionInput.exePath,
          actionInput.args,
          {
            cwd,
            ignoreReturnCode: true,
            env: {
              "PATH": `${process.env["PATH"]}:/home/runner/.local/share/gem/ruby/3.0.0/bin`
            }
          }
        );

        const vale_code = output.exitCode;
        'Vale return code: ${vale_code}'
        // Check for fatal runtime errors only (exit code 2)
        // These aren't linting errors, but ones that will come
        // about from missing or bad configuration files, etc.
        if (vale_code === 2) {
          return 2; // Exit the function early
        }

        const should_fail = core.getInput('fail_on_error');

        // Pipe to reviewdog ...
        core.info('Calling reviewdog 🐶');
        process.env['REVIEWDOG_GITHUB_API_TOKEN'] = core.getInput('token');
        return await exec.exec(
          actionInput.reviewdogPath,
          [
            '-f=rdjsonl',
            `-name=vale`,
            `-reporter=${core.getInput('reporter')}`,
            `-fail-on-error=${should_fail}`,
            `-filter-mode=${core.getInput('filter_mode')}`,
            `-level=${vale_code == 1 && should_fail === 'true' ? 'error' : 'info'
            }`
          ],
          {
            cwd,
            input: Buffer.from(output.stdout, 'utf-8'),
            ignoreReturnCode: true
          }
        );
      }
    );

    if (code !== 0) {
      core.setFailed(`Vale and reviewdog exited with status code: ${code}`);
    }
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
    const userToken = core.getInput('token');
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
