import * as core from '@actions/core';
import * as github from '@actions/github';
import {wasLineAddedInPR} from './git';

const pkg = require('../package.json');
const USER_AGENT = `${pkg.name}/${pkg.version} (${pkg.bugs.url})`;

type ChecksCreateParamsOutputAnnotations = any;
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

interface Stats {
  suggestions: number;
  warnings: number;
  errors: number;
}

interface CheckOptions {
  token: string;
  owner: string;
  repo: string;
  name: string;
  head_sha: string;
  started_at: string; // ISO8601
  context: {
    vale: string;
  };
}

const onlyAnnotateModifiedLines =
  core.getInput('onlyAnnotateModifiedLines') != 'false';

/**
 * CheckRunner handles all communication with GitHub's Check API.
 *
 * See https://developer.github.com/v3/checks.
 */
export class CheckRunner {
  private annotations: Array<ChecksCreateParamsOutputAnnotations>;
  private stats: Stats;

  constructor() {
    this.annotations = [];
    this.stats = {
      suggestions: 0,
      warnings: 0,
      errors: 0
    };
  }

  /**
   * Convert Vale's JSON `output` into an array of annotations.
   */
  public makeAnnotations(output: string): void {
    const alerts = JSON.parse(output) as ValeJSON;
    for (const filename of Object.getOwnPropertyNames(alerts)) {
      for (const alert of alerts[filename]) {
        if (
          onlyAnnotateModifiedLines &&
          !wasLineAddedInPR(filename, alert.Line)
        ) {
          continue;
        }
        switch (alert.Severity) {
          case 'suggestion':
            this.stats.suggestions += 1;
            break;
          case 'warning':
            this.stats.warnings += 1;
            break;
          case 'error':
            this.stats.errors += 1;
            break;
          default:
            break;
        }
        this.annotations.push(CheckRunner.makeAnnotation(filename, alert));
      }
    }
  }

  /**
   * Show the results of running Vale.
   *
   * NOTE: Support for annotation is still a WIP:
   *
   * - https://github.com/actions/toolkit/issues/186
   * - https://github.com/actions-rs/clippy-check/issues/2
   */
  public async executeCheck(options: CheckOptions): Promise<void> {
    core.info(`Vale: ${this.getSummary()}`);

    const client = github.getOctokit(options.token, {
      userAgent: USER_AGENT
    });

    let checkRunId: number;
    try {
      checkRunId = await this.createCheck(client, options);
    } catch (error) {
      // NOTE: `GITHUB_HEAD_REF` is set only for forked repos.
      if (process.env.GITHUB_HEAD_REF) {
        core.warning(
          `Unable to create annotations; printing Vale alerts instead.`
        );
        this.dumpToStdout();
        if (this.getConclusion() == 'failure') {
          throw new Error('Exiting due to Vale errors');
        }
        return;
      } else {
        throw error;
      }
    }

    try {
      if (this.isSuccessCheck()) {
        // We don't have any alerts to report ...
        await this.successCheck(client, checkRunId, options);
      } else {
        // Vale found some alerts to report ...
        await this.runUpdateCheck(client, checkRunId, options);
      }
    } catch (error) {
      await this.cancelCheck(client, checkRunId, options);
      throw error;
    }
  }

  /**
   * Create our initial check run.
   *
   * See https://developer.github.com/v3/checks/runs/#create-a-check-run.
   */
  private async createCheck(
    client: any,
    options: CheckOptions
  ): Promise<number> {
    const response = await client.checks.create({
      owner: options.owner,
      repo: options.repo,
      name: options.name,
      head_sha: options.head_sha,
      status: 'in_progress'
    });
    if (response.status != 201) {
      core.warning(`[createCheck] Unexpected status code ${response.status}`);
    }
    return response.data.id;
  }

  /**
   * End our check run.
   *
   * NOTE: The Checks API only allows 50 annotations per request, so we send
   * multiple "buckets" if we have more than 50.
   */
  private async runUpdateCheck(
    client: any,
    checkRunId: number,
    options: CheckOptions
  ): Promise<void> {
    let annotations = this.getBucket();

    while (annotations.length > 0) {
      let req: any = {
        owner: options.owner,
        repo: options.repo,
        name: options.name,
        check_run_id: checkRunId,
        output: {
          title: options.name,
          summary: this.getSummary(),
          text: this.getText(options.context),
          annotations: annotations
        }
      };

      if (this.annotations.length > 0) {
        // There will be more annotations later ...
        req.status = 'in_progress';
      } else {
        req.status = 'completed';
        req.conclusion = this.getConclusion();
        req.completed_at = new Date().toISOString();
      }

      const response = await client.checks.update(req);
      if (response.status != 200) {
        core.warning(`[updateCheck] Unexpected status code ${response.status}`);
      }

      annotations = this.getBucket();
    }

    return;
  }

  /**
   * Indicate that no alerts were found.
   */
  private async successCheck(
    client: any,
    checkRunId: number,
    options: CheckOptions
  ): Promise<void> {
    let req: any = {
      owner: options.owner,
      repo: options.repo,
      name: options.name,
      check_run_id: checkRunId,
      status: 'completed',
      conclusion: this.getConclusion(),
      completed_at: new Date().toISOString(),
      output: {
        title: options.name,
        summary: this.getSummary(),
        text: this.getText(options.context)
      }
    };

    const response = await client.checks.update(req);
    if (response.status != 200) {
      core.warning(`[successCheck] Unexpected status code ${response.status}`);
    }

    return;
  }

  /**
   * Something went wrong; cancel the check run and report the exception.
   */
  private async cancelCheck(
    client: any,
    checkRunId: number,
    options: CheckOptions
  ): Promise<void> {
    let req: any = {
      owner: options.owner,
      repo: options.repo,
      name: options.name,
      check_run_id: checkRunId,
      status: 'completed',
      conclusion: 'cancelled',
      completed_at: new Date().toISOString(),
      output: {
        title: options.name,
        summary: 'Unhandled error',
        text:
          'Check was cancelled due to unhandled error. Check the Action logs for details.'
      }
    };

    const response = await client.checks.update(req);
    if (response.status != 200) {
      core.warning(`[cancelCheck] Unexpected status code ${response.status}`);
    }

    return;
  }

  /**
   * Print Vale's output to stdout.
   *
   * NOTE: This should only happen if we can't create annotations (see
   * `executeCheck` above).
   *
   * TODO: Nicer formatting?
   */
  private dumpToStdout() {
    console.dir(this.annotations, {depth: null, colors: true});
  }

  /**
   * Create buckets of at most 50 annotations for the API.
   *
   * See https://developer.github.com/v3/checks/runs/#output-object.
   */
  private getBucket(): Array<ChecksCreateParamsOutputAnnotations> {
    let annotations: Array<ChecksCreateParamsOutputAnnotations> = [];
    while (annotations.length < 50) {
      const annotation = this.annotations.pop();
      if (annotation) {
        annotations.push(annotation);
      } else {
        break;
      }
    }
    core.debug(`Prepared next annotations bucket, ${annotations.length} size`);
    return annotations;
  }

  /**
   * Report a summary of the alerts found by Vale.
   */
  private getSummary(): string {
    const sn = this.stats.suggestions;
    const wn = this.stats.warnings;
    const en = this.stats.errors;
    return `Found ${sn} suggestion(s), ${wn} warning(s), and ${en} error(s).`;
  }

  /**
   * Create a Markdown-formatted summary of the alerts found by Vale.
   */
  private getText(context: CheckOptions['context']): string {
    return `Vale ${context.vale}`;
  }

  /**
   * If Vale found an error-level alerts, we mark the check result as "failure".
   */
  private getConclusion(): string {
    if (this.stats.errors > 0) {
      return 'failure';
    } else {
      return 'success';
    }
  }

  /**
   * No alerts found.
   */
  private isSuccessCheck(): boolean {
    return (
      this.stats.suggestions == 0 &&
      this.stats.warnings == 0 &&
      this.stats.errors == 0
    );
  }

  /**
   * Convert Vale-formatted JSON object into an array of annotations:
   *
   * {
   *   "README.md": [
   *     {
   *       "Check": "DocsStyles.BadWords",
   *       "Description": "",
   *       "Line": 6,
   *       "Link": "",
   *       "Message": "'slave' should be changed",
   *       "Severity": "error",
   *       "Span": [
   *         22,
   *         26
   *       ],
   *       "Hide": false,
   *       "Match": "slave"
   *     }
   *   ]
   * }
   *
   * See https://developer.github.com/v3/checks/runs/#annotations-object.
   */
  static makeAnnotation(
    name: string,
    alert: Alert
  ): ChecksCreateParamsOutputAnnotations {
    let annotation_level: ChecksCreateParamsOutputAnnotations['annotation_level'];

    switch (alert.Severity) {
      case 'suggestion':
        annotation_level = 'notice';
        break;
      case 'warning':
        annotation_level = 'warning';
        break;
      default:
        annotation_level = 'failure';
        break;
    }

    let annotation: ChecksCreateParamsOutputAnnotations = {
      path: name,
      start_line: alert.Line,
      end_line: alert.Line,
      start_column: alert.Span[0],
      end_column: alert.Span[1] == 0 ? alert.Span[0] : alert.Span[1],
      annotation_level: annotation_level,
      title: `[${alert.Severity}] ${alert.Check}`,
      message: alert.Message
    };

    return annotation;
  }
}
