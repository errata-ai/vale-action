# GitHub Actions + Vale

> :octocat: The official GitHub Action for Vale -- install, manage, and run Vale with ease.

<p align="center">
  <img width="50%" alt="A demo screenshot." src="https://user-images.githubusercontent.com/8785025/85236358-272d3680-b3d2-11ea-8793-0f45cb70189a.png">
</p>

## Usage

Add the following (or similar, but you need the `actions/checkout@master` step) to one of your [`.github/workflows`](https://help.github.com/en/github/automating-your-workflow-with-github-actions/configuring-a-workflow) files:

```yaml
name: reviewdog
on: [pull_request]

jobs:
  vale:
    name: runner / vale
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: errata-ai/vale-action@reviewdog
        with:
          # Optional
          files: path/to/lint
        env:
          # Required, set by GitHub actions automatically:
          # https://docs.github.com/en/actions/security-guides/automatic-token-authentication#about-the-github_token-secret
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

```yaml
inputs:
  version:
    description: "The Vale CLI version to install."
    required: false
    default: "latest"

  files:
    description: 'The files to lint: "all" or "<some_folder>".'
    required: false
    default: all

  debug:
    description: "Log debugging information to stdout"
    required: false
    default: "false"

  reporter:
    description: "Reporter of reviewdog command [github-pr-check,github-pr-review,github-check]."
    required: false
    default: "github-pr-check"

  fail_on_error:
    description: |
      Exit code for reviewdog when errors are found [true,false]
      Default is `false`.
    required: false
    default: "false"

  level:
    description: "Report level for reviewdog [info,warning,error]"
    required: false
    default: "error"

  filter_mode:
    description: |
      Filtering for the reviewdog command [added,diff_context,file,nofilter].
      Default is added.
    required: false
    default: "added"
```
