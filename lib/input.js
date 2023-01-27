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
exports.get = exports.parse = void 0;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const install_1 = require("./install");
const rd = 'https://github.com/reviewdog/reviewdog/releases/download/v0.14.1/reviewdog_0.14.1_Linux_x86_64.tar.gz';
function parse(flags) {
    flags = flags.trim();
    if (flags === "") {
        return [];
    }
    // TODO: need to simulate bash?
    return flags.split(/\s+/);
}
exports.parse = parse;
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
 * Parse our user input and set up our Vale environment.
 */
function get(tok, dir) {
    return __awaiter(this, void 0, void 0, function* () {
        const localVale = yield install_1.installLint(core.getInput('version'));
        //const reviewdog = await installTool('reviewdog', rd);
        const valeFlags = core.getInput("vale_flags");
        let version = '';
        yield exec.exec(localVale, ['-v'], {
            silent: true,
            listeners: {
                stdout: (buffer) => (version = buffer.toString().trim())
            }
        });
        version = version.split(' ').slice(-1)[0];
        logIfDebug(`Using Vale ${version}`);
        const parsedFlags = parse(valeFlags);
        const userArgNames = new Set(valeFlags
            .trim()
            .split(/\s+/)
            .map((arg) => arg.split(`=`)[0])
            .filter((arg) => arg.startsWith(`-`))
            .map((arg) => arg.replace(/^-+/, ``)));
        if (userArgNames.has(`output`)) {
            throw new Error(`please, don't change the --output style.`);
        }
        let stderr = '';
        let resp = yield exec.exec(localVale, [...parsedFlags, 'sync'], {
            cwd: dir,
            listeners: {
                stderr: (data) => {
                    stderr += data.toString();
                }
            }
        });
        if (resp !== 0) {
            core.setFailed(stderr);
        }
        let args = [
            `--no-wrap`,
            //`--output=${path.resolve(__dirname, 'rdjsonl.tmpl')}`,
            ...parsedFlags,
        ];
        // Figure out what we're supposed to lint:
        const files = core.getInput('files');
        if (files == 'all') {
            args.push('.');
        }
        else if (fs.existsSync(path_1.default.resolve(dir, files))) {
            args.push(files);
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
        logIfDebug(`Vale set-up complete; using '${args}'.`);
        return {
            token: tok,
            workspace: dir,
            exePath: localVale,
            reviewdog: path_1.default.resolve(__dirname, 'reviewdog'),
            args: args
        };
    });
}
exports.get = get;
