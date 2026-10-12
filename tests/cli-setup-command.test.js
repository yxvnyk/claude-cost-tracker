const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const CLI_PATH = path.resolve(__dirname, "../bin/claude-cost-tracker.js");
const LOCAL_TRACKER_GITIGNORE_CONTENT = [
    "# ClaudeCostTracker data files — local to each machine, not for committing.",
    "# Ignore everything in .claude-cost-tracker/ except this file itself, so transient",
    "# files (the database, daemon.pid, sockets, logs) never show up in git.",
    "*",
    "!.gitignore",
    ""
].join("\n");

function getLocalTrackerPath(project, ...segments) {
    return path.join(
        project,
        ".claude-cost-tracker",
        ...segments
    );
}

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

test(
    "setup configures Claude Code globally by default without creating project-local tracker files",
    t => {
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
        assert.ok(
            !fs.existsSync(
                getLocalTrackerPath(directories.project)
            )
        );
    }
);

test(
    "setup --local configures only the current project and writes the tracker ignore policy",
    t => {
        const directories = createTestDirectories(t);
        const result = runCli("setup", { ...directories, local: true });
        const localSettingsPath = path.join(
            directories.project,
            ".claude",
            "settings.json"
        );
        const localTrackerConfigPath =
            getLocalTrackerPath(
                directories.project,
                "config.json"
            );
        const localTrackerBackupPath =
            getLocalTrackerPath(
                directories.project,
                "original-statusline.json"
            );
        const localTrackerGitignorePath =
            getLocalTrackerPath(
                directories.project,
                ".gitignore"
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
        assert.ok(fs.existsSync(localTrackerConfigPath));
        assert.ok(fs.existsSync(localTrackerBackupPath));
        assert.ok(fs.existsSync(localTrackerGitignorePath));
        assert.equal(
            fs.readFileSync(localTrackerGitignorePath, "utf8"),
            LOCAL_TRACKER_GITIGNORE_CONTENT
        );
        assert.ok(!fs.existsSync(path.join(directories.home, ".claude")));
        assert.ok(
            !fs.existsSync(
                path.join(
                    directories.home,
                    ".claude-cost-tracker"
                )
            )
        );
    }
);

test(
    "setup --local backfills the tracker ignore policy when rerun",
    t => {
        const directories = createTestDirectories(t);
        const localSetupOptions = {
            ...directories,
            local: true
        };
        const localTrackerConfigPath =
            getLocalTrackerPath(
                directories.project,
                "config.json"
            );
        const localTrackerGitignorePath =
            getLocalTrackerPath(
                directories.project,
                ".gitignore"
            );
        const localSettingsPath = path.join(
            directories.project,
            ".claude",
            "settings.json"
        );
        const initialResult = runCli(
            "setup",
            localSetupOptions
        );

        assert.equal(
            initialResult.status,
            0,
            initialResult.stderr
        );
        assert.ok(
            fs.existsSync(localTrackerGitignorePath)
        );

        fs.unlinkSync(localTrackerGitignorePath);

        const rerunResult = runCli(
            "setup",
            localSetupOptions
        );

        assert.equal(
            rerunResult.status,
            0,
            rerunResult.stderr
        );
        assert.ok(fs.existsSync(localSettingsPath));
        assert.ok(fs.existsSync(localTrackerConfigPath));
        assert.ok(
            fs.existsSync(localTrackerGitignorePath)
        );
        assert.equal(
            fs.readFileSync(localTrackerGitignorePath, "utf8"),
            LOCAL_TRACKER_GITIGNORE_CONTENT
        );
    }
);

test(
    "setup --local preserves an existing tracker ignore file on rerun",
    t => {
        const directories = createTestDirectories(t);
        const localSetupOptions = {
            ...directories,
            local: true
        };
        const localTrackerGitignorePath =
            getLocalTrackerPath(
                directories.project,
                ".gitignore"
            );
        const customGitignoreContent =
            "# custom tracker ignore rules\n" +
            "*\n" +
            "!.gitignore\n" +
            "!keep-me.txt\n";
        const initialResult = runCli(
            "setup",
            localSetupOptions
        );

        assert.equal(
            initialResult.status,
            0,
            initialResult.stderr
        );

        fs.writeFileSync(
            localTrackerGitignorePath,
            customGitignoreContent,
            "utf8"
        );

        const rerunResult = runCli(
            "setup",
            localSetupOptions
        );

        assert.equal(
            rerunResult.status,
            0,
            rerunResult.stderr
        );
        assert.equal(
            fs.readFileSync(localTrackerGitignorePath, "utf8"),
            customGitignoreContent
        );
    }
);

test("install is no longer accepted as a CLI command", t => {
    const directories = createTestDirectories(t);
    const result = runCli("install", directories);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /claude-cost-tracker setup/);
    assert.ok(!fs.existsSync(path.join(directories.home, ".claude")));
});
