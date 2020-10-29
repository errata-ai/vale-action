"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.modifiedFilesInPR = exports.wasLineAddedInPR = void 0;
const github = __importStar(require("@actions/github"));
const core = __importStar(require("@actions/core"));
const execa = require('execa');
const cache = {};
function wasLineAddedInPR(filename, line) {
    var _a, _b, _c;
    const fromSHA = (_c = (_b = (_a = github.context.payload) === null || _a === void 0 ? void 0 : _a.pull_request) === null || _b === void 0 ? void 0 : _b.base) === null || _c === void 0 ? void 0 : _c.sha;
    // default to return true when not in the context of a PR.
    if (!fromSHA)
        return true;
    const lines = cache[filename + fromSHA] || addedLines(filename, fromSHA);
    cache[filename + fromSHA] = lines;
    return lines.includes(line);
}
exports.wasLineAddedInPR = wasLineAddedInPR;
function modifiedFilesInPR() {
    var _a, _b, _c;
    ensureGitHistory();
    const fromSHA = (_c = (_b = (_a = github.context.payload) === null || _a === void 0 ? void 0 : _a.pull_request) === null || _b === void 0 ? void 0 : _b.base) === null || _c === void 0 ? void 0 : _c.sha;
    return execa
        .commandSync(`git diff --name-only ${fromSHA}`)
        .stdout.toString()
        .split('\n');
}
exports.modifiedFilesInPR = modifiedFilesInPR;
function addedLines(filename, fromSHA) {
    try {
        ensureGitHistory();
        return (execa
            // unified=0 => no context around changed lines.
            .commandSync(`git diff --unified=0 ${fromSHA} ${filename}`)
            .stdout.toString()
            .split(/(?:\r\n|\r|\n)/g)
            // compute the lines that have been added. e.g: `[1, 42]`.
            .reduce((acc, line) => {
            // lines starting with @@ mark a hunk. the format is like this:
            // @@ -(start of removals),(number of removed lines) +(start of insertions),(number of insertions)
            // here are some examples:
            // @@ -33,0 +42,24 @@ => removes nothing and inserts 24 lines starting at line 42
            // @@ -8 +6 @@        => removes line 8 and adds line 6. if there's no comma it's a single-line change.
            if (!line.startsWith('@@'))
                return acc;
            // get the `+` portion, as only additions are relevant in order to filter annotations for portions that are changed.
            // afterwards split by `,` (no `,` means a single line addition).
            const [start, numberOfAddedLines = 1] = line.split(' ')[2].split(',');
            const startInt = parseInt(start, 10);
            for (let i = 0; i < numberOfAddedLines; i++) {
                acc.push(startInt + i);
            }
            return acc;
        }, []));
    }
    catch (e) {
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
    if (isHhistoryLoaded)
        return;
    execa.commandSync('git fetch --unshallow');
    execa.commandSync('git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"');
    execa.commandSync('git fetch origin');
    isHhistoryLoaded = true;
}
