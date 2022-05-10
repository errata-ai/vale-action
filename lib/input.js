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
exports.get = void 0;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const git_1 = require("./git");
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
        let modified = {};
        // Get the current version of Vale:
        let version = '';
        yield exec.exec('vale', ['-v'], {
            silent: true,
            listeners: {
                stdout: (buffer) => (version = buffer.toString().trim())
            }
        });
        version = version.split(' ').slice(-1)[0];
        logIfDebug(`Using Vale ${version}`);
        let args = ['--no-exit', '--output=JSON'];
        // Figure out what we're supposed to lint:
        const files = core.getInput('files');
        if (core.getInput('onlyAnnotateModifiedLines') != 'false' ||
            files == '__onlyModified') {
            let payload = yield git_1.modifiedFiles();
            let names = new Set();
            payload.forEach(file => {
                if (fs.existsSync(file.name)) {
                    names.add(file.name);
                    modified[file.name] = file;
                }
            });
            // add empty file is there is no file to lint
            // else execa will wait forever as --no-exit flag is given
            // and there is no argument given
            if (names.size === 0) {
                names.add('{}');
            }
            args = args.concat(Array.from(names));
        }
        else if (files == 'all') {
            args.push('.');
        }
        else if (fs.existsSync(path.resolve(dir, files))) {
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
        logIfDebug(`Vale set-up comeplete; using '${args}'.`);
        return {
            token: tok,
            workspace: dir,
            args: args,
            version: version,
            files: modified
        };
    });
}
exports.get = get;
