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
exports.createFixer = createFixer;
exports.configFlags = configFlags;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
/**
 * The flags that decide which configuration `vale fix` answers from.
 *
 * `fix` loads the project's configuration like every other subcommand does,
 * so it has to be pointed at the same one we linted with.
 */
const CONFIG_FLAGS = ['--config', '--no-global'];
/**
 * `createFixer` asks Vale how to resolve an alert -- the same `vale fix` call
 * that powers the language server's quick fixes.
 *
 * Every lookup costs a process, so we cache by what Vale actually looks at:
 * the rule, its action, and the text the action applies to. Caching the
 * pending call rather than its result also collapses the duplicates that a
 * repeated misspelling would otherwise fan out into.
 */
function createFixer(exePath, cwd, flags) {
    const config = configFlags(flags);
    const cache = new Map();
    return (alert) => {
        const key = JSON.stringify([alert.Check, alert.Action, alert.Match]);
        let pending = cache.get(key);
        if (pending === undefined) {
            pending = fix(exePath, cwd, config, alert);
            cache.set(key, pending);
        }
        return pending;
    };
}
/**
 * `configFlags` picks the user's flags that `fix` needs to see too.
 */
function configFlags(flags) {
    const kept = [];
    for (let i = 0; i < flags.length; i++) {
        const flag = flags[i];
        const name = flag.split('=')[0];
        if (!CONFIG_FLAGS.includes(name)) {
            continue;
        }
        kept.push(flag);
        // `--config path` is as valid as `--config=path`.
        if (name === '--config' && !flag.includes('=') && i + 1 < flags.length) {
            kept.push(flags[++i]);
        }
    }
    return kept;
}
function fix(exePath, cwd, config, alert) {
    return __awaiter(this, void 0, void 0, function* () {
        const args = [...config, 'fix', JSON.stringify(alert)];
        const output = yield exec.getExecOutput(exePath, args, {
            cwd,
            silent: true,
            ignoreReturnCode: true
        });
        if (output.exitCode !== 0) {
            // An alert we can't fix isn't worth failing the run over.
            core.debug(`Unable to fix '${alert.Check}': ${output.stderr.trim()}`);
            return [];
        }
        try {
            const solution = JSON.parse(output.stdout);
            if (solution.error) {
                core.debug(`Unable to fix '${alert.Check}': ${solution.error}`);
                return [];
            }
            return solution.suggestions || [];
        }
        catch (error) {
            core.debug(`Unable to read Vale's fix for '${alert.Check}': ${error}`);
            return [];
        }
    });
}
