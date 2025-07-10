import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import path from 'path';

const releases = 'https://github.com/errata-ai/vale/releases/download';
const last = 'https://github.com/errata-ai/vale/releases/latest/';

enum RunnerOS {
  LINUX = 'Linux',
  MAC = 'macOS',
  WINDOWS = 'Windows'
}

enum RunnerArch {
  X86 = 'X86',
  X64 = 'X64',
  ARM = 'ARM',
  ARM64 = 'ARM64'
}

const os = process.env.RUNNER_OS as RunnerOS;
const arch = process.env.RUNNER_ARCH as RunnerArch;
const system: System = {os, arch};

type System = {
  os: RunnerOS;
  arch: RunnerArch;
};

type SupportedSystem = {
  system: System;
  tools: Tools;
};

type Tools = {
  vale: string;
  reviewdog: string;
};

const supportedSystems: SupportedSystem[] = [
  {
    system: {os: RunnerOS.LINUX, arch: RunnerArch.X64},
    tools: {
      vale: 'Linux_64-bit.tar.gz',
      reviewdog: 'Linux_x86_64.tar.gz'
    }
  },
  {
    system: {os: RunnerOS.LINUX, arch: RunnerArch.ARM64},
    tools: {
      vale: 'Linux_arm64.tar.gz',
      reviewdog: 'Linux_arm64.tar.gz'
    }
  }
];

export function getSupportedSystem(): SupportedSystem {
  for (const supportedSystem of supportedSystems) {
    if (supportedSystem.system.os === system.os && supportedSystem.system.arch === system.arch) {
      return supportedSystem;
    }
  }
  throw new Error(`Unsupported system: ${JSON.stringify(system)}`);
}

async function lookupLint(): Promise<string> {
  let path = '';
  let stderr = '';

  let resp = await exec.exec('which', ['vale'], {
    listeners: {
      stdout: (buffer: Buffer) => (path = buffer.toString().trim()),
      stderr: (data: Buffer) => (stderr += data.toString())
    }
  });

  if (resp !== 0) {
    core.setFailed(stderr);
  }

  core.info(`Using the install at ${path}`)
  return path;
}

export async function installLint(version: string): Promise<string> {
  if (version === 'none') {
    core.info(`Assuming a version of vale is already available.`);
    return await lookupLint();
  }

  const supportedSystem = getSupportedSystem();
  core.info(`Installing Vale version '${version}' ...`);
  if (version === 'latest') {
    const response = await fetch(last);
    const vs = response.url;
    const parts = vs.split(`/`);
    version = parts[parts.length - 1].substring(1);
  }
  const url =
    releases + `/v${version}/vale_${version}_${supportedSystem.tools.vale}`;
  const archivePath = await tc.downloadTool(url);

  let extractedDir = '';

  const args = ['xz'];
  if (os != RunnerOS.MAC) {
    args.push('--overwrite');
  }
  extractedDir = await tc.extractTar(archivePath, process.env.HOME, args);

  const lintPath = path.join(extractedDir, `vale`);
  core.info(`Installed version '${version}' into '${lintPath}'.`);

  return lintPath;
}

export async function installReviewDog(
  version: string,
  url?: string
): Promise<string> {
  const supportedSystem = getSupportedSystem();
  core.info(`Installing ReviewDog version '${version}' ...`);

  if (!url) {
    url = `https://github.com/reviewdog/reviewdog/releases/download/v${version}/reviewdog_${version}_${supportedSystem.tools.reviewdog}`;
  }

  const archivePath = await tc.downloadTool(url);

  let extractedDir = '';

  const args = ['xz'];
  if (os != RunnerOS.MAC) {
    args.push('--overwrite');
  }

  extractedDir = await tc.extractTar(archivePath, process.env.HOME, args);

  const reviewdogPath = path.join(extractedDir, `reviewdog`);

  core.info(`Installed reviewdog from '${url}' into '${reviewdogPath}'.`);
  return reviewdogPath;
}
