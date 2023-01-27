import * as core from '@actions/core';

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

export async function annotate(output: string) {
  const alerts = JSON.parse(output) as ValeJSON;
  for (const filename of Object.getOwnPropertyNames(alerts)) {
    for (const a of alerts[filename]) {
      const annotation = `file=${filename},line=${a.Line},col=${a.Span[0]}::${a.Message}`;
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

  await core.summary
    .addHeading('Test Results')
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
    .write();
}
