import * as github from '@actions/github';
import {parsePatch} from '../src/git';

describe('Get modified lines from a PR', () => {
  const token = process.env.GITHUB_TOKEN as string;
  const gh = github.getOctokit(token);

  it('should get commits from a PR', async () => {
    let commits: string[] = [];

    // Get the `commits_url` (provided by the action in practice):
    const resp1 = await gh.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      {
        owner: 'vaadin',
        repo: 'docs',
        pull_number: 144
      }
    );

    // Get the commit SHAs:
    const resp2 = await gh.request(`GET ${resp1.data.commits_url}`, {
      owner: 'vaadin',
      repo: 'docs'
    });

    resp2.data.forEach((commit: {sha: string}) => {
      commits.push(commit.sha);
    });

    expect(commits).toEqual([
      '6fbb4e7b5baceb4d6a966ddb5ecdf2bb0349ebb8',
      'a8837d2633b7d881b3cff19465b3b4a73779a816',
      '85d8acaad6153bf4caf216f6bfa2f3d748d5bd24',
      '0c5ad68ca57702671cccd31f64e9438a5e387834',
      '2789506b19bd26106717e70ed609dee1e2e398fb'
    ]);
  });

  it('should get modified lines from a commit', async () => {
    const resp = await gh.repos.getCommit({
      owner: 'vaadin',
      repo: 'docs',
      ref: '6fbb4e7b5baceb4d6a966ddb5ecdf2bb0349ebb8'
    });

    let lines = parsePatch(resp.data.files[0].patch);
    expect(lines).toEqual([15]);

    const resp2 = await gh.repos.getCommit({
      owner: 'vaadin',
      repo: 'docs',
      ref: 'a8837d2633b7d881b3cff19465b3b4a73779a816'
    });

    lines = parsePatch(resp2.data.files[0].patch);
    expect(lines).toEqual([]);

    const resp3 = await gh.repos.getCommit({
      owner: 'vaadin',
      repo: 'docs',
      ref: '85d8acaad6153bf4caf216f6bfa2f3d748d5bd24'
    });
    lines = parsePatch(resp3.data.files[0].patch);
    expect(lines).toEqual([8, 10, 18]);

    const resp4 = await gh.repos.getCommit({
      owner: 'vaadin',
      repo: 'docs',
      ref: '0c5ad68ca57702671cccd31f64e9438a5e387834'
    });

    lines = parsePatch(resp4.data.files[0].patch);
    expect(lines).toEqual([10, 11]);

    lines = parsePatch(resp4.data.files[1].patch);
    expect(lines).toEqual([1, 2, 3, 4]);

    const resp5 = await gh.repos.getCommit({
      owner: 'vaadin',
      repo: 'docs',
      ref: '2789506b19bd26106717e70ed609dee1e2e398fb'
    });

    lines = parsePatch(resp5.data.files[0].patch);
    expect(lines).toEqual([13]);
  });
});
