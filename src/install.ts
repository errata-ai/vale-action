import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import * as request from 'request-promise-native';
import path from 'path';
import os from 'os';

const releases = 'https://github.com/errata-ai/vale/releases/download';
const last = 'https://github.com/errata-ai/vale/releases/latest/';

export async function installTool(name: string, url: string): Promise<string> {
  let extractedDir = '';

  const archivePath = await tc.downloadTool(url);
  const args = ['xz'];

  if (process.platform.toString() != 'darwin') {
    args.push('--overwrite');
  }
  extractedDir = await tc.extractTar(archivePath, process.env.HOME, args);

  return path.join(extractedDir, name);
}

export async function installVale(version: string): Promise<string> {
  core.info(`Installing Vale version '${version}' ...`);
  if (version === 'latest') {
    await request.get(last, function(e, response) {
      const vs = response.request.uri.href;
      const parts = vs.split(`/`);
      version = parts[parts.length - 1].substring(1);
    });
  }

  let ext = 'tar.gz';

  let platform = os.platform().toString();
  switch (platform) {
    case 'win32':
      platform = 'Windows';
      ext = 'zip';
      break;
    case 'darwin':
      platform = 'macOS';
      break;
    case 'linux':
      platform = 'Linux';
      break;
  }

  let arch = os.arch();
  switch (arch) {
    case 'x64':
      arch = '64-bit';
      break;
  }

  const url =
    releases + `/v${version}/vale_${version}_${platform}_${arch}.${ext}`;

  return installTool('vale', url);
}
