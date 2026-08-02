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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installLint = installLint;
exports.installReviewDog = installReviewDog;
const core = __importStar(require("@actions/core"));
const io = __importStar(require("@actions/io"));
const tc = __importStar(require("@actions/tool-cache"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const path_1 = __importDefault(require("path"));
const releases = 'https://github.com/vale-cli/vale/releases/download';
const last = 'https://github.com/vale-cli/vale/releases/latest/';
/**
 * The platforms Vale publishes a binary for, by Node's own names for them.
 *
 * Anything missing here has no release to download -- Windows on ARM, most
 * notably -- so we say as much instead of asking for a URL that isn't there.
 *
 * See https://github.com/vale-cli/vale/blob/v3/.goreleaser.yml.
 */
const valePlatforms = {
    'darwin-arm64': 'macOS_arm64',
    'darwin-x64': 'macOS_64-bit',
    'linux-arm64': 'Linux_arm64',
    'linux-x64': 'Linux_64-bit',
    'win32-x64': 'Windows_64-bit'
};
/**
 * The same, for reviewdog -- which names its platforms differently and ships
 * a tarball for Windows too.
 */
const reviewdogPlatforms = {
    'darwin-arm64': 'Darwin_arm64',
    'darwin-x64': 'Darwin_x86_64',
    'linux-arm64': 'Linux_arm64',
    'linux-x64': 'Linux_x86_64',
    'win32-arm64': 'Windows_arm64',
    'win32-x64': 'Windows_x86_64'
};
const isWindows = process.platform === 'win32';
/**
 * `platform` names the runner in the way the given project's releases do.
 */
function platform(tool, names) {
    const host = `${process.platform}-${process.arch}`;
    const name = names[host];
    if (name === undefined) {
        throw new Error(`${tool} doesn't publish a binary for '${host}'.`);
    }
    return name;
}
/**
 * `unpack` extracts a downloaded archive and returns the tool within it.
 *
 * We have to be told the format: `downloadTool` saves to a random name, so
 * the path it hands back says nothing about what's inside.
 */
function unpack(archivePath, name, format) {
    return __awaiter(this, void 0, void 0, function* () {
        const extractedDir = format === 'zip'
            ? yield tc.extractZip(archivePath)
            : yield tc.extractTar(archivePath);
        return path_1.default.join(extractedDir, isWindows ? `${name}.exe` : name);
    });
}
function lookupLint() {
    return __awaiter(this, void 0, void 0, function* () {
        // `which` fails loudly, which is what we want here: nothing to find means
        // the user's `version: none` is pointing at an install that isn't there.
        const exePath = yield io.which('vale', true);
        core.info(`Using the install at ${exePath}`);
        return exePath;
    });
}
function installLint(version) {
    return __awaiter(this, void 0, void 0, function* () {
        if (version === 'none') {
            core.info(`Assuming a version of vale is already available.`);
            return yield lookupLint();
        }
        core.info(`Installing Vale version '${version}' ...`);
        if (version === 'latest') {
            const response = yield (0, node_fetch_1.default)(last);
            const vs = response.url;
            const parts = vs.split(`/`);
            version = parts[parts.length - 1].substring(1);
        }
        const asset = platform('Vale', valePlatforms);
        const ext = isWindows ? 'zip' : 'tar.gz';
        const url = releases + `/v${version}/vale_${version}_${asset}.${ext}`;
        const archivePath = yield tc.downloadTool(url);
        const lintPath = yield unpack(archivePath, 'vale', ext);
        core.info(`Installed version '${version}' into '${lintPath}'.`);
        return lintPath;
    });
}
function installReviewDog(version, url) {
    return __awaiter(this, void 0, void 0, function* () {
        core.info(`Installing ReviewDog version '${version}' ...`);
        if (!url) {
            const asset = platform('reviewdog', reviewdogPlatforms);
            url =
                `https://github.com/reviewdog/reviewdog/releases/download/v${version}` +
                    `/reviewdog_${version}_${asset}.tar.gz`;
        }
        const archivePath = yield tc.downloadTool(url);
        const reviewdogPath = yield unpack(archivePath, 'reviewdog', 'tar.gz');
        core.info(`Installed reviewdog from '${url}' into '${reviewdogPath}'.`);
        return reviewdogPath;
    });
}
