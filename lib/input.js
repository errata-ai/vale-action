"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const request = __importStar(require("request-promise-native"));
/**
 * Log debugging information to `stdout`.
 *
 * @msg is the message to log.
 */
function logIfDebug(msg) {
    const debug = (core.getInput('debug') == 'true');
    if (debug) {
        core.info(msg);
    }
}
/**
 * Parse our user input and set up our Vale environment.
 */
function get(tmp, tok, dir) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get the current version of Vale:
        let version = '';
        yield exec.exec('vale', ['-v'], {
            silent: true,
            listeners: {
                stdout: (buffer) => version = buffer.toString().trim(),
            }
        });
        version = version.split(' ').slice(-1)[0];
        logIfDebug(`Using Vale ${version}`);
        let args = ['--no-exit'];
        // Check if we were given an external config file.
        //
        // NOTE: We need to do this first because we may not have a local config file
        // to read the `StylesPath` from.
        const config = core.getInput('config');
        if (config !== '') {
            logIfDebug(`Downloading external config '${config}' ...`);
            yield request.get(config)
                .catch((error) => {
                core.warning(`Failed to fetch remote config: ${error}.`);
            })
                .then((body) => {
                try {
                    fs.writeFileSync(tmp.name, body);
                    logIfDebug(`Successfully fetched remote config.`);
                    args.push('--mode-rev-compat');
                    args.push(`--config=${tmp.name}`);
                }
                catch (e) {
                    core.warning(`Failed to write config: ${e}.`);
                }
            });
        }
        // Install our user-specified styles:
        const styles = core.getInput('styles').split('\n');
        for (const style of styles) {
            if (style !== '') {
                const name = style.split('/').slice(-1)[0].split('.zip')[0];
                logIfDebug(`Installing style '${name}' ...`);
                let cmd = ['install', name, style];
                if (args.length > 2) {
                    cmd = args.concat(cmd);
                }
                yield exec.exec('vale', cmd, { cwd: dir, silent: true });
            }
        }
        // Figure out what we're supposed to lint:
        const files = core.getInput('files');
        if (files == 'all') {
            args.push('.');
        }
        else if (fs.existsSync(path.resolve(dir, files))) {
            args.push(files);
        }
        else {
            core.warning(`User-specified path (${files}) doesn't exist; falling back to 'all'.`);
            args.push('.');
        }
        logIfDebug(`Vale set-up comeplete; using '${args}'.`);
        return {
            token: tok, workspace: dir, args: args, version: version
        };
    });
}
exports.get = get;
