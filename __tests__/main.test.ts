import io = require("@actions/io");
import path = require("path");
import os = require("os");
import fs = require("fs");
import nock = require("nock");

const toolDir = path.join(__dirname, "runner", "tools");
const tempDir = path.join(__dirname, "runner", "temp");
const dataDir = path.join(__dirname, "testdata");
const IS_WINDOWS = process.platform === "win32";

process.env["RUNNER_TEMP"] = tempDir;
process.env["RUNNER_TOOL_CACHE"] = toolDir;
import * as installer from "../src/installer";

describe("installer tests", () => {
    beforeEach(async function () {
        await io.rmRF(toolDir);
        await io.rmRF(tempDir);
        await io.mkdirP(toolDir);
        await io.mkdirP(tempDir);
    });

    afterAll(async () => {
        try {
            await io.rmRF(toolDir);
            await io.rmRF(tempDir);
        } catch {
            console.log("Failed to remove test directories");
        }
    });

    describe("Gets the latest stable release", () => {

        // releases.json
        // 1.1.0 - prerelease
        // 1.0.0
        // 0.28.0
        // 0.27.1
        // 0.27.0

        beforeEach(() => {
            nock("https://api.github.com")
                .get("/repos/anz-bank/sysl/releases")
                .replyWithFile(200, path.join(dataDir, "releases.json"));
        });

        afterEach(() => {
            nock.cleanAll();
            nock.enableNetConnect();
        });

        it("Gets the latest 0.27.x version: 0.27.1", async () => {
            mockDownloadUrl("0.27.1");
            await installer.install("0.27.x");
            expectMain("0.27.1");

        }, 10000);

        it("Gets the latest 1.x version: 1.0.0", async () => {
            mockDownloadUrl("1.0.0");
            await installer.install("1.x");
            expectMain("1.0.0");
        }, 10000);

        it("Gets the latest 1.1.x version: 1.1.0 prerelease match only", async () => {
            mockDownloadUrl("1.1.0");
            await installer.install("1.1.x");
            expectMain("1.1.0");
        }, 10000);
    });

});

function mockDownloadUrl(version: string) {
    const filename: string = IS_WINDOWS ? "sysl.zip" : "sysl.tar.gz";
    nock("https://github.com")
        .get(new URL(installer.getDownloadUrl(version)).pathname)
        .replyWithFile(200, path.join(dataDir, filename));
}

function expectMain(version: string) {
    const dir = path.join(toolDir, "sysl", version, os.arch());
    if (IS_WINDOWS) {
        expect(fs.existsSync(path.join(dir, "sysl.exe"))).toBe(true);
    } else {
        expect(fs.existsSync(path.join(dir, "sysl"))).toBe(true);
    }
}
