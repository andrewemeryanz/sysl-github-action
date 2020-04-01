"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
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
const os = __importStar(require("os"));
const util = __importStar(require("util"));
const restm = __importStar(require("typed-rest-client/RestClient"));
const semver = __importStar(require("semver"));
const core = __importStar(require("@actions/core"));
const tc = __importStar(require("@actions/tool-cache"));
let osPlat = os.platform();
let osArch = os.arch();
class Release {
    constructor(tag) {
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
function install(version) {
    return __awaiter(this, void 0, void 0, function* () {
        const release = yield getRelease(version);
        process.stdout.write("Getting sysl version: " + release.version + os.EOL);
        // retrieve or download the binary
        let toolPath;
        toolPath = tc.find("sysl", release.version);
        if (!toolPath)
            toolPath = yield download(release);
        process.stdout.write("Sysl cached under " + toolPath + os.EOL);
        // add the cache directory to the path
        yield addToPath(toolPath);
    });
}
exports.install = install;
// Download the release into the cache directory.
function download(release) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const downloadUrl = getDownloadUrl(release.version);
            const downloadPath = yield tc.downloadTool(downloadUrl);
            const file = yield (osPlat == "win32" ? tc.extractZip(downloadPath) : tc.extractTar(downloadPath));
            return yield tc.cacheDir(file, "sysl", release.version); // install into the local tool cache
        }
        catch (error) {
            core.debug(error);
            throw `Failed to download version ${release}: ${error}`;
        }
    });
}
/**
 * Get the url to download the given version from.
 *
 * @param version A valid semver version. For example: 1.2.0
 */
function getDownloadUrl(version) {
    const platformMap = new Map([
        ["darwin", "macOS"],
        ["freebsd", "FreeBSD"],
        ["linux", "Linux"],
        ["openbsd", "OpenBSD"],
        ["win32", "Windows"]
    ]);
    const arch = osArch == "x64" ? "64" : "32";
    const extension = osPlat == "win32" ? "zip" : "tar.gz";
    let platform = platformMap.get(osPlat);
    if (platform == undefined)
        platform = osPlat;
    const filename = util.format("sysl_%s_%s-%sbit.%s", version, platform, arch, extension);
    return util.format("https://github.com/anz-bank/sysl/releases/download/v%s/%s", version, filename);
}
exports.getDownloadUrl = getDownloadUrl;
/**
 * Get the release to retrieve based on the given version.
 *
 * @param version A version match string. Accepts semver (1.2.0), partial (1.2) or x-trailing
 *                (1.2.x). Also accepts leading v (v1.2.0).
 */
function getRelease(version) {
    return __awaiter(this, void 0, void 0, function* () {
        if (version.startsWith("v"))
            version = version.slice(1, version.length); // strip leading `v`
        if (version.endsWith(".x"))
            version = version.slice(0, version.length - 2); // strip trailing .x
        let rest = new restm.RestClient("sysl-releases");
        let tags = (yield rest.get("https://api.github.com/repos/anz-bank/sysl/releases")).result || [];
        let releases = tags.map(t => new Release(t));
        releases = releases.sort(releaseComparison);
        releases = releases.filter(r => r.version.startsWith(version));
        if (releases.length === 0)
            throw new Error("unable to get latest version");
        core.debug(`evaluating ${releases.length} versions`);
        core.debug(`matched: ${releases[0].version}`);
        return releases[0];
    });
}
// Make partial versions semver compliant.
function normalizeVersion(version) {
    const versionPart = version.split(".");
    if (versionPart[1] == null)
        return version.concat(".0.0");
    if (versionPart[2] == null)
        return version.concat(".0");
    return version;
}
// Order first by prerelease state (stable releases first), then semver.
function releaseComparison(a, b) {
    if (a.prerelease == b.prerelease)
        return semver.rcompare(a.version, b.version);
    return a.prerelease ? 1 : -1;
}
// Add the given directory to the path.
function addToPath(dir) {
    return __awaiter(this, void 0, void 0, function* () {
        core.debug("add path: " + dir);
        core.addPath(dir);
    });
}
