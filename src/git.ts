import * as github from '@actions/github';
import * as core from '@actions/core';

const API = github.getOctokit(process.env.GITHUB_TOKEN as string);
const CTX = github.context;

const cache: Record<string, undefined | number[]> = {};

export interface GHFile {
  name: string;
  patch: string;
  sha: string;
}

export function wasLineAddedInPR(file: GHFile, line: number): boolean {
  let lines: number[] = [];

  const key = file.name + file.sha;
  if (key in cache) {
    lines = cache[key] as number[];
  } else {
    lines = parsePatch(file.patch);
    cache[key] = lines;
  }

  return lines.includes(line);
}

export async function modifiedFiles(): Promise<GHFile[]> {
  let files: GHFile[] = [];
  let commits: string[] = await getCommits();

  if (CTX.payload.repository) {
    const repo = CTX.payload.repository;
    const name = repo.owner.login || repo.owner.name;

    await Promise.all(
      commits.map(async commit => {
        const resp = await API.repos.getCommit({
          owner: name!,
          repo: repo.name,
          ref: commit
        });

        resp.data.files.forEach(file => {
          if (file.status == 'modified' || file.status == 'added') {
            let entry: GHFile = {
              name: file.filename,
              patch: file.patch,
              sha: commit
            };
            files.push(entry);
          }
        });
      })
    );
  } else {
    core.error('Repo not set');
  }

  return files;
}

async function getCommits(): Promise<string[]> {
  let commits: string[] = [];

  switch (CTX.eventName) {
    case 'pull_request':
      if (CTX.payload.pull_request && CTX.payload.repository) {
        const url = CTX.payload.pull_request.commits_url;
        const repo = CTX.payload.repository;

        const resp = await API.request(`GET ${url}`, {
          owner: repo.owner.login || repo.owner.name,
          repo: repo.name
        });

        resp.data.forEach((commit: {sha: string}) => {
          commits.push(commit.sha);
        });
      } else {
        core.warning(`Unable to retrieve PR info.`);
        core.warning(
          `PR: ${CTX.payload.pull_request}, Repo: ${CTX.payload.repository}`
        );
      }
      break;
    case 'push':
      CTX.payload.commits.forEach((commit: {id: string}) => {
        commits.push(commit.id);
      });
      break;
    default:
      if (process.env.OVERRIDE_PR_NUMBER) {
        const resp = await API.request(
          'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits',
          {
            owner: CTX.repo.owner,
            repo: CTX.repo.repo,
            pull_number: process.env.OVERRIDE_PR_NUMBER
          }
        );

        resp.data.forEach((commit: {sha: string}) => {
          commits.push(commit.sha);
        });
      } else {
        core.warning(`Unrecognized event: ${CTX.eventName}`);
      }
  }

  return commits;
}

export function parsePatch(patch: string): number[] {
  let lines: number[] = [];
  let start: number = 0;

  let position: number = 0;
  patch.split(/(?:\r\n|\r|\n)/g).forEach(line => {
    if (line.startsWith('@@')) {
      const added = line.split(' ')[2].split(',')[0];
      start = parseInt(added, 10);
    } else if (line.startsWith('+')) {
      lines.push(start + position);
    }
    if (!line.startsWith('-') && !line.startsWith('@@')) {
      position++;
    }
  });

  return lines;
}
