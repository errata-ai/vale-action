import * as exec from '@actions/exec';

async function main(): Promise<void> {
  await exec.exec('pip', ['install', 'docutils']);
  await exec.exec('gem', ['install', 'asciidoctor', '--user-install']);
}

main();