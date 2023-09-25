import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import fetch from 'node-fetch';
import path from 'path';

const releases = 'https://github.com/errata-ai/vale/releases/download';
const last = 'https://github.com/errata-ai/vale/releases/latest/';

export async function installLint(version: string): Promise<string> {
  core.info(`Installing Vale version '${version}' ...`);
  if (version === 'latest') {
    const response = await fetch(last);
    const vs = response.url;
    const parts = vs.split(`/`);
    version = parts[parts.length - 1].substring(1);
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

export async function installReviewDog(version: string): Promise<string> {
  core.info(`Installing ReviewDog version '${version}' ...`);
  
  const url = `https://github.com/reviewdog/reviewdog/releases/download/v${version}/reviewdog_${version}_Linux_x86_64.tar.gz`;
  const archivePath = await tc.downloadTool(url);

  let extractedDir = '';

  const args = ['xz'];
  if (process.platform.toString() != 'darwin') {
    args.push('--overwrite');
  }

  extractedDir = await tc.extractTar(archivePath, process.env.HOME, args);

  const reviewdogPath = path.join(extractedDir, `reviewdog`);
  core.info(`Installed version '${version}' into '${reviewdogPath}'.`);

  return reviewdogPath;
}
