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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckRunner = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const colorize = require('json-colorizer');
const pkg = require('../package.json');
const USER_AGENT = `${pkg.name}/${pkg.version} (${pkg.bugs.url})`;
/**
 * CheckRunner handles all communication with GitHub's Check API.
 *
 * See https://developer.github.com/v3/checks.
 */
class CheckRunner {
    constructor() {
        this.annotations = [];
        this.stats = {
            suggestions: 0,
            warnings: 0,
            errors: 0,
        };
    }
    /**
     * Convert Vale's JSON `output` into an array of annotations.
     */
    makeAnnotations(output) {
        const alerts = JSON.parse(output);
        for (const filename of Object.getOwnPropertyNames(alerts)) {
            for (const alert of alerts[filename]) {
                switch (alert.Severity) {
                    case 'suggestion':
                        this.stats.suggestions += 1;
                        break;
                    case 'warning':
                        this.stats.warnings += 1;
                        break;
                    case 'error':
                        this.stats.errors += 1;
                        break;
                    default:
                        break;
                }
                this.annotations.push(CheckRunner.makeAnnotation(filename, alert));
            }
        }
    }
    /**
     * Show the results of running Vale.
     *
     * NOTE: Support for annotation is still a WIP:
     *
     * - https://github.com/actions/toolkit/issues/186
     * - https://github.com/actions-rs/clippy-check/issues/2
     */
    executeCheck(options) {
        return __awaiter(this, void 0, void 0, function* () {
            core.info(`Vale: ${this.getSummary()}`);
            const client = github.getOctokit(options.token, {
                userAgent: USER_AGENT,
            });
            let checkRunId;
            try {
                checkRunId = yield this.createCheck(client, options);
            }
            catch (error) {
                // NOTE: `GITHUB_HEAD_REF` is set only for forked repos.
                if (process.env.GITHUB_HEAD_REF) {
                    core.warning(`Unable to create annotations; printing Vale alerts instead.`);
                    this.dumpToStdout();
                    if (this.getConclusion() == 'failure') {
                        throw new Error('Exiting due to Vale errors');
                    }
                    return;
                }
                else {
                    throw error;
                }
            }
            try {
                if (this.isSuccessCheck()) {
                    // We don't have any alerts to report ...
                    yield this.successCheck(client, checkRunId, options);
                }
                else {
                    // Vale found some alerts to report ...
                    yield this.runUpdateCheck(client, checkRunId, options);
                }
            }
            catch (error) {
                yield this.cancelCheck(client, checkRunId, options);
                throw error;
            }
        });
    }
    /**
     * Create our initial check run.
     *
     * See https://developer.github.com/v3/checks/runs/#create-a-check-run.
     */
    createCheck(client, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield client.checks.create({
                owner: options.owner,
                repo: options.repo,
                name: options.name,
                head_sha: options.head_sha,
                status: 'in_progress',
            });
            if (response.status != 201) {
                core.warning(`[createCheck] Unexpected status code ${response.status}`);
            }
            return response.data.id;
        });
    }
    /**
     * End our check run.
     *
     * NOTE: The Checks API only allows 50 annotations per request, so we send
     * multiple "buckets" if we have more than 50.
     */
    runUpdateCheck(client, checkRunId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let annotations = this.getBucket();
            while (annotations.length > 0) {
                let req = {
                    owner: options.owner,
                    repo: options.repo,
                    name: options.name,
                    check_run_id: checkRunId,
                    output: {
                        title: options.name,
                        summary: this.getSummary(),
                        text: this.getText(options.context),
                        annotations: annotations,
                    }
                };
                if (this.annotations.length > 0) {
                    // There will be more annotations later ...
                    req.status = 'in_progress';
                }
                else {
                    req.status = 'completed';
                    req.conclusion = this.getConclusion();
                    req.completed_at = new Date().toISOString();
                }
                const response = yield client.checks.update(req);
                if (response.status != 200) {
                    core.warning(`[updateCheck] Unexpected status code ${response.status}`);
                }
                annotations = this.getBucket();
            }
            return;
        });
    }
    /**
     * Indicate that no alerts were found.
     */
    successCheck(client, checkRunId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let req = {
                owner: options.owner,
                repo: options.repo,
                name: options.name,
                check_run_id: checkRunId,
                status: 'completed',
                conclusion: this.getConclusion(),
                completed_at: new Date().toISOString(),
                output: {
                    title: options.name,
                    summary: this.getSummary(),
                    text: this.getText(options.context),
                }
            };
            const response = yield client.checks.update(req);
            if (response.status != 200) {
                core.warning(`[successCheck] Unexpected status code ${response.status}`);
            }
            return;
        });
    }
    /**
     * Something went wrong; cancel the check run and report the exception.
     */
    cancelCheck(client, checkRunId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let req = {
                owner: options.owner,
                repo: options.repo,
                name: options.name,
                check_run_id: checkRunId,
                status: 'completed',
                conclusion: 'cancelled',
                completed_at: new Date().toISOString(),
                output: {
                    title: options.name,
                    summary: 'Unhandled error',
                    text: 'Check was cancelled due to unhandled error. Check the Action logs for details.',
                }
            };
            const response = yield client.checks.update(req);
            if (response.status != 200) {
                core.warning(`[cancelCheck] Unexpected status code ${response.status}`);
            }
            return;
        });
    }
    /**
     * Print Vale's output to stdout.
     *
     * NOTE: This should only happen if we can't create annotations (see
     * `executeCheck` above).
     *
     * TODO: Nicer formatting?
     */
    dumpToStdout() {
        console.log(colorize(JSON.stringify(this.annotations)));
    }
    /**
     * Create buckets of at most 50 annotations for the API.
     *
     * See https://developer.github.com/v3/checks/runs/#output-object.
     */
    getBucket() {
        let annotations = [];
        while (annotations.length < 50) {
            const annotation = this.annotations.pop();
            if (annotation) {
                annotations.push(annotation);
            }
            else {
                break;
            }
        }
        core.debug(`Prepared next annotations bucket, ${annotations.length} size`);
        return annotations;
    }
    /**
     * Report a summary of the alerts found by Vale.
     */
    getSummary() {
        const sn = this.stats.suggestions;
        const wn = this.stats.warnings;
        const en = this.stats.errors;
        return `Found ${sn} suggestion(s), ${wn} warning(s), and ${en} error(s).`;
    }
    /**
     * Create a Markdown-formatted summary of the alerts found by Vale.
     */
    getText(context) {
        return `Vale ${context.vale}`;
    }
    /**
     * If Vale found an error-level alerts, we mark the check result as "failure".
     */
    getConclusion() {
        if (this.stats.errors > 0) {
            return 'failure';
        }
        else {
            return 'success';
        }
    }
    /**
     * No alerts found.
     */
    isSuccessCheck() {
        return this.stats.suggestions == 0 && this.stats.warnings == 0 && this.stats.errors == 0;
    }
    /**
     * Convert Vale-formatted JSON object into an array of annotations:
     *
     * {
     *   "README.md": [
     *     {
     *       "Check": "DocsStyles.BadWords",
     *       "Description": "",
     *       "Line": 6,
     *       "Link": "",
     *       "Message": "'slave' should be changed",
     *       "Severity": "error",
     *       "Span": [
     *         22,
     *         26
     *       ],
     *       "Hide": false,
     *       "Match": "slave"
     *     }
     *   ]
     * }
     *
     * See https://developer.github.com/v3/checks/runs/#annotations-object.
     */
    static makeAnnotation(name, alert) {
        let annotation_level;
        switch (alert.Severity) {
            case 'suggestion':
                annotation_level = 'notice';
                break;
            case 'warning':
                annotation_level = 'warning';
                break;
            default:
                annotation_level = 'failure';
                break;
        }
        let annotation = {
            path: name,
            start_line: alert.Line,
            end_line: alert.Line,
            start_column: alert.Span[0],
            end_column: alert.Span[1],
            annotation_level: annotation_level,
            title: `[${alert.Severity}] ${alert.Check}`,
            message: alert.Message,
        };
        return annotation;
    }
}
exports.CheckRunner = CheckRunner;
