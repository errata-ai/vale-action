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
exports.annotate = void 0;
const core = __importStar(require("@actions/core"));
/**
 * Create file annotations from Vale's JSON output.
 *
 * NOTE: There some size limitations (https://rb.gy/lpeyey) which require us to
 * only report the first 50.
 */
function annotate(output) {
    return __awaiter(this, void 0, void 0, function* () {
        const alerts = JSON.parse(output);
        for (const filename of Object.getOwnPropertyNames(alerts)) {
            for (const a of alerts[filename]) {
                const msg = `[${a.Check}] ${a.Message}`;
                const annotation = `file=${filename},line=${a.Line},col=${a.Span[0]}::${msg}`;
                switch (a.Severity) {
                    case 'suggestion':
                        core.info(`::notice ${annotation}`);
                        break;
                    case 'warning':
                        core.info(`::warning ${annotation}`);
                        break;
                    default:
                        core.info(`::error ${annotation}`);
                        break;
                }
            }
        }
        yield core.summary
            .addHeading('Test Results')
            .addTable([
            [
                { data: 'File', header: true },
                { data: 'Result', header: true }
            ],
            ['foo.js', 'Pass ✅'],
            ['bar.js', 'Fail ❌'],
            ['test.js', 'Pass ✅']
        ])
            .addLink('View staging deployment!', 'https://github.com')
            .addCodeBlock(`pie title Pets adopted by volunteers
        "Dogs" : 386
        "Cats" : 85
        "Rats" : 15`, 'mermaid')
            .write();
    });
}
exports.annotate = annotate;
