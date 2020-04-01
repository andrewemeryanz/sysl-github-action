import * as os from "os";
import * as util from "util";
import * as restm from "typed-rest-client/RestClient";
import * as semver from "semver";
import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

let osPlat: string = os.platform();
let osArch: string = os.arch();

interface Tag {
    tag_name: string;
    prerelease: boolean;
}

class Release implements Release {
    version: string;
    prerelease: boolean;

    constructor(tag: Tag) {
        const v = (tag.tag_name.startsWith("v")) ? tag.tag_name.slice(1, tag.tag_name.length) : tag.tag_name; // strip leading `v`
        this.version = normalizeVersion(v);
        this.prerelease = tag.prerelease;
    }
}

/**
 * Install the sysl binary for the given version.
 *
 * @param version A version match string. Accepts semver (1.2.0), partial (1.2) or x-trailing
 *                (1.2.x). Also accepts leading v (v1.2.0).
 */
export async function install(version: string) {
    const release = await getRelease(version);
    process.stdout.write("Getting sysl version: " + release.version + os.EOL);

    // retrieve or download the binary
    let toolPath: string;
    toolPath = tc.find("sysl", release.version);
    if (!toolPath) toolPath = await download(release);
    process.stdout.write("Sysl cached under " + toolPath + os.EOL);

    // add the cache directory to the path
    await addToPath(toolPath)
}

// Download the release into the cache directory.
async function download(release: Release): Promise<string> {
    try {
        const downloadUrl = getDownloadUrl(release.version);
        const downloadPath = await tc.downloadTool(downloadUrl);
        const file: string = await (osPlat == "win32" ? tc.extractZip(downloadPath) : tc.extractTar(downloadPath));
        return await tc.cacheDir(file, "sysl", release.version); // install into the local tool cache
    } catch (error) {
        core.debug(error);
        throw `Failed to download version ${release}: ${error}`;
    }
}

/**
 * Get the url to download the given version from.
 *
 * @param version A valid semver version. For example: 1.2.0
 */
export function getDownloadUrl(version: string): string {
    const platformMap: Map<string, string> = new Map([
        ["darwin", "macOS"],
        ["freebsd", "FreeBSD"],
        ["linux", "Linux"],
        ["openbsd", "OpenBSD"],
        ["win32", "Windows"]
    ]);

    const arch: string = osArch == "x64" ? "64" : "32";
    const extension: string = osPlat == "win32" ? "zip" : "tar.gz";
    let platform = platformMap.get(osPlat);
    if (platform == undefined) platform = osPlat;
    const filename = util.format("sysl_%s_%s-%sbit.%s", version, platform, arch, extension);
    return util.format("https://github.com/anz-bank/sysl/releases/download/v%s/%s", version, filename);
}

/**
 * Get the release to retrieve based on the given version.
 *
 * @param version A version match string. Accepts semver (1.2.0), partial (1.2) or x-trailing
 *                (1.2.x). Also accepts leading v (v1.2.0).
 */
async function getRelease(version: string): Promise<Release> {
    if (version.startsWith("v")) version = version.slice(1, version.length); // strip leading `v`
    if (version.endsWith(".x")) version = version.slice(0, version.length - 2); // strip trailing .x

    let rest = new restm.RestClient("sysl-releases");
    let tags: Tag[] = (await rest.get<Tag[]>(
        "https://api.github.com/repos/anz-bank/sysl/releases"
    )).result || [];

    let releases = tags.map(t => new Release(t));
    releases = releases.sort(releaseComparison);
    releases = releases.filter(r => r.version.startsWith(version));

    if (releases.length === 0) throw new Error("unable to get latest version");

    core.debug(`evaluating ${releases.length} versions`);
    core.debug(`matched: ${releases[0].version}`);

    return releases[0];
}

// Make partial versions semver compliant.
function normalizeVersion(version: string): string {
    const versionPart = version.split(".");
    if (versionPart[1] == null) return version.concat(".0.0");
    if (versionPart[2] == null) return version.concat(".0");
    return version;
}

// Order first by prerelease state (stable releases first), then semver.
function releaseComparison(a: Release, b: Release) {
    if (a.prerelease == b.prerelease) return semver.rcompare(a.version, b.version);
    return a.prerelease ? 1 : -1;
}

// Add the given directory to the path.
async function addToPath(dir: string) {
    core.debug("add path: " + dir);
    core.addPath(dir);
}