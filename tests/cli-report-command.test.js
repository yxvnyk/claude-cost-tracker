const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const CLI_PATH = path.resolve(
    __dirname,
    "../bin/claude-cost-tracker.js"
);

function createTestDirectories(t) {
    const root = fs.mkdtempSync(
        path.join(
            os.tmpdir(),
            "claude-cost-tracker-report-"
        )
    );
    const home = path.join(root, "home");
    const project = path.join(root, "project");

    fs.mkdirSync(home);
    fs.mkdirSync(project);

    t.after(() => {
        const relativePath = path.relative(
            os.tmpdir(),
            root
        );

        assert.ok(
            relativePath &&
                !relativePath.startsWith("..") &&
                !path.isAbsolute(relativePath),
            "test cleanup target must remain inside the OS temporary directory"
        );

        fs.rmSync(root, {
            recursive: true,
            force: true
        });
    });

    return { home, project };
}

function runCli(args, { home, project }) {
    return spawnSync(
        process.execPath,
        [CLI_PATH, ...args],
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

function writeJsonFile(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
        filePath,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

const FIXTURE_SESSION = {
    session_id: "test-session-abc",
    session_name: "My Test Session",
    model: "claude-sonnet-4",
    created_at: "2026-10-15T10:00:00.000Z",
    updated_at: "2026-10-15T11:00:00.000Z",
    total_cost_usd: 0.25,
    checkpoints: [
        {
            name: "analysis",
            model: "claude-sonnet-4",
            cost_usd: 0.10,
            cost_before: 0,
            cost_after: 0.10,
            timestamp_before: null,
            timestamp_after: "2026-10-15T10:30:00.000Z",
            time: null
        },
        {
            name: "implementation",
            model: "claude-sonnet-4",
            cost_usd: 0.15,
            cost_before: 0.10,
            cost_after: 0.25,
            timestamp_before: "2026-10-15T10:30:00.000Z",
            timestamp_after: "2026-10-15T11:00:00.000Z",
            time: "00:30:00"
        }
    ]
};

test(
    "report exits non-zero with error when .claude-cost-tracker/ is absent",
    t => {
        const dirs = createTestDirectories(t);
        // No .claude-cost-tracker directory created

        const result = runCli(["report"], dirs);

        assert.notEqual(result.status, 0, "should exit non-zero");
        assert.match(
            result.stderr,
            /not set up/i,
            "stderr should mention 'not set up'"
        );
    }
);

test(
    "report exits 0 with info message when tracker dir exists but no sessions",
    t => {
        const dirs = createTestDirectories(t);
        // Create empty sessions dir
        fs.mkdirSync(
            path.join(dirs.project, ".claude-cost-tracker", "sessions"),
            { recursive: true }
        );

        const result = runCli(["report"], dirs);

        assert.equal(result.status, 0, result.stderr);
        assert.match(
            result.stdout,
            /No sessions/i,
            "stdout should mention 'No sessions'"
        );
    }
);

test(
    "report with sessions writes report.html, prints its path, and file contains session name",
    t => {
        const dirs = createTestDirectories(t);
        const sessionsDir = path.join(
            dirs.project,
            ".claude-cost-tracker",
            "sessions"
        );
        writeJsonFile(
            path.join(sessionsDir, `${FIXTURE_SESSION.session_id}.json`),
            FIXTURE_SESSION
        );

        const result = runCli(["report"], dirs);

        assert.equal(result.status, 0, result.stderr);

        const expectedPath = path.join(
            dirs.project,
            ".claude-cost-tracker",
            "report.html"
        );
        assert.ok(
            fs.existsSync(expectedPath),
            "report.html should exist at expected path"
        );
        assert.match(
            result.stdout,
            /report\.html/,
            "stdout should contain 'report.html'"
        );

        const content = fs.readFileSync(expectedPath, "utf8");
        assert.ok(
            content.includes("My Test Session"),
            "report.html should contain the session name"
        );
    }
);

test(
    "report overwrites report.html on second run and exits 0",
    t => {
        const dirs = createTestDirectories(t);
        const sessionsDir = path.join(
            dirs.project,
            ".claude-cost-tracker",
            "sessions"
        );
        writeJsonFile(
            path.join(sessionsDir, `${FIXTURE_SESSION.session_id}.json`),
            FIXTURE_SESSION
        );

        const first = runCli(["report"], dirs);
        assert.equal(first.status, 0, first.stderr);

        const reportPath = path.join(
            dirs.project,
            ".claude-cost-tracker",
            "report.html"
        );
        const mtimeBefore = fs.statSync(reportPath).mtimeMs;

        // Brief delay to ensure mtime differs on fast systems
        const end = Date.now() + 20;
        while (Date.now() < end) { /* spin */ }

        const second = runCli(["report"], dirs);
        assert.equal(second.status, 0, second.stderr);

        const mtimeAfter = fs.statSync(reportPath).mtimeMs;
        assert.ok(
            mtimeAfter >= mtimeBefore,
            "report.html mtime should be updated on second run"
        );

        const content = fs.readFileSync(reportPath, "utf8");
        assert.ok(
            content.includes("My Test Session"),
            "report.html should still contain session data after overwrite"
        );
    }
);

test(
    "report lists sessions newest-to-oldest by created_at",
    t => {
        const dirs = createTestDirectories(t);
        const sessionsDir = path.join(
            dirs.project,
            ".claude-cost-tracker",
            "sessions"
        );
        const older = {
            ...FIXTURE_SESSION,
            session_id: "older-session",
            session_name: "Older Session",
            created_at: "2026-09-01T00:00:00.000Z",
            checkpoints: []
        };
        const newer = {
            ...FIXTURE_SESSION,
            session_id: "newer-session",
            session_name: "Newer Session",
            created_at: "2026-10-15T00:00:00.000Z",
            checkpoints: []
        };
        writeJsonFile(path.join(sessionsDir, "older.json"), older);
        writeJsonFile(path.join(sessionsDir, "newer.json"), newer);

        const result = runCli(["report"], dirs);
        assert.equal(result.status, 0, result.stderr);

        const reportPath = path.join(
            dirs.project,
            ".claude-cost-tracker",
            "report.html"
        );
        const content = fs.readFileSync(reportPath, "utf8");
        const olderPos = content.indexOf("Older Session");
        const newerPos = content.indexOf("Newer Session");
        assert.ok(newerPos !== -1, "report should contain Newer Session");
        assert.ok(olderPos !== -1, "report should contain Older Session");
        assert.ok(
            newerPos < olderPos,
            "Newer Session should appear before Older Session in the report"
        );
    }
);
