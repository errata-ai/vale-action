import * as core from '@actions/core';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import fetch from 'node-fetch';
import path from 'path';

const releases = 'https://github.com/vale-cli/vale/releases/download';
const last = 'https://github.com/vale-cli/vale/releases/latest/';

/**
 * The platforms Vale publishes a binary for, by Node's own names for them.
 *
 * Anything missing here has no release to download -- Windows on ARM, most
 * notably -- so we say as much instead of asking for a URL that isn't there.
 *
 * See https://github.com/vale-cli/vale/blob/v3/.goreleaser.yml.
 */
const valePlatforms: Record<string, string> = {
  'darwin-arm64': 'macOS_arm64',
  'darwin-x64': 'macOS_64-bit',
  'linux-arm64': 'Linux_arm64',
  'linux-x64': 'Linux_64-bit',
  'win32-x64': 'Windows_64-bit'
};

/**
 * The same, for reviewdog -- which names its platforms differently and ships
 * a tarball for Windows too.
 */
const reviewdogPlatforms: Record<string, string> = {
  'darwin-arm64': 'Darwin_arm64',
  'darwin-x64': 'Darwin_x86_64',
  'linux-arm64': 'Linux_arm64',
  'linux-x64': 'Linux_x86_64',
  'win32-arm64': 'Windows_arm64',
  'win32-x64': 'Windows_x86_64'
};

const isWindows = process.platform === 'win32';

/**
 * `platform` names the runner in the way the given project's releases do.
 */
function platform(tool: string, names: Record<string, string>): string {
  const host = `${process.platform}-${process.arch}`;

  const name = names[host];
  if (name === undefined) {
    throw new Error(`${tool} doesn't publish a binary for '${host}'.`);
  }

  return name;
}

/**
 * `unpack` extracts a downloaded archive and returns the tool within it.
 *
 * We have to be told the format: `downloadTool` saves to a random name, so
 * the path it hands back says nothing about what's inside.
 */
async function unpack(
  archivePath: string,
  name: string,
  format: string
): Promise<string> {
  const extractedDir =
    format === 'zip'
      ? await tc.extractZip(archivePath)
      : await tc.extractTar(archivePath);

  return path.join(extractedDir, isWindows ? `${name}.exe` : name);
}

/**
 * `binary` names a tool as it's spelled on this platform.
 */
function binary(name: string): string {
  return isWindows ? `${name}.exe` : name;
}

/**
 * `cached` is a copy of the tool from a previous run, if the runner kept one.
 *
 * The hosted runners hand out a fresh machine per job, so this only pays off
 * on a self-hosted one -- or when a single job calls the action more than
 * once, as a matrix over several directories does.
 */
function cached(name: string, version: string): string {
  const dir = tc.find(name, version);
  return dir === '' ? '' : path.join(dir, binary(name));
}

async function lookupLint(): Promise<string> {
  // `which` fails loudly, which is what we want here: nothing to find means
  // the user's `version: none` is pointing at an install that isn't there.
  const exePath = await io.which('vale', true);

  core.info(`Using the install at ${exePath}`);
  return exePath;
}

export async function installLint(version: string): Promise<string> {
  if (version === 'none') {
    core.info(`Assuming a version of vale is already available.`);
    return await lookupLint();
  }

  core.info(`Installing Vale version '${version}' ...`);
  if (version === 'latest') {
    const response = await fetch(last);
    const vs = response.url;
    const parts = vs.split(`/`);
    version = parts[parts.length - 1].substring(1);
  }

  // Resolve `latest` first, so that what we look up is a real version rather
  // than a name that means something different tomorrow.
  const hit = cached('vale', version);
  if (hit !== '') {
    core.info(`Using the cached version '${version}' at '${hit}'.`);
    return hit;
  }

  const asset = platform('Vale', valePlatforms);
  const ext = isWindows ? 'zip' : 'tar.gz';

  const url = releases + `/v${version}/vale_${version}_${asset}.${ext}`;
  const archivePath = await tc.downloadTool(url);

  const extracted = await unpack(archivePath, 'vale', ext);
  const dir = await tc.cacheDir(path.dirname(extracted), 'vale', version);

  const lintPath = path.join(dir, binary('vale'));
  core.info(`Installed version '${version}' into '${lintPath}'.`);

  return lintPath;
}

export async function installReviewDog(
  version: string,
  url?: string
): Promise<string> {
  core.info(`Installing ReviewDog version '${version}' ...`);

  // A build we were handed the URL for isn't the version we'd be filing it
  // under, so it doesn't go in the cache.
  const custom = url !== undefined && url !== '';
  if (!custom) {
    const hit = cached('reviewdog', version);
    if (hit !== '') {
      core.info(`Using the cached reviewdog at '${hit}'.`);
      return hit;
    }

    const asset = platform('reviewdog', reviewdogPlatforms);
    url =
      `https://github.com/reviewdog/reviewdog/releases/download/v${version}` +
      `/reviewdog_${version}_${asset}.tar.gz`;
  }

  const archivePath = await tc.downloadTool(url as string);

  const extracted = await unpack(archivePath, 'reviewdog', 'tar.gz');
  const dir = custom
    ? path.dirname(extracted)
    : await tc.cacheDir(path.dirname(extracted), 'reviewdog', version);

  const reviewdogPath = path.join(dir, binary('reviewdog'));
  core.info(`Installed reviewdog from '${url}' into '${reviewdogPath}'.`);

  return reviewdogPath;
}
