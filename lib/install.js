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
exports.installVale = exports.installTool = void 0;
const core = __importStar(require("@actions/core"));
const tc = __importStar(require("@actions/tool-cache"));
const request = __importStar(require("request-promise-native"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const releases = 'https://github.com/errata-ai/vale/releases/download';
const last = 'https://github.com/errata-ai/vale/releases/latest/';
function installTool(name, url) {
    return __awaiter(this, void 0, void 0, function* () {
        let extractedDir = '';
        const archivePath = yield tc.downloadTool(url);
        const args = ['xz'];
        if (process.platform.toString() != 'darwin') {
            args.push('--overwrite');
        }
        extractedDir = yield tc.extractTar(archivePath, process.env.HOME, args);
        return path_1.default.join(extractedDir, name);
    });
}
exports.installTool = installTool;
function installVale(version) {
    return __awaiter(this, void 0, void 0, function* () {
        core.info(`Installing Vale version '${version}' ...`);
        if (version === 'latest') {
            yield request.get(last, function (e, response) {
                const vs = response.request.uri.href;
                const parts = vs.split(`/`);
                version = parts[parts.length - 1].substring(1);
            });
        }
        let ext = 'tar.gz';
        let platform = os_1.default.platform().toString();
        switch (platform) {
            case 'win32':
                platform = 'Windows';
                ext = 'zip';
                break;
            case 'darwin':
                platform = 'macOS';
                break;
            case 'linux':
                platform = 'Linux';
                break;
        }
        let arch = os_1.default.arch();
        switch (arch) {
            case 'x64':
                arch = '64-bit';
                break;
        }
        const url = releases + `/v${version}/vale_${version}_${platform}_${arch}.tar.gz`;
        return installTool('vale', url);
    });
}
exports.installVale = installVale;
