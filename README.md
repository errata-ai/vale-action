# GitHub Actions + Vale [**WIP**: NOT AVAILABLE YET.]

> :octocat: The official GitHub Action for Vale -- install, manage, and run Vale with ease.

This GitHub Action executes [Vale](https://github.com/errata-ai/vale) and displays its alerts as annotations in GitHub's "Files changed" UI:

![Screenshot](/img/example.png)

You can see a [live example here]().

## Usage

Add the the following (or similar) to one of your `.github/workflow` files:

```yaml
name: Linting
on: [push]
jobs:
  prose:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout
      uses: actions/checkout@master
    - name: Vale
      uses: errata-ai/vale-action@v1
      env:
        GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
```

## Inputs

You can further customize the linting processing by providing one of the following optional inputs.

### `styles`

`styles` is a space-delimited list of external styles to install into your repository's local `StylesPath`. Each link needs to point to a single `.zip` file containing the style:

```yaml
with:
  styles: |
    https://github.com/errata-ai/Microsoft/releases/latest/download/Microsoft.zip
    https://github.com/errata-ai/write-good/releases/latest/download/write-good.zip
```

See [errata-ai/styles](https://github.com/errata-ai/styles) for more information.

### `config`

`config` is a single, remotely-hosted [Vale configuration file](https://errata-ai.github.io/vale/config/):

```yaml
with:
  config: https://raw.githubusercontent.com/errata-ai/vale/master/.vale.ini
```

This configuration file can be hosted in another repo (as shown above), a GitHub Gist, or another source altogether. If you also have a `.vale.ini` file in the local repo, the two files will be combined according to the following rules:

1. Any multi-value entry in the local `.vale.ini` file (e.g., `BasedOnStyles`) will be combined with the remote entry.
2. Any single-value entry in the local `.vale.ini` file (e.g., `MinAlertLevel`) will override the remote entry altogether.

### `files` (default: `all`)

`files` specifies where Vale will look for files to lint:

```yaml
with:
  files: path/to/lint
```

It accepts values of either `all` (your repo's root directory) or a specific sub-directory (shown above).

## Limitations

Due to the current [token permissions](https://help.github.com/en/articles/virtual-environments-for-github-actions#token-permissions),
this Action **CAN NOT** post annotations to PRs from forked repositories.

This will likely be fixed by [toolkit/issues/186](https://github.com/actions/toolkit/issues/186).


## Examples

That is approximately what happend.

So, is that how it work?
