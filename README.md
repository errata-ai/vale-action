# GitHub Actions + Vale

> :octocat: The official GitHub Action for Vale -- install, manage, and run Vale with ease.

<p align="center">
  <img width="50%" alt="A demo screenshot." src="https://user-images.githubusercontent.com/8785025/85236358-272d3680-b3d2-11ea-8793-0f45cb70189a.png">
</p>

## Usage

Add the following (or similar) to one of your [`.github/workflows`](https://help.github.com/en/github/automating-your-workflow-with-github-actions/configuring-a-workflow) files:

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
      uses: errata-ai/vale-action@v1.2.0
      with:
        # Optional
        styles: |
          https://github.com/errata-ai/Microsoft/releases/latest/download/Microsoft.zip
          https://github.com/errata-ai/write-good/releases/latest/download/write-good.zip

        # Optional
        config: https://raw.githubusercontent.com/errata-ai/vale/master/.vale.ini

        # Optional
        files: path/to/lint
      env:
        # Required
        GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
```

## Repository Structure

The recommended repository structure makes use of the existing `.github` directory to hold all of our Vale-related resources:

```text
.github
├── styles
│   └── vocab.txt
└── workflows
    └── main.yml
.vale.ini
...
```

Where `styles` represents your [`StylesPath`](https://errata-ai.github.io/vale/styles/). The top-level `.vale.ini` file should reference this directory:

```ini
StylesPath = .github/styles
MinAlertLevel = suggestion

[*.md]
BasedOnStyles = Vale
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
