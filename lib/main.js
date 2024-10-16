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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.run = void 0;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const path = __importStar(require("path"));
const input = __importStar(require("./input"));
/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const { GITHUB_WORKSPACE } = process.env;
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
                    env: {
                        "PATH": `${process.env["PATH"]}:/home/runner/.local/share/gem/ruby/3.0.0/bin`
                    }
                });
                const vale_code = output.exitCode;
                'Vale return code: ${vale_code}';
                // Check for fatal runtime errors only (exit code 2)
                // These aren't linting errors, but ones that will come
                // about from missing or bad configuration files, etc.
                if (vale_code === 2) {
                    return 2; // Exit the function early
                }
                const should_fail = core.getInput('fail_on_error');
                const should_fail_on_level = core.getInput('fail_level');
                // Pipe to reviewdog ...
                core.info('Calling reviewdog 🐶');
                process.env['REVIEWDOG_GITHUB_API_TOKEN'] = core.getInput('token');
                // Support deprecated -fail-on-error option 
                if (should_fail === 'true' && should_fail_on_level === 'none') {
                    return yield exec.exec(actionInput.reviewdogPath, [
                        '-f=rdjsonl',
                        `-name=vale`,
                        `-reporter=${core.getInput('reporter')}`,
                        `-fail-on-error=true`,
                        `-filter-mode=${core.getInput('filter_mode')}`,
                        `-level=${vale_code == 1 ? 'error' : 'info'}`
                    ], {
                        cwd,
                        input: Buffer.from(output.stdout, 'utf-8'),
                        ignoreReturnCode: true
                    });
                } else {
                    return yield exec.exec(actionInput.reviewdogPath, [
                        '-f=rdjsonl',
                        `-name=vale`,
                        `-reporter=${core.getInput('reporter')}`,
                        `-fail-level=${should_fail_on_level}`,
                        `-filter-mode=${core.getInput('filter_mode')}`,
                        `-level=${vale_code == 1 && (should_fail_on_level === 'error' ||
                                                     should_fail_on_level === 'warning' ||
                                                     should_fail_on_level === 'info') ? should_fail_on_level : 'info'}`
                    ], {
                        cwd,
                        input: Buffer.from(output.stdout, 'utf-8'),
                        ignoreReturnCode: true
                    });
                }
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
exports.run = run;
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
