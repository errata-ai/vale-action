import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from 'path';
import * as input from './input';
import { createFixer } from './fix';
import { Diagnostic, toDiagnostics, ValeOutput } from './rdjson';

/**
 * The reporters that can act on a suggested fix.
 *
 * Only a review comment can carry one; an annotation has nowhere to put it.
 */
const SUGGESTS = ['github-pr-review'];

/**
 * The reporters that drop a diagnostic's `code`.
 *
 * They log the message and nothing else, so the rule's name has to travel
 * within the message itself.
 */
const NAMES_RULE = ['github-annotations', 'github-pr-annotations'];

/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const { GITHUB_WORKSPACE } = process.env;

/**
 * Where `gem install --user-install` puts its binaries on the Linux runners.
 *
 * Vale shells out to Asciidoctor for AsciiDoc, and a user-installed gem isn't
 * on the PATH we inherit.
 */
const GEM_BIN = '/home/runner/.local/share/gem/ruby/3.0.0/bin';

/**
 * `valeEnv` is our own environment, plus wherever the markup parsers live.
 *
 * It has to be the whole environment: handing `exec` a lone PATH would drop
 * everything Vale reads from it -- `VALE_CONFIG_PATH`, `HOME`, the proxy
 * settings -- and on Windows, enough of the environment to break the process
 * outright.
 */
function valeEnv(): { [key: string]: string } {
  const env = { ...process.env } as { [key: string]: string };

  if (process.platform === 'linux') {
    env['PATH'] = `${env['PATH']}${path.delimiter}${GEM_BIN}`;
  }

  return env;
}

/**
 * `reportLevel` is what reviewdog should make of the alerts we hand it.
 *
 * For the check reporters, this decides the check's own conclusion: `error`
 * fails it, `info` and `warning` leave it neutral.
 *
 * The input went unread for a long time, so an unset one keeps the behavior
 * that grew up around that -- neutral unless Vale itself found errors and the
 * user asked to fail on them.
 */
function reportLevel(valeCode: number, shouldFail: string): string {
  const level = core.getInput('level');
  if (level !== '') {
    return level;
  }
  return valeCode === 1 && shouldFail === 'true' ? 'error' : 'info';
}

/**
 * `convert` turns Vale's JSON into the `rdjsonl` that reviewdog reads.
 *
 * Alerts that Vale knows how to resolve become suggestions -- the same
 * replacements the language server offers as quick fixes -- which reviewers
 * can commit straight from the pull request.
 */
async function convert(
  stdout: string,
  cwd: string,
  reporter: string,
  actionInput: input.Input
): Promise<string> {
  const trimmed = stdout.trim();
  if (trimmed === '') {
    return '';
  }

  let output: ValeOutput;
  try {
    output = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `Unable to read Vale's output: ${trimmed.substring(0, 500)}`
    );
  }

  const suggests = SUGGESTS.includes(reporter);
  if (!suggests) {
    core.debug(`The '${reporter}' reporter can't show suggested fixes.`);
  }

  const diagnostics: Diagnostic[] = await toDiagnostics(output, {
    cwd,
    nameRuleInMessage: NAMES_RULE.includes(reporter),
    fix: suggests
      ? createFixer(actionInput.exePath, cwd, actionInput.flags)
      : undefined
  });

  const fixable = diagnostics.filter(d => d.suggestions).length;
  if (fixable > 0) {
    core.info(
      `Vale suggested a fix for ${fixable} of ${diagnostics.length} alerts.`
    );
  }

  return diagnostics.map((d) => JSON.stringify(d)).join('\n');
}

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
            env: valeEnv()
          }
        );

        const vale_code = output.exitCode;
        core.debug(`Vale return code: ${vale_code}`);

        // Check for fatal runtime errors only (exit code 2)
        // These aren't linting errors, but ones that will come
        // about from missing or bad configuration files, etc.
        //
        // Vale says which on stderr, and that's the only thing that will tell
        // the user what to fix.
        if (vale_code === 2) {
          throw new Error(
            output.stderr.trim() || 'Vale exited with a runtime error.'
          );
        }

        const should_fail = core.getInput('fail_on_error');
        const reporter = core.getInput('reporter');

        const diagnostics = await convert(output.stdout, cwd, reporter, actionInput);

        // Pipe to reviewdog ...
        core.info('Calling reviewdog 🐶');
        process.env['REVIEWDOG_GITHUB_API_TOKEN'] = core.getInput('token');
        return await exec.exec(
          actionInput.reviewdogPath,
          [
            '-f=rdjsonl',
            `-name=vale`,
            `-reporter=${reporter}`,
            `-fail-on-error=${should_fail}`,
            `-filter-mode=${core.getInput('filter_mode')}`,
            `-level=${reportLevel(vale_code, should_fail)}`
          ],
          {
            cwd,
            input: Buffer.from(diagnostics, 'utf-8'),
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
