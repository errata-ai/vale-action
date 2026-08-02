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
exports.run = run;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const path = __importStar(require("path"));
const input = __importStar(require("./input"));
const fix_1 = require("./fix");
const rdjson_1 = require("./rdjson");
/**
 * The reporters that can act on a suggested fix.
 *
 * Only a review comment can carry one; an annotation has nowhere to put it.
 */
const SUGGESTS = ['github-pr-review'];
/**
 * The reporters that drop a diagnostic's `code`.
 *
 * They log the message and nothing else, so the rule's name has to travel
 * within the message itself.
 */
const NAMES_RULE = ['github-annotations', 'github-pr-annotations'];
/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const { GITHUB_WORKSPACE } = process.env;
/**
 * Where `gem install --user-install` puts its binaries on the Linux runners.
 *
 * Vale shells out to Asciidoctor for AsciiDoc, and a user-installed gem isn't
 * on the PATH we inherit.
 */
const GEM_BIN = '/home/runner/.local/share/gem/ruby/3.0.0/bin';
/**
 * `valeEnv` is our own environment, plus wherever the markup parsers live.
 *
 * It has to be the whole environment: handing `exec` a lone PATH would drop
 * everything Vale reads from it -- `VALE_CONFIG_PATH`, `HOME`, the proxy
 * settings -- and on Windows, enough of the environment to break the process
 * outright.
 */
function valeEnv() {
    const env = Object.assign({}, process.env);
    if (process.platform === 'linux') {
        env['PATH'] = `${env['PATH']}${path.delimiter}${GEM_BIN}`;
    }
    return env;
}
/**
 * `convert` turns Vale's JSON into the `rdjsonl` that reviewdog reads.
 *
 * Alerts that Vale knows how to resolve become suggestions -- the same
 * replacements the language server offers as quick fixes -- which reviewers
 * can commit straight from the pull request.
 */
function convert(stdout, cwd, reporter, actionInput) {
    return __awaiter(this, void 0, void 0, function* () {
        const trimmed = stdout.trim();
        if (trimmed === '') {
            return '';
        }
        let output;
        try {
            output = JSON.parse(trimmed);
        }
        catch (error) {
            throw new Error(`Unable to read Vale's output: ${trimmed.substring(0, 500)}`);
        }
        const suggests = SUGGESTS.includes(reporter);
        if (!suggests) {
            core.debug(`The '${reporter}' reporter can't show suggested fixes.`);
        }
        const diagnostics = yield (0, rdjson_1.toDiagnostics)(output, {
            cwd,
            nameRuleInMessage: NAMES_RULE.includes(reporter),
            fix: suggests
                ? (0, fix_1.createFixer)(actionInput.exePath, cwd, actionInput.flags)
                : undefined
        });
        const fixable = diagnostics.filter(d => d.suggestions).length;
        if (fixable > 0) {
            core.info(`Vale suggested a fix for ${fixable} of ${diagnostics.length} alerts.`);
        }
        return diagnostics.map((d) => JSON.stringify(d)).join('\n');
    });
}
function run(actionInput) {
    return __awaiter(this, void 0, void 0, function* () {
        const workdir = core.getInput('workdir') || '.';
        const cwd = path.relative(process.env['GITHUB_WORKSPACE'] || process.cwd(), workdir);
        try {
            const code = yield core.group('Running vale...', () => __awaiter(this, void 0, void 0, function* () {
                // Vale output ...
                const output = yield exec.getExecOutput(actionInput.exePath, actionInput.args, {
                    cwd,
                    ignoreReturnCode: true,
                    env: valeEnv()
                });
                const vale_code = output.exitCode;
                core.debug(`Vale return code: ${vale_code}`);
                // Check for fatal runtime errors only (exit code 2)
                // These aren't linting errors, but ones that will come
                // about from missing or bad configuration files, etc.
                if (vale_code === 2) {
                    return 2; // Exit the function early
                }
                const should_fail = core.getInput('fail_on_error');
                const reporter = core.getInput('reporter');
                const diagnostics = yield convert(output.stdout, cwd, reporter, actionInput);
                // Pipe to reviewdog ...
                core.info('Calling reviewdog 🐶');
                process.env['REVIEWDOG_GITHUB_API_TOKEN'] = core.getInput('token');
                return yield exec.exec(actionInput.reviewdogPath, [
                    '-f=rdjsonl',
                    `-name=vale`,
                    `-reporter=${reporter}`,
                    `-fail-on-error=${should_fail}`,
                    `-filter-mode=${core.getInput('filter_mode')}`,
                    `-level=${vale_code == 1 && should_fail === 'true' ? 'error' : 'info'}`
                ], {
                    cwd,
                    input: Buffer.from(diagnostics, 'utf-8'),
                    ignoreReturnCode: true
                });
            }));
            if (code !== 0) {
                core.setFailed(`Vale and reviewdog exited with status code: ${code}`);
            }
        }
        catch (error) {
            if (error instanceof Error) {
                core.setFailed(error);
            }
            else {
                core.setFailed(`${error}`);
            }
        }
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userToken = core.getInput('token');
            const workspace = GITHUB_WORKSPACE;
            const actionInput = yield input.get(userToken, workspace);
            yield run(actionInput);
        }
        catch (error) {
            if (error instanceof Error) {
                core.setFailed(error);
            }
            else {
                core.setFailed(`${error}`);
            }
        }
    });
}
main();
