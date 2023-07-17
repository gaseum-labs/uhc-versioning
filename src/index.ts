import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import * as fs from 'fs';
import { GitHub } from '@actions/github/lib/utils';
import * as path from 'path';

type OctoKit = InstanceType<typeof GitHub>;

type VersionType = 'major' | 'minor' | 'patch';

export class Version {
	major: number;
	minor: number;
	patch: number;

	constructor(major: number, minor: number, patch: number) {
		this.major = major;
		this.minor = minor;
		this.patch = patch;
	}

	static parse(input: string): Version | undefined {
		if (!/^v\d+.\d+.\d+$/.test(input)) return undefined;

		const [major, minor, patch] = input
			.substring(1)
			.split('.')
			.map(str => Number.parseInt(str));

		return new Version(major, minor, patch);
	}

	toString(): string {
		return `v${this.major}.${this.minor}.${this.patch}`;
	}

	bump(versionType: VersionType): Version {
		if (versionType === 'major') {
			return new Version(this.major + 1, 0, 0);
		} else if (versionType === 'minor') {
			return new Version(this.major, this.minor + 1, 0);
		} else {
			return new Version(this.major, this.minor, this.patch + 1);
		}
	}

	greaterThan(other: Version) {
		if (this.major > other.major) return true;
		if (this.minor > other.minor) return true;
		return this.patch > other.patch;
	}
}

type GithubTag = Awaited<
	ReturnType<OctoKit['rest']['repos']['listTags']>
>['data'][number];

type GithubRelease = Awaited<
	ReturnType<OctoKit['rest']['repos']['getLatestRelease']>
>['data'];

const getLatestRelease = async (
	octokit: OctoKit,
): Promise<{ release: GithubRelease; version: Version } | undefined> => {
	const responseRelease = (
		await octokit.rest.repos
			.getLatestRelease({
				owner: context.repo.owner,
				repo: context.repo.repo,
			})
			.catch(() => undefined)
	)?.data;
	if (responseRelease === undefined) {
		console.log(`No existing release found`);
		return undefined;
	}

	const parsedVersion = Version.parse(responseRelease.tag_name);
	if (parsedVersion === undefined) {
		console.warn(
			`Latest release has INVALID version: "${responseRelease.tag_name}"`,
		);
		return undefined;
	}

	return { release: responseRelease, version: parsedVersion };
};

const isVersionType = (input: string): input is VersionType => {
	return input === 'major' || input === 'minor' || input === 'patch';
};

const run = async () => {
	const versionType = core.getInput('version_type');
	if (!isVersionType(versionType))
		throw Error(
			`Expected version_type to be one of "major", "minor", "patch", got "${versionType}" instead`,
		);

	const uploadFile = core.getInput('upload_file');
	if (!fs.existsSync(uploadFile))
		throw Error(`Upload file "${uploadFile}" does not exist`);

	const baseVersion = Version.parse(core.getInput('base_version'));
	if (baseVersion === undefined)
		throw Error(
			`base_version is not a valid version, got \"${baseVersion}\"`,
		);

	const token = process.env.GITHUB_TOKEN;
	if (token === undefined)
		throw Error('No GITHUB_TOKEN environment variable found');

	const octokit = getOctokit(token);

	const last = await getLatestRelease(octokit);

	const newVersion =
		last === undefined ? baseVersion : last.version.bump(versionType);

	console.log(`Last version: ${last?.version}, New version: ${newVersion}`);

	if (context.sha === last?.release?.target_commitish) {
		/* overwrite release version */
		octokit.rest.repos.updateRelease({
			owner: context.repo.owner,
			repo: context.repo.repo,
			release_id: last.release.id,
			tag_name: newVersion.toString(),
			name: newVersion.toString(),
		});
	} else {
		const newRelease = (
			await octokit.rest.repos.createRelease({
				owner: context.repo.owner,
				repo: context.repo.repo,
				tag_name: newVersion.toString(),
				name: newVersion.toString(),
				target_commitish: context.sha,
			})
		).data;

		await octokit.rest.repos.uploadReleaseAsset({
			owner: context.repo.owner,
			repo: context.repo.repo,
			release_id: newRelease.id,
			name: path.basename(uploadFile),
			data: fs.readFileSync(uploadFile).toString(),
		});
	}
};

run().catch(error =>
	error instanceof Error
		? core.setFailed(error)
		: core.setFailed(error?.toString()),
);
