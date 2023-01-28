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
        var alertsMap = new Map();
        var alertTable = [];
        var files = 0;
        var totalAlerts = 0;
        var suggestions = 0;
        var warnings = 0;
        var errors = 0;
        for (const filename of Object.getOwnPropertyNames(alerts)) {
            files += 1;
            for (const a of alerts[filename]) {
                totalAlerts += 1;
                if (alertsMap.has(a.Check)) {
                    alertsMap.set(a.Check, alertsMap.get(a.Check) + 1);
                }
                else {
                    alertsMap.set(a.Check, 1);
                }
                alertTable.push([filename, a.Check, a.Message]);
                const msg = `[${a.Check}] ${a.Message}`;
                const annotation = `file=${filename},line=${a.Line},col=${a.Span[0]}::${msg}`;
                switch (a.Severity) {
                    case 'suggestion':
                        core.info(`::notice ${annotation}`);
                        suggestions += 1;
                        break;
                    case 'warning':
                        core.info(`::warning ${annotation}`);
                        warnings += 1;
                        break;
                    default:
                        core.info(`::error ${annotation}`);
                        errors += 1;
                        break;
                }
            }
        }
        var chart = 'pie title Annotations by rule';
        for (let [key, value] of alertsMap) {
            chart += `\n"${key}" : ${value}`;
        }
        yield core.summary
            .addHeading('Analysis :mag:')
            .addQuote(`<b>${totalAlerts}</b> alerts (${suggestions} <code>suggestion</code>, ${warnings} <code>warning</code>, and ${errors} <code>error</code>) in <b>${files}</b> file(s).`)
            .addRaw(`<div align="center">
<table>
<thead>
<tr>
<th><a href="https://vale.sh/docs/vale-cli/installation/">Documentation</a></th>
<th><a href="https://vale.sh/hub/">Package Hub</a></th>
<th><a href="https://vale.sh/explorer/">Rule Explorer</a></th>
<th><a href="https://vale.sh/generator/">Config Generator</a></th>
</tr>
</thead>
</table>
</div>`, true)
            .addHeading('Annotation Breakdown', 2)
            .addCodeBlock(chart, 'mermaid')
            /*.addTable([
              [
                {data: 'File', header: true},
                {data: 'Rule', header: true},
                {data: 'Message', header: true}
              ],
              ...alertTable
            ])*/
            .write();
    });
}
exports.annotate = annotate;
