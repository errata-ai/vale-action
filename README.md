# GitHub Actions + Vale

> :octocat: The official GitHub Action for Vale -- install, manage, and run Vale
> with ease.

> [!IMPORTANT]
> **This repository has moved to [`vale-cli/vale-action`](https://github.com/vale-cli/vale-action).**
>
> The `errata-ai` organization has been renamed to `vale-cli`. You must update your workflows to continue using the action:
>
> ```diff
> - uses: errata-ai/vale-action@v2
> + uses: vale-cli/vale-action@v3
> ```

> [!WARNING]
> Pinning the `reviewdog` branch (`vale-cli/vale-action@reviewdog`) tracks
> whatever lands there next. Pin `@v3` for this release, or `@v2` to stay on
> the previous one.

<p align="center">
  <img width="50%" alt="A demo screenshot." src="https://user-images.githubusercontent.com/8785025/85236358-272d3680-b3d2-11ea-8793-0f45cb70189a.png">
</p>

## Usage

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
      - uses: vale-cli/vale-action@v3
```

> [!TIP]
> If you're using a markup format other than Markdown, you may need to install
> an external parser before calling `vale-action`:
>
> ```yaml
> # For AsciiDoc users:
> - name: Install Asciidoctor
>   run: sudo apt-get install -y asciidoctor
>
> # For reStructuredText users:
> - name: Install docutils
>   run: sudo apt-get install -y docutils
> ```
>
> See the [Vale documentation][2] for more information.

The action runs on the Linux, macOS, and Windows runners, on both x86-64 and
ARM. The one gap is Windows on ARM, which Vale has no build for.

## Suggested fixes

Vale knows how to resolve some of the alerts it reports -- a substitution
knows what to swap in, a spelling error has candidate spellings -- which the
action offers as [suggested changes][5] that reviewers can commit from the
pull request itself.

This requires the `github-pr-review` reporter, since it's the only one that
posts review comments:

```yaml
- uses: vale-cli/vale-action@v3
  with:
    reporter: github-pr-review
```

A suggestion is only offered when the rule declares an [action][6] and the
flagged text still matches what's in the file, so alerts that span markup are
reported without one.

> [!NOTE]
> A pull request from a fork runs with a [read-only token][10], and posting a
> review comment is a write. Suggestions -- and the `github-pr-check` and
> `github-check` reporters, which write a check run -- are unavailable there.
>
> The default reporter still annotates a fork's pull request: it writes those
> through the runner's log rather than the API, which needs no write access.

## Repository Structure

The recommended repository structure makes use of the existing `.github` 
directory to hold all of our Vale-related resources:

```text
.github
├── styles
│   └── vocab.txt
└── workflows
    └── main.yml
.vale.ini
...
```

Where `styles` represents your [`StylesPath`][3]. The top-level `.vale.ini` 
file should reference this directory:

```ini
StylesPath = .github/styles
MinAlertLevel = suggestion

[*.md]
BasedOnStyles = Vale
```

## Caching

`vale sync` downloads every [package][7] your configuration names, every time
it runs. To download them only when they change, restore the `StylesPath`
from a cache and tell the action to skip the sync on a hit:

```yaml
- uses: actions/cache@v4
  id: styles
  with:
    path: .github/styles
    key: vale-${{ hashFiles('.vale.ini') }}

- uses: vale-cli/vale-action@v3
  with:
    sync: ${{ steps.styles.outputs.cache-hit != 'true' }}
```

The Vale and `reviewdog` binaries go into the runner's tool cache, which a
self-hosted runner keeps between jobs. The hosted runners start each job on a
fresh machine, so there they're downloaded once per job.

## Inputs

You can further customize the linting processing by providing one of the 
following optional inputs.

To add an input, edit your workflow file and add the `with` key to the `uses` 
block. For example:

```yaml
- uses: vale-cli/vale-action@v3
  with:
    version: 2.17.0
```

### `version` (default: latest)

> NOTE: The provided version must be `>= 2.16.0`.

Specify the Vale CLI version to use. If `none`, any preinstalled version of vale
is used.

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

- `files: all` (default): The repo's root directory; equivalent to calling 
`vale .`.

- `files: path/to/lint`: A single file or directory; equivalent to calling 
`vale path/to/lint`.

- `files: '["input1", "input2"]'`: A JSON-formatted list of file or directory 
arguments; equivalent to calling `vale input1 input2`.

- `files: 'input1,input2'`: A character-delimited list of files. The character 
is determined by the input value `separator`:
    
    ```yaml
    with:
      separator: ","
    ```

### `sync` (default: true)

Run `vale sync` before linting. Set to `false` when you restore the
`StylesPath` from a cache yourself; see [Caching](#caching).

```yaml
with:
  sync: false
```

### `reporter` (default: github-pr-check)

Set the [reporter](https://github.com/reviewdog/reviewdog#reporters) type.

```yaml
with:
  # github-pr-check, github-pr-review, github-check
  reporter: github-pr-check
```

### `fail_on_error` (default: false)

By default, the action succeeds whatever Vale reports. With `fail_on_error`,
it fails when Vale reports an alert at the `error` level -- and only then, so
a warning or a suggestion still passes.

```yaml
with:
  fail_on_error: true
```

### `fail_level` (default: unset)

The severity at which the run fails: `none`, `any`, `info`, `warning`, or
`error`. It takes precedence over `fail_on_error`, which is the same setting
with two positions rather than five.

```yaml
with:
  fail_level: warning
```

Needs `reviewdog` 0.21.0 or later; see [`reviewdog_version`](#reviewdog_version-default-0210).

### `filter_mode` (default: added)

Set the [filter mode](https://github.com/reviewdog/reviewdog#filter-mode) for
`reviewdog`.

```yaml
with:
  # added, diff_context, file, nofilter
  filter_mode: nofilter
```

### `config` (default: "")

A path to the `.vale.ini` to lint with, for a configuration that doesn't sit
where Vale would look for it.

```yaml
with:
  config: docs/.vale.ini
```

### `filter` (default: "")

An [expression][8] that decides which rules run. Report only errors, or only
one style, without editing the configuration:

```yaml
with:
  filter: '.Level == "error"'
```

### `glob` (default: "")

A [glob pattern][9] limiting which files Vale reads.

```yaml
with:
  glob: '*.{md,txt}'
```

### `min_alert_level` (default: "")

The lowest level worth reporting: `suggestion`, `warning`, or `error`.

```yaml
with:
  min_alert_level: warning
```

### `vale_flags` (default: "")

Space-delimited list of flags for the Vale CLI. To see a full list of available 
flags, run `vale -h`.

Anything without an input of its own goes here. Quotes group what they
surround, as they would in a shell, so a flag can carry spaces:

```yaml
with:
  vale_flags: "--glob=*.txt --filter='.Level == \"error\"'"
```

A backslash means a backslash rather than an escape, so Windows paths need no
special handling.

### `level` (default: unset)

The [report level](https://github.com/reviewdog/reviewdog#reporters) for
`reviewdog`, which decides what a check reporter concludes: `error` fails the
check, `info` and `warning` leave it neutral.

```yaml
with:
  # info, warning, error
  level: error
```

Left unset, the level follows `fail_on_error` and whether Vale found errors.

### `workdir` (default: .)

The directory to run Vale in, relative to the repository root. Use it when
the `.vale.ini` lives somewhere other than the top level.

```yaml
with:
  workdir: docs
```

### `separator` (default: "")

The character that splits the `files` input into a list; see
[`files`](#files-default-all).

```yaml
with:
  separator: ","
```

### `debug` (default: false)

Log the resolved Vale version and arguments.

```yaml
with:
  debug: true
```

### `reviewdog_version` (default: 0.21.0)

The `reviewdog` release to install. The action checks each download against
the release's published checksums.

```yaml
with:
  reviewdog_version: 0.21.0
```

### `reviewdog_url` (default: "")

A URL to a `tar.gz` build of `reviewdog` to use in place of the published
release. A build named this way skips both the tool cache and the checksum
check, since neither has anything to say about it.

```yaml
with:
  reviewdog_url: https://example.com/reviewdog.tar.gz
```

### `token` (default: [`secrets.GITHUB_TOKEN`][4])

The GitHub token to use.

```yaml
with:
  token: ${{secrets.VALE_GITHUB_TOKEN}}
```

[1]: https://docs.github.com/en/actions/how-tos/write-workflows
[2]: https://docs.vale.sh/topics/scopes
[3]: https://docs.vale.sh/keys/stylespath
[4]: https://docs.github.com/en/actions/tutorials/authenticate-with-github_token
[5]: https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/incorporating-feedback-in-your-pull-request
[6]: https://docs.vale.sh/topics/actions
[7]: https://docs.vale.sh/keys/packages
[8]: https://docs.vale.sh/topics/filters
[9]: https://docs.vale.sh/guides/globbing
[10]: https://docs.github.com/en/actions/concepts/security/github_token
