# GitHub Actions + Vale

> :octocat: The official GitHub Action for Vale -- install, manage, and run Vale
> with ease.

<p align="center">
  <img width="50%" alt="A demo screenshot." src="https://user-images.githubusercontent.com/8785025/85236358-272d3680-b3d2-11ea-8793-0f45cb70189a.png">
</p>

## Usage

> [!NOTE]
> If you're using a markup format other than Markdown, you may need to install
> an external parser. For more information, see the [Vale documentation][2].

Add the following (or similar) to one of your [`.github/workflows`][1] files:

```yaml
name: reviewdog
on: [pull_request]

jobs:
  vale:
    name: runner / vale
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: errata-ai/vale-action@v2.1.0
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

Where `styles` represents your [`StylesPath`](https://docs.errata.ai/vale/styles). The top-level `.vale.ini` file should reference this directory:

```ini
StylesPath = .github/styles
MinAlertLevel = suggestion

[*.md]
BasedOnStyles = Vale
```

## Inputs

You can further customize the linting processing by providing one of the following optional inputs.

To add an input, edit your workflow file and add the `with` key to the `uses` block. For example:

```yaml
- uses: errata-ai/vale-action@v2.1.0
  with:
    version: 2.17.0
```

### `version` (default: latest)

> NOTE: The provided version must be `>= 2.16.0`.

Specify the Vale CLI version to use.

```yaml
with:
  version: 2.17.0
```

### `files` (default: all)

`files` specifies where Vale will look for files to lint.

```yaml
with:
  files: path/to/lint
```

You can supply this value one of four ways:

- `files: all` (default): The repo's root directory; equivalent to calling `vale .`.

- `files: path/to/lint`: A single file or directory; equivalent to calling `vale path/to/lint`.

- `files: '["input1", "input2"]'`: A JSON-formatted list of file or directory arguments; equivalent to calling `vale input1 input2`.

- `files: 'input1,input2'`: A character-delimited list of files. The character is determined by the input value `separator`:
    
    ```yaml
    with:
      separator: ","
    ```

### `reporter` (default: github-pr-check)

Set the [reporter](https://github.com/reviewdog/reviewdog#reporters) type.

```yaml
with:
  # github-pr-check, github-pr-review, github-check
  reporter: github-pr-check
```

### `fail_on_error` (default: false)

By default, `reviewdog` will return exit code `0` even if it finds errors. If `fail_on_error` is enabled, `reviewdog` exits with `1` when at least one error
was reported.

```yaml
with:
  fail_on_error: true
```

### `filter_mode` (default: added)

Set the [filter mode](https://github.com/reviewdog/reviewdog#filter-mode) for
`reviewdog`.

```yaml
with:
  # added, diff_context, file, nofilter
  filter_mode: nofilter
```

### `vale_flags` (default: "")

Space-delimited list of flags for the Vale CLI. To see a full list of available flags, run `vale -h`.

Note that flags should not include quotes.
So while `--glob='*.txt'` works with Vale, it does not work with this action.
Use the flag without quotes, as in the following example:

```yaml
with:
  vale_flags: "--glob=*.txt"
```

### `token` (default: [`secrets.GITHUB_TOKEN`](https://docs.github.com/en/actions/security-guides/automatic-token-authentication))

The GitHub token to use.

```yaml
with:
  token: ${{secrets.VALE_GITHUB_TOKEN}}
```

[1]: https://help.github.com/en/github/automating-your-workflow-with-github-actions/configuring-a-workflow
[2]: https://vale.sh/docs/topics/scoping/#formats
