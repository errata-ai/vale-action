"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDiagnostics = toDiagnostics;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
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
function toDiagnostics(output, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const source = new Source(opts.cwd);
        const found = [];
        for (const [file, alerts] of Object.entries(output)) {
            for (const alert of alerts) {
                found.push({ path: file, alert });
            }
        }
        return yield mapPool(found, FIX_CONCURRENCY, (_a) => __awaiter(this, [_a], void 0, function* ({ path: file, alert }) {
            const line = yield source.line(file, alert.Line);
            const diagnostic = {
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
            const suggestions = yield suggestionsFor(alert, line, file, opts.fix);
            if (suggestions.length > 0) {
                diagnostic.suggestions = suggestions;
            }
            return diagnostic;
        }));
    });
}
/**
 * `suggestionsFor` turns Vale's replacements into reviewdog suggestions.
 */
function suggestionsFor(alert, line, file, fix) {
    return __awaiter(this, void 0, void 0, function* () {
        // Most alerts carry no action -- a rule that only flags a word has nothing
        // to put in its place -- and asking Vale to fix one of those costs a process
        // to be told so.
        if (fix === undefined || !alert.Action.Name) {
            return [];
        }
        else if (!isMatched(line, alert)) {
            // A suggestion replaces the span outright, so we only offer one when the
            // source really does hold what Vale says it matched. Otherwise we'd be
            // handing the reviewer a one-click way to corrupt the file.
            return [];
        }
        const replacements = yield fix(alert);
        if (replacements.length === 0) {
            return [];
        }
        // Deleting a word would otherwise leave the space on either side of it
        // behind; take the trailing one with it.
        const trailing = alert.Action.Name === 'remove' && charAt(line, alert.Span[1] + 1) === ' '
            ? 1
            : 0;
        const range = {
            start: { line: alert.Line, column: byteColumn(line, alert.Span[0]) },
            end: {
                line: alert.Line,
                column: byteColumn(line, alert.Span[1] + 1 + trailing)
            }
        };
        return replacements
            .slice(0, MAX_SUGGESTIONS)
            .map((text) => ({ range, text }));
    });
}
/**
 * `isMatched` reports whether the source holds the text Vale says it flagged.
 */
function isMatched(line, alert) {
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
function byteColumn(line, column) {
    column = Math.max(column, 1);
    if (line === null || !NON_ASCII.test(line)) {
        return column;
    }
    const prefix = chars(line).slice(0, column - 1).join('');
    return Buffer.byteLength(prefix, 'utf8') + 1;
}
function charAt(line, column) {
    return line === null ? undefined : chars(line)[column - 1];
}
/**
 * `chars` splits a line the way Vale counts it: by character, rather than by
 * the UTF-16 code units that JavaScript indexes with.
 */
function chars(line) {
    return Array.from(line);
}
function severityOf(severity) {
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
    constructor(root) {
        this.root = root;
        this.files = new Map();
    }
    line(file, line) {
        return __awaiter(this, void 0, void 0, function* () {
            let pending = this.files.get(file);
            if (pending === undefined) {
                pending = this.read(file);
                this.files.set(file, pending);
            }
            const lines = yield pending;
            if (lines === null || line < 1 || line > lines.length) {
                return null;
            }
            return lines[line - 1];
        });
    }
    read(file) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const content = yield fs.readFile(path.resolve(this.root, file), 'utf8');
                return content.split(/\r?\n/);
            }
            catch (_a) {
                // Vale can report on input we can't read back, such as stdin.
                return null;
            }
        });
    }
}
/** `mapPool` is `Promise.all` with a cap on how many run at once. */
function mapPool(items, limit, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = new Array(items.length);
        let next = 0;
        const workers = Array.from({ length: Math.min(limit, items.length) }, () => __awaiter(this, void 0, void 0, function* () {
            while (next < items.length) {
                const index = next++;
                results[index] = yield fn(items[index]);
            }
        }));
        yield Promise.all(workers);
        return results;
    });
}
