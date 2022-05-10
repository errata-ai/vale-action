import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import path from 'path';

const releases = 'https://github.com/errata-ai/vale/releases/download';

export async function installLint(version: string): Promise<string> {
  core.info(`Installing Vale ${version} ...`);

  const url = releases + `/v${version}/vale_${version}_Linux_64-bit.tar.gz`;

  const startedAt = Date.now();
  const archivePath = await tc.downloadTool(url);

  let extractedDir = '';
  let repl = /\.tar\.gz$/;

  const args = ['xz'];
  if (process.platform.toString() != 'darwin') {
    args.push('--overwrite');
  }
  extractedDir = await tc.extractTar(archivePath, process.env.HOME, args);

  const urlParts = url.split(`/`);
  const dirName = urlParts[urlParts.length - 1].replace(repl, ``);
  const lintPath = path.join(extractedDir, dirName, `vale`);

  core.info(
    `Installed Vale into ${lintPath} in ${Date.now() - startedAt}ms.`
  );

  return lintPath;
}
