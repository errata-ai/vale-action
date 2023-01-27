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
  for (const filename of Object.getOwnPropertyNames(alerts)) {
    for (const a of alerts[filename]) {
      const msg = `[${a.Check}] ${a.Message}`;
      const annotation = `file=${filename},line=${a.Line},col=${a.Span[0]}::${msg}`;
      switch (a.Severity) {
        case 'suggestion':
          core.info(`::notice ${annotation}`);
          break;
        case 'warning':
          core.info(`::warning ${annotation}`);
          break;
        default:
          core.info(`::error ${annotation}`);
          break;
      }
    }
  }

  var chart = fs.readFileSync(path.resolve(__dirname, 'rules.mermaid'));
  await core.summary
    .addHeading('Test Results')
    .addRaw(chart.toString())
    .addTable([
      [
        {data: 'File', header: true},
        {data: 'Result', header: true}
      ],
      ['foo.js', 'Pass ✅'],
      ['bar.js', 'Fail ❌'],
      ['test.js', 'Pass ✅']
    ])
    .addLink('View staging deployment!', 'https://github.com')
    .addCodeBlock(
      `pie title Pets adopted by volunteers
"Dogs" : 386
"Cats" : 85
"Rats" : 15`,
      'mermaid'
    )
    .write();
}
