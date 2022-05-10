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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const execa_1 = __importDefault(require("execa"));
const path = __importStar(require("path"));
const input = __importStar(require("./input"));
/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const { GITHUB_TOKEN, GITHUB_WORKSPACE } = process.env;
function run(actionInput) {
    return __awaiter(this, void 0, void 0, function* () {
        const workdir = core.getInput('workdir') || '.';
        const cwd = path.relative(process.env['GITHUB_WORKSPACE'] || process.cwd(), workdir);
        try {
            // Vale output ...
            const alertResp = yield execa_1.default(actionInput.exePath, actionInput.args, {
                cwd: cwd
            });
            if (core.getInput('debug') == 'true') {
                core.info(alertResp.stdout);
                core.info(alertResp.stderr);
            }
            // Pipe to reviewdog ...
            process.env['REVIEWDOG_GITHUB_API_TOKEN'] = GITHUB_TOKEN;
            yield exec.exec('/bin/reviewdog', [
                '-f=rdjsonl',
                `-name=vale`,
                `-reporter=${core.getInput('reporter')}`,
                `-fail-on-error=${core.getInput('fail_on_error')}`,
                `-filter-mode=${core.getInput('filter_mode')}`,
                `-level=${core.getInput('level')}`
            ], {
                cwd,
                input: Buffer.from(alertResp.stdout, 'utf-8'),
                ignoreReturnCode: true
            });
        }
        catch (error) {
            core.setFailed(error.stderr);
        }
    });
}
exports.run = run;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userToken = GITHUB_TOKEN;
            const workspace = GITHUB_WORKSPACE;
            const actionInput = yield input.get(userToken, workspace);
            yield run(actionInput);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
main();
