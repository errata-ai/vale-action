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
exports.parsePatch = exports.modifiedFiles = exports.wasLineAddedInPR = void 0;
const github = __importStar(require("@actions/github"));
const core = __importStar(require("@actions/core"));
const API = github.getOctokit(process.env.GITHUB_TOKEN);
const CTX = github.context;
const cache = {};
function wasLineAddedInPR(file, line) {
    let lines = [];
    const key = file.name + file.sha;
    if (key in cache) {
        lines = cache[key];
    }
    else {
        lines = parsePatch(file.patch);
        cache[key] = lines;
    }
    return lines.includes(line);
}
exports.wasLineAddedInPR = wasLineAddedInPR;
function modifiedFiles() {
    return __awaiter(this, void 0, void 0, function* () {
        let files = [];
        let commits = yield getCommits();
        if (CTX.payload.repository) {
            const repo = CTX.payload.repository;
            const name = repo.owner.login || repo.owner.name;
            yield Promise.all(commits.map((commit) => __awaiter(this, void 0, void 0, function* () {
                const resp = yield API.repos.getCommit({
                    owner: name,
                    repo: repo.name,
                    ref: commit
                });
                resp.data.files.forEach(file => {
                    if (file.status == 'modified' || file.status == 'added') {
                        let entry = {
                            name: file.filename,
                            patch: file.patch,
                            sha: commit
                        };
                        files.push(entry);
                    }
                });
            })));
        }
        else {
            core.error('Repo not set');
        }
        return files;
    });
}
exports.modifiedFiles = modifiedFiles;
function getCommits() {
    return __awaiter(this, void 0, void 0, function* () {
        let commits = [];
        switch (CTX.eventName) {
            case 'pull_request':
                if (CTX.payload.pull_request && CTX.payload.repository) {
                    const url = CTX.payload.pull_request.commits_url;
                    const repo = CTX.payload.repository;
                    const resp = yield API.request(`GET ${url}`, {
                        owner: repo.owner.login || repo.owner.name,
                        repo: repo.name
                    });
                    resp.data.forEach((commit) => {
                        commits.push(commit.sha);
                    });
                }
                else {
                    core.warning(`Unable to retrieve PR info.`);
                    core.warning(`PR: ${CTX.payload.pull_request}, Repo: ${CTX.payload.repository}`);
                }
                break;
            case 'push':
                CTX.payload.commits.forEach((commit) => {
                    commits.push(commit.id);
                });
                break;
            default:
                core.warning(`Unrecognized event: ${CTX.eventName}`);
        }
        return commits;
    });
}
function parsePatch(patch) {
    let lines = [];
    let start = 0;
    let position = 0;
    patch.split(/(?:\r\n|\r|\n)/g).forEach(line => {
        if (line.startsWith('@@')) {
            const added = line.split(' ')[2].split(',')[0];
            start = parseInt(added, 10);
        }
        else if (line.startsWith('+')) {
            lines.push(start + position);
        }
        if (!line.startsWith('-') && !line.startsWith('@@')) {
            position++;
        }
    });
    return lines;
}
exports.parsePatch = parsePatch;
