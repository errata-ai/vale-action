import * as core from '@actions/core';

import fs from 'fs';
import path from 'path';

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

/**
 * Create file annotations from Vale's JSON output.
 *
 * NOTE: There some size limitations (https://rb.gy/lpeyey) which require us to
 * only report the first 50.
 */
export async function annotate(output: string) {
  const alerts = JSON.parse(output) as ValeJSON;

  var alertsMap = new Map();
  var alertTable: string[][] = [];

  var totalAlerts = 0;
  var suggestions = 0;
  var warnings = 0;
  var errors = 0;

  for (const filename of Object.getOwnPropertyNames(alerts)) {
    for (const a of alerts[filename]) {
      totalAlerts += 1;
      if (alertsMap.has(a.Check)) {
        alertsMap.set(a.Check, alertsMap.get(a.Check) + 1);
      } else {
        alertsMap.set(a.Check, 1);
      }
      alertTable.push([filename, a.Check, a.Message]);

      const msg = `[${a.Check}] ${a.Message}`;
      const annotation = `file=${filename},line=${a.Line},col=${a.Span[0]}::${msg}`;

      switch (a.Severity) {
        case 'suggestion':
          core.info(`::notice ${annotation}`);
          suggestions += 1;
          break;
        case 'warning':
          core.info(`::warning ${annotation}`);
          warnings += 1;
          break;
        default:
          core.info(`::error ${annotation}`);
          errors += 1;
          break;
      }
    }
  }

  var chart = 'pie title Annotations by rule';
  for (let [key, value] of alertsMap) {
    chart += `\n"${key}" : ${value}`;
  }

  await core.summary
    .addHeading('Linting Analysis :rocket:')
    .addRaw(
      `**${totalAlerts}** total alerts (${suggestions} suggestions, ${warnings} warnings, and ${errors} errors).`,
      true
    )
    .addHeading('Annotation Breakdown', 2)
    .addCodeBlock(chart, 'mermaid')
    /*.addTable([
      [
        {data: 'File', header: true},
        {data: 'Rule', header: true},
        {data: 'Message', header: true}
      ],
      ...alertTable
    ])*/
    .write();
}
