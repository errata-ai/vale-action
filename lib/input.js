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
exports.parse = parse;
exports.get = get;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const install_1 = require("./install");
/**
 * `parse` splits a line of flags the way a shell would.
 *
 * Quotes group what's inside them, so a Vale 3 filter -- which has spaces and
 * quotes of its own, as in `--filter='.Level == "error"'` -- survives the
 * trip. A backslash is left alone: it's a path separator far more often than
 * an escape in what we're given here.
 */
function parse(flags) {
    const args = [];
    let arg = '';
    let quote = '';
    let started = false;
    for (const char of flags) {
        if (quote !== '') {
            if (char === quote) {
                quote = '';
            }
            else {
                arg += char;
            }
        }
        else if (char === "'" || char === '"') {
            quote = char;
            started = true;
        }
        else if (/\s/.test(char)) {
            if (started) {
                args.push(arg);
                arg = '';
                started = false;
            }
        }
        else {
            arg += char;
            started = true;
        }
    }
    if (quote !== '') {
        throw new Error(`Unbalanced ${quote} in vale_flags: ${flags}`);
    }
    else if (started) {
        args.push(arg);
    }
    return args;
}
/**
 * Log debugging information to `stdout`.
 *
 * @msg is the message to log.
 */
function logIfDebug(msg) {
    const debug = core.getInput('debug') == 'true';
    if (debug) {
        core.info(msg);
    }
}
/**
 * The Vale flags that have an input of their own.
 *
 * All of them are reachable through `vale_flags`, but a filter expression
 * carries quotes that then have to survive a YAML string, and a flag you have
 * to look up isn't one you'll use.
 */
const namedFlags = [
    ['config', '--config'],
    ['filter', '--filter'],
    ['glob', '--glob'],
    ['min_alert_level', '--minAlertLevel']
];
/**
 * `flagsFromInputs` collects the named flags the user set.
 */
function flagsFromInputs() {
    const flags = [];
    for (const [name, flag] of namedFlags) {
        const value = core.getInput(name);
        if (value !== '') {
            flags.push(`${flag}=${value}`);
        }
    }
    return flags;
}
/**
 * Parse our user input and set up our Vale environment.
 */
function get(tok, dir) {
    return __awaiter(this, void 0, void 0, function* () {
        const localVale = yield (0, install_1.installLint)(core.getInput('version'));
        const localReviewDog = yield (0, install_1.installReviewDog)("0.17.0", core.getInput('reviewdog_url'));
        // `vale_flags` comes last so that it still has the final say on anything
        // it names twice.
        const flags = [...flagsFromInputs(), ...parse(core.getInput('vale_flags'))];
        let version = '';
        yield exec.exec(localVale, ['-v'], {
            silent: true,
            listeners: {
                stdout: (buffer) => (version = buffer.toString().trim())
            }
        });
        version = version.split(' ').slice(-1)[0];
        logIfDebug(`Using Vale ${version}`);
        // `sync` re-downloads every package each time it runs, so a user who has
        // restored their `StylesPath` from a cache needs a way to say so.
        if (core.getInput('sync') !== 'false') {
            let stderr = '';
            let resp = yield exec.exec(localVale, [...flags, 'sync'], {
                cwd: dir,
                // Report what Vale said rather than the exit code `exec` would throw.
                ignoreReturnCode: true,
                listeners: {
                    stderr: (data) => {
                        stderr += data.toString();
                    }
                }
            });
            if (resp !== 0) {
                // Linting against a StylesPath that didn't finish downloading tells the
                // user nothing about their prose, so stop here rather than carry on.
                throw new Error(stderr.trim() || 'Unable to sync the StylesPath.');
            }
        }
        else {
            logIfDebug('Skipping sync; using the existing StylesPath.');
        }
        // We convert Vale's JSON into reviewdog's format ourselves, rather than
        // having Vale template it directly, so that we can ask Vale how to fix what
        // it found.
        let args = ['--output=JSON', ...flags];
        // Figure out what we're supposed to lint:
        const files = core.getInput('files');
        const delim = core.getInput('separator');
        if (files == 'all') {
            args.push('.');
        }
        else if (fs.existsSync(path.resolve(dir, files))) {
            args.push(files);
        }
        else if (delim !== "") {
            args = args.concat(files.split(delim));
        }
        else {
            try {
                // Support for an array of inputs.
                //
                // e.g., '[".github/workflows/main.yml"]'
                args = args.concat(JSON.parse(files));
            }
            catch (e) {
                core.warning(`User-specified path (${files}) is invalid; falling back to 'all'.`);
                args.push('.');
            }
        }
        logIfDebug(`Vale set-up complete; using '${args}' with ${localReviewDog}.`);
        return {
            token: tok,
            workspace: dir,
            exePath: localVale,
            args: args,
            flags: flags,
            reviewdogPath: localReviewDog,
        };
    });
}
