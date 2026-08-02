import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * A single alert from Vale's JSON output (`vale --output=JSON`).
 */
export interface ValeAlert {
  /** An action is what Vale would do about the alert, if it knows. */
  Action: { Name: string; Params: string[] | null };
  Check: string;
  Description: string;
  Line: number;
  Link: string;
  Match: string;
  Message: string;
  Severity: string;
  /**
   * The inclusive, 1-based range of `Match` within `Line`.
   *
   * The offsets are characters, not bytes -- unlike reviewdog's.
   */
  Span: [number, number];
}

/**
 * Vale reports its alerts as a map of file paths to alerts.
 *
 * The paths are relative to the directory Vale ran in.
 */
export type ValeOutput = Record<string, ValeAlert[]>;

/**
 * `Fixer` asks Vale how an alert could be resolved, returning zero or more
 * replacements for the alert's `Match`.
 */
export type Fixer = (alert: ValeAlert) => Promise<string[]>;

interface Position {
  line: number;
  column: number;
}

interface Range {
  start: Position;
  /** Exclusive: the position *after* the last character in the range. */
  end: Position;
}

interface Suggestion {
  range: Range;
  text: string;
}

/**
 * A reviewdog diagnostic, as consumed by its `rdjsonl` format.
 *
 * See https://github.com/reviewdog/reviewdog/blob/master/proto/rdf/reviewdog.proto.
 */
export interface Diagnostic {
  message: string;
  location: { path: string; range: Range };
  severity: 'ERROR' | 'WARNING' | 'INFO';
  code: { value: string; url?: string };
  suggestions?: Suggestion[];
}

export interface Options {
  /** The directory that the paths in Vale's output are relative to. */
  cwd: string;
  /**
   * Asks Vale to resolve fixable alerts.
   *
   * Omitted when the reporter has no way to show a suggestion, since each
   * lookup costs a Vale process.
   */
  fix?: Fixer;
  /**
   * Name the rule in the message itself.
   *
   * Most reporters render `code` alongside the message, but the annotation
   * ones don't -- and an alert that doesn't say which rule it came from isn't
   * much use.
   */
  nameRuleInMessage: boolean;
}

/**
 * How many of Vale's replacements to offer for a single alert.
 *
 * A misspelling can have a dozen candidates; past the first few they're noise.
 */
const MAX_SUGGESTIONS = 3;

/** How many `vale fix` processes to run at once. */
const FIX_CONCURRENCY = 8;

const NON_ASCII = /[^\x00-\x7F]/;

/**
 * `toDiagnostics` converts Vale's output into reviewdog's, resolving fixable
 * alerts into suggestions along the way.
 */
export async function toDiagnostics(
  output: ValeOutput,
  opts: Options
): Promise<Diagnostic[]> {
  const source = new Source(opts.cwd);

  const found: { path: string; alert: ValeAlert }[] = [];
  for (const [file, alerts] of Object.entries(output)) {
    for (const alert of alerts) {
      found.push({ path: file, alert });
    }
  }

  return await mapPool(found, FIX_CONCURRENCY, async ({ path: file, alert }) => {
    const line = await source.line(file, alert.Line);

    const diagnostic: Diagnostic = {
      message: opts.nameRuleInMessage
        ? `[${alert.Check}] ${alert.Message}`
        : alert.Message,
      location: {
        path: file,
        range: {
          start: { line: alert.Line, column: byteColumn(line, alert.Span[0]) },
          end: { line: alert.Line, column: byteColumn(line, alert.Span[1] + 1) }
        }
      },
      severity: severityOf(alert.Severity),
      code: alert.Link
        ? { value: alert.Check, url: alert.Link }
        : { value: alert.Check }
    };

    const suggestions = await suggestionsFor(alert, line, file, opts.fix);
    if (suggestions.length > 0) {
      diagnostic.suggestions = suggestions;
    }

    return diagnostic;
  });
}

/**
 * `suggestionsFor` turns Vale's replacements into reviewdog suggestions.
 */
async function suggestionsFor(
  alert: ValeAlert,
  line: string | null,
  file: string,
  fix?: Fixer
): Promise<Suggestion[]> {
  // Most alerts carry no action -- a rule that only flags a word has nothing
  // to put in its place -- and asking Vale to fix one of those costs a process
  // to be told so.
  if (fix === undefined || !alert.Action.Name) {
    return [];
  } else if (!isMatched(line, alert)) {
    // A suggestion replaces the span outright, so we only offer one when the
    // source really does hold what Vale says it matched. Otherwise we'd be
    // handing the reviewer a one-click way to corrupt the file.
    return [];
  }

  const replacements = await fix(alert);
  if (replacements.length === 0) {
    return [];
  }

  // Deleting a word would otherwise leave the space on either side of it
  // behind; take the trailing one with it.
  const trailing =
    alert.Action.Name === 'remove' && charAt(line, alert.Span[1] + 1) === ' '
      ? 1
      : 0;

  const range: Range = {
    start: { line: alert.Line, column: byteColumn(line, alert.Span[0]) },
    end: {
      line: alert.Line,
      column: byteColumn(line, alert.Span[1] + 1 + trailing)
    }
  };

  return replacements
    .slice(0, MAX_SUGGESTIONS)
    .map((text) => ({ range, text }));
}

/**
 * `isMatched` reports whether the source holds the text Vale says it flagged.
 */
function isMatched(line: string | null, alert: ValeAlert): boolean {
  if (line === null) {
    return false;
  }
  const [start, end] = alert.Span;
  return chars(line).slice(start - 1, end).join('') === alert.Match;
}

/**
 * `byteColumn` converts one of Vale's character offsets into the UTF-8 byte
 * offset that reviewdog measures its positions in.
 *
 * The two agree until a line picks up its first multi-byte character.
 */
function byteColumn(line: string | null, column: number): number {
  column = Math.max(column, 1);
  if (line === null || !NON_ASCII.test(line)) {
    return column;
  }
  const prefix = chars(line).slice(0, column - 1).join('');
  return Buffer.byteLength(prefix, 'utf8') + 1;
}

function charAt(line: string | null, column: number): string | undefined {
  return line === null ? undefined : chars(line)[column - 1];
}

/**
 * `chars` splits a line the way Vale counts it: by character, rather than by
 * the UTF-16 code units that JavaScript indexes with.
 */
function chars(line: string): string[] {
  return Array.from(line);
}

function severityOf(severity: string): Diagnostic['severity'] {
  switch (severity) {
    case 'error':
      return 'ERROR';
    case 'warning':
      return 'WARNING';
    default:
      return 'INFO';
  }
}

/**
 * The lines of the files Vale reported on.
 *
 * We need them to convert Vale's character offsets into byte offsets and to
 * confirm that a suggestion would replace what Vale matched.
 */
class Source {
  private files = new Map<string, Promise<string[] | null>>();

  constructor(private root: string) {}

  async line(file: string, line: number): Promise<string | null> {
    let pending = this.files.get(file);
    if (pending === undefined) {
      pending = this.read(file);
      this.files.set(file, pending);
    }

    const lines = await pending;
    if (lines === null || line < 1 || line > lines.length) {
      return null;
    }
    return lines[line - 1];
  }

  private async read(file: string): Promise<string[] | null> {
    try {
      const content = await fs.readFile(path.resolve(this.root, file), 'utf8');
      return content.split(/\r?\n/);
    } catch {
      // Vale can report on input we can't read back, such as stdin.
      return null;
    }
  }
}

/** `mapPool` is `Promise.all` with a cap on how many run at once. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    }
  );
  await Promise.all(workers);

  return results;
}
