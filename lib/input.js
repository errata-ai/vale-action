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
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const { GITHUB_TOKEN, GITHUB_WORKSPACE } = process.env;
/**
 * Parse our user input and set up our Vale environment.
 */
function get(tmp) {
    return __awaiter(this, void 0, void 0, function* () {
        // Add Vale, as copied in Docker, to the `$PATH` for later use:
        //
        // NOTE: This *should* be done already by the container `jdkato/vale`.
        core.addPath('/bin');
        const userToken = GITHUB_TOKEN;
        const workspace = GITHUB_WORKSPACE;
        // Get the current version of Vale:
        let version = '';
        yield exec.exec('vale', ['-v'], {
            listeners: {
                stdout: (buffer) => version = buffer.toString().trim(),
            }
        });
        version = version.split(' ').slice(-1)[0];
        // Install our user-specified styles:
        const styles = core.getInput('styles').split(' ');
        for (const style of styles) {
            if (style !== '') {
                const name = style.split('/').slice(-1)[0].split('.zip')[0];
                core.info(`Installing style '${name}' ...`);
                yield exec.exec('vale', ['install', name, style], {
                    cwd: workspace,
                    silent: true,
                    ignoreReturnCode: true
                });
            }
        }
        let args = ['--no-exit', '--output=JSON'];
        // Check if we were given an external config file:
        const config = core.getInput('config');
        if (config !== '') {
            core.info(`Downloading external config '${config}' ...`);
            yield request.get(config)
                .catch((error) => {
                core.warning(`Failed to fetch remote config: ${error}.`);
            })
                .then((body) => {
                try {
                    fs.writeFileSync(tmp.name, body);
                    core.info(`Successfully fetched remote config.`);
                    args.push('--mode-rev-compat');
                    args.push(`--config=${tmp.name}`);
                }
                catch (e) {
                    core.warning(`Failed to write config: ${e}.`);
                }
            });
        }
        // Figure out what we're supposed to lint:
        const files = core.getInput('files');
        if (files == 'all') {
            args.push('.');
        }
        else if (fs.existsSync(path.resolve(workspace, files))) {
            args.push(files);
        }
        else {
            core.warning(`User-specified path (${files}) doesn't exist; falling back to 'all'.`);
            args.push('.');
        }
        core.info(`Vale set-up comeplete; using '${args}'.`);
        return {
            token: userToken, workspace: workspace, args: args, version: version
        };
    });
}
exports.get = get;
