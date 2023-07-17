"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = __importDefault(require("@actions/core"));
const github_1 = require("@actions/github");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class Version {
    major;
    minor;
    patch;
    constructor(major, minor, patch) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
    }
    static parse(input) {
        if (!/^v\d+.\d+.\d+$/.test(input))
            return undefined;
        const [major, minor, patch] = input
            .substring(1)
            .split('.')
            .map(Number.parseInt);
        return new Version(major, minor, patch);
    }
    toString() {
        return `v${this.major}.${this.minor}.${this.patch}`;
    }
    bump(versionType) {
        if (versionType === 'major') {
            return new Version(this.major + 1, 0, 0);
        }
        else if (versionType === 'minor') {
            return new Version(this.major, this.minor + 1, 0);
        }
        else {
            return new Version(this.major, this.minor, this.patch + 1);
        }
    }
    greaterThan(other) {
        if (this.major > other.major)
            return true;
        if (this.minor > other.minor)
            return true;
        return this.patch > other.patch;
    }
}
const getLatestRelease = async (octokit, baseVersion) => {
    const responseRelease = (await octokit.rest.repos
        .getLatestRelease({
        owner: github_1.context.repo.owner,
        repo: github_1.context.repo.repo,
    })
        .catch(() => undefined))?.data;
    if (responseRelease === undefined) {
        console.log(`No existing release found, using base version ${baseVersion}`);
        return { version: baseVersion, release: undefined };
    }
    const parsedVersion = Version.parse(responseRelease.tag_name);
    if (parsedVersion === undefined) {
        console.warn(`Latest release has INVALID version: "${responseRelease.tag_name}", reverting to base version ${baseVersion}`);
        return { version: baseVersion, release: undefined };
    }
    return { release: responseRelease, version: parsedVersion };
};
const isVersionType = (input) => {
    return input === 'major' || input === 'minor' || input === 'patch';
};
const run = async () => {
    const versionType = core_1.default.getInput('version_type');
    if (!isVersionType(versionType))
        throw Error(`Expected version_type to be one of "major", "minor", "patch", got "${versionType}" instead`);
    const uploadFile = core_1.default.getInput('upload_file');
    if (!fs_1.default.existsSync(uploadFile))
        throw Error(`Upload file "${uploadFile}" does not exist`);
    const baseVersion = Version.parse(core_1.default.getInput('base_version'));
    if (baseVersion === undefined)
        throw Error(`base_version is not a valid version, got \"${baseVersion}\"`);
    const token = process.env.GITHUB_TOKEN;
    if (token === undefined)
        throw Error('No GITHUB_TOKEN environment variable found');
    const octokit = (0, github_1.getOctokit)(token);
    const { version: lastVersion, release: lastRelease } = await getLatestRelease(octokit, baseVersion);
    const newVersion = lastVersion.bump(versionType);
    console.log(`Last version: ${lastVersion}, New version: ${newVersion}`);
    if (github_1.context.sha === lastRelease?.target_commitish) {
        /* overwrite release version */
        octokit.rest.repos.updateRelease({
            owner: github_1.context.repo.owner,
            repo: github_1.context.repo.repo,
            release_id: lastRelease.id,
            tag_name: newVersion.toString(),
            name: newVersion.toString(),
        });
    }
    else {
        const newRelease = (await octokit.rest.repos.createRelease({
            owner: github_1.context.repo.owner,
            repo: github_1.context.repo.repo,
            tag_name: newVersion.toString(),
            name: newVersion.toString(),
            target_commitish: github_1.context.sha,
        })).data;
        await octokit.rest.repos.uploadReleaseAsset({
            owner: github_1.context.repo.owner,
            repo: github_1.context.repo.repo,
            release_id: newRelease.id,
            name: path_1.default.basename(uploadFile),
            data: fs_1.default.readFileSync(uploadFile).toString(),
        });
    }
};
run().catch(error => error instanceof Error
    ? core_1.default.setFailed(error)
    : core_1.default.setFailed(error?.toString()));
