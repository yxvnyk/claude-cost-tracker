const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const CLI_PATH = path.resolve(__dirname, "../bin/claude-cost-tracker.js");

function createTestDirectories(t) {
    const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "claude-cost-tracker-setup-")
    );
    const home = path.join(root, "home");
    const project = path.join(root, "project");

    fs.mkdirSync(home);
    fs.mkdirSync(project);

    t.after(() => {
        const relativePath = path.relative(os.tmpdir(), root);
        assert.ok(
            relativePath &&
                !relativePath.startsWith("..") &&
                !path.isAbsolute(relativePath),
            "test cleanup target must remain inside the OS temporary directory"
        );
        fs.rmSync(root, { recursive: true, force: true });
    });

    return { home, project };
}

function runCli(command, { home, project, local = false }) {
    return spawnSync(
        process.execPath,
        [
            CLI_PATH,
            command,
            ...(local ? ["--local"] : [])
        ],
        {
            cwd: project,
            encoding: "utf8",
            env: {
                ...process.env,
                HOME: home,
                USERPROFILE: home
            }
        }
    );
}

test("setup configures Claude Code globally by default", t => {
    const directories = createTestDirectories(t);
    const result = runCli("setup", directories);
    const globalSettingsPath = path.join(
        directories.home,
        ".claude",
        "settings.json"
    );

    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(globalSettingsPath));
    const globalSettings = JSON.parse(
        fs.readFileSync(globalSettingsPath, "utf8")
    );
    assert.equal(
        globalSettings.statusLine.command,
        `node "${CLI_PATH}" proxy`
    );
    assert.ok(
        !fs.existsSync(path.join(directories.project, ".claude", "settings.json"))
    );
});

test("setup --local configures only the current project", t => {
    const directories = createTestDirectories(t);
    const result = runCli("setup", { ...directories, local: true });
    const localSettingsPath = path.join(
        directories.project,
        ".claude",
        "settings.json"
    );

    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(localSettingsPath));
    const localSettings = JSON.parse(
        fs.readFileSync(localSettingsPath, "utf8")
    );
    assert.equal(
        localSettings.statusLine.command,
        `node "${CLI_PATH}" proxy`
    );
    assert.ok(!fs.existsSync(path.join(directories.home, ".claude")));
});

test("install is no longer accepted as a CLI command", t => {
    const directories = createTestDirectories(t);
    const result = runCli("install", directories);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /claude-cost-tracker setup/);
    assert.ok(!fs.existsSync(path.join(directories.home, ".claude")));
});
