import * as github from '@actions/github';
import * as core from '@actions/core';

const execa = require('execa');

type GitRef = string;
const cache: Record<string, undefined | number[]> = {};

export function wasLineAddedInPR(filename: string, line: number) {
  const fromSHA: GitRef | undefined =
    github.context.payload?.pull_request?.base?.sha;
  // default to return true when not in the context of a PR.
  if (!fromSHA) return true;

  const lines: number[] =
    cache[filename + fromSHA] || addedLines(filename, fromSHA);
  cache[filename + fromSHA] = lines;
  return lines.includes(line);
}

export function modifiedFilesInPR() {
  ensureGitHistory();
  const fromSHA: GitRef | undefined =
    github.context.payload?.pull_request?.base?.sha;

  return execa
    .commandSync(`git diff --name-only ${fromSHA}`)
    .stdout.toString()
    .split('\n');
}

function addedLines(filename: string, fromSHA: GitRef): number[] {
  try {
    ensureGitHistory();
    return (
      execa
        // unified=0 => no context around changed lines.
        .commandSync(`git diff --unified=0 ${fromSHA} ${filename}`)
        .stdout.toString()
        .split(/(?:\r\n|\r|\n)/g)
        // compute the lines that have been added. e.g: `[1, 42]`.
        .reduce((acc: number[], line: string) => {
          // lines starting with @@ mark a hunk. the format is like this:
          // @@ -(start of removals),(number of removed lines) +(start of insertions),(number of insertions)
          // here are some examples:
          // @@ -33,0 +42,24 @@ => removes nothing and inserts 24 lines starting at line 42
          // @@ -8 +6 @@        => removes line 8 and adds line 6. if there's no comma it's a single-line change.
          if (!line.startsWith('@@')) return acc;

          // get the `+` portion, as only additions are relevant in order to filter annotations for portions that are changed.
          // afterwards split by `,` (no `,` means a single line addition).
          const [start, numberOfAddedLines = 1] = line.split(' ')[2].split(',');

          const startInt = parseInt(start, 10);
          for (let i = 0; i < numberOfAddedLines; i++) {
            acc.push(startInt + i);
          }
          return acc;
        }, [])
    );
  } catch (e) {
    core.error(`Failed to diff ${filename}. ${e.stderr}`);
    return [];
  }
}

let isHhistoryLoaded = false;
// make sure we have some history. when using e.g. actions/checkout with its
// default of `fetch-depth: 1`, we just fetch the commit we're currently looking
// at. but we want to diff against the base-commit of the PR we're looking at.
// maybe this could be optimized to fetch exactly that commit.
function ensureGitHistory() {
  if (isHhistoryLoaded) return;
  execa.commandSync('git fetch --unshallow');
  execa.commandSync(
    'git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"'
  );
  execa.commandSync('git fetch origin');
  isHhistoryLoaded = true;
}
