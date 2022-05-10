import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import * as request from 'request-promise-native';
import path from 'path';

const releases = 'https://github.com/errata-ai/vale/releases/download';
const last = 'https://github.com/errata-ai/vale/releases/latest/';

export async function installLint(version: string): Promise<string> {
  core.info(`Installing Vale version '${version}' ...`);
  if (version === 'latest') {
    await request.get(last, function (e, response) {
        const vs = response.request.uri.href;
        const parts = vs.split(`/`);
        version = parts[parts.length - 1].substring(1);
      })
  }
  const url = releases + `/v${version}/vale_${version}_Linux_64-bit.tar.gz`;
  const archivePath = await tc.downloadTool(url);

  let extractedDir = '';

  const args = ['xz'];
  if (process.platform.toString() != 'darwin') {
    args.push('--overwrite');
  }
  extractedDir = await tc.extractTar(archivePath, process.env.HOME, args);

  const lintPath = path.join(extractedDir, `vale`);
  core.info(`Installed version '${version}' into '${lintPath}'.`);

  return lintPath;
}
