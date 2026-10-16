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
            "claude-cost-tracker-doctor-"
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

function runCli(
    args,
    {
        home,
        project
    }
) {
    return spawnSync(
        process.execPath,
        [
            CLI_PATH,
            ...args
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

function writeJsonFile(
    filePath,
    data
) {
    fs.mkdirSync(
        path.dirname(filePath),
        { recursive: true }
    );

    fs.writeFileSync(
        filePath,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

function getGlobalSettingsPath(home) {
    return path.join(
        home,
        ".claude",
        "settings.json"
    );
}

function getLocalTrackerPath(
    project,
    ...segments
) {
    return path.join(
        project,
        ".claude-cost-tracker",
        ...segments
    );
}

function getGlobalTrackerPath(
    home,
    ...segments
) {
    return path.join(
        home,
        ".claude-cost-tracker",
        ...segments
    );
}

test(
    "doctor reports that the global scope is not set up and suggests setup",
    t => {
        const directories =
            createTestDirectories(t);

        const result = runCli(
            ["doctor"],
            directories
        );

        assert.equal(
            result.status,
            0,
            result.stderr
        );
        assert.match(
            result.stdout,
            /Claude Cost Tracker Health Check/
        );
        assert.match(
            result.stdout,
            /Scope: global/
        );
        assert.match(
            result.stdout,
            /✗ Not set up/
        );
        assert.match(
            result.stdout,
            /claude-cost-tracker setup/
        );
        assert.doesNotMatch(
            result.stdout,
            /\.claude-cost-tracker\/config\.json/
        );
        assert.doesNotMatch(
            result.stdout,
            /\u001b\[/
        );
    }
);

test(
    "doctor --local reports that the project scope is not set up and suggests local setup",
    t => {
        const directories =
            createTestDirectories(t);

        const result = runCli(
            ["doctor", "--local"],
            directories
        );

        assert.equal(
            result.status,
            0,
            result.stderr
        );
        assert.match(
            result.stdout,
            /Scope: project/
        );
        assert.match(
            result.stdout,
            /✗ Not set up/
        );
        assert.match(
            result.stdout,
            /claude-cost-tracker setup --local/
        );
        assert.doesNotMatch(
            result.stdout,
            /\.claude-cost-tracker\/config\.json/
        );
    }
);

test(
    "doctor --local shows global fallback as the effective downstream command source",
    t => {
        const directories =
            createTestDirectories(t);

        writeJsonFile(
            getGlobalSettingsPath(
                directories.home
            ),
            {
                statusLine: {
                    type: "command",
                    command:
                        "npx -y ccstatusline@latest"
                }
            }
        );

        const setupResult = runCli(
            ["setup", "--local"],
            directories
        );

        assert.equal(
            setupResult.status,
            0,
            setupResult.stderr
        );

        const result = runCli(
            ["doctor", "--local"],
            directories
        );

        assert.equal(
            result.status,
            0,
            result.stderr
        );
        assert.match(
            result.stdout,
            /✓ Set up/
        );
        assert.match(
            result.stdout,
            /Downstream command source: global fallback/
        );
        assert.match(
            result.stdout,
            /npx -y ccstatusline@latest/
        );
    }
);

test(
    "doctor --local --fix recreates a missing local tracker gitignore",
    t => {
        const directories =
            createTestDirectories(t);

        const setupResult = runCli(
            ["setup", "--local"],
            directories
        );

        assert.equal(
            setupResult.status,
            0,
            setupResult.stderr
        );

        const gitignorePath =
            getLocalTrackerPath(
                directories.project,
                ".gitignore"
            );

        fs.unlinkSync(gitignorePath);

        const result = runCli(
            ["doctor", "--local", "--fix"],
            directories
        );

        assert.equal(
            result.status,
            0,
            result.stderr
        );
        assert.ok(
            fs.existsSync(gitignorePath)
        );
        assert.match(
            result.stdout,
            /Fix applied: recreated .*\.claude-cost-tracker[\\/]\.gitignore/
        );
        assert.match(
            result.stdout,
            /Effective downstream behavior preserved/
        );
    }
);

test(
    "doctor --local --fix recreates local config from readable global fallback even when local backup is missing",
    t => {
        const directories =
            createTestDirectories(t);
        const globalCommand =
            "npx -y ccstatusline@latest";

        writeJsonFile(
            getGlobalSettingsPath(
                directories.home
            ),
            {
                statusLine: {
                    type: "command",
                    command:
                        globalCommand
                }
            }
        );

        const setupResult = runCli(
            ["setup", "--local"],
            directories
        );

        assert.equal(
            setupResult.status,
            0,
            setupResult.stderr
        );

        const localConfigPath =
            getLocalTrackerPath(
                directories.project,
                "config.json"
            );
        const localBackupPath =
            getLocalTrackerPath(
                directories.project,
                "original-statusline.json"
            );

        fs.unlinkSync(localConfigPath);
        fs.unlinkSync(localBackupPath);

        const result = runCli(
            ["doctor", "--local", "--fix"],
            directories
        );

        assert.equal(
            result.status,
            0,
            result.stderr
        );
        assert.ok(
            fs.existsSync(localConfigPath)
        );
        assert.deepEqual(
            JSON.parse(
                fs.readFileSync(
                    localConfigPath,
                    "utf8"
                )
            ),
            {
                downstream: {
                    type: "command",
                    command: globalCommand
                }
            }
        );
        assert.match(
            result.stdout,
            /Fix applied: recreated .*\.claude-cost-tracker[\\/]config\.json/
        );
        assert.match(
            result.stdout,
            /Manual repair required/
        );
    }
);

test(
    "doctor --local --fix refuses config repair when the required global fallback cannot be read safely",
    t => {
        const directories =
            createTestDirectories(t);

        writeJsonFile(
            getGlobalSettingsPath(
                directories.home
            ),
            {
                statusLine: {
                    type: "command",
                    command:
                        "npx -y ccstatusline@latest"
                }
            }
        );

        const setupResult = runCli(
            ["setup", "--local"],
            directories
        );

        assert.equal(
            setupResult.status,
            0,
            setupResult.stderr
        );

        const localConfigPath =
            getLocalTrackerPath(
                directories.project,
                "config.json"
            );
        const globalSettingsPath =
            getGlobalSettingsPath(
                directories.home
            );

        fs.unlinkSync(localConfigPath);
        fs.writeFileSync(
            globalSettingsPath,
            "{ broken json",
            "utf8"
        );

        const result = runCli(
            ["doctor", "--local", "--fix"],
            directories
        );

        assert.equal(
            result.status,
            0,
            result.stderr
        );
        assert.ok(
            !fs.existsSync(localConfigPath)
        );
        assert.match(
            result.stdout,
            /Manual repair required/
        );
        assert.doesNotMatch(
            result.stdout,
            /Effective downstream behavior preserved/
        );
    }
);

test(
    "doctor reports malformed global settings JSON without crashing",
    t => {
        const directories =
            createTestDirectories(t);
        const settingsPath =
            getGlobalSettingsPath(
                directories.home
            );

        fs.mkdirSync(
            path.dirname(settingsPath),
            { recursive: true }
        );
        fs.writeFileSync(
            settingsPath,
            "{ invalid json",
            "utf8"
        );

        const result = runCli(
            ["doctor"],
            directories
        );

        assert.equal(
            result.status,
            0,
            result.stderr
        );
        assert.match(
            result.stdout,
            /Result: FAIL/
        );
        assert.match(
            result.stdout,
            /Cannot parse JSON:/
        );
        assert.match(
            result.stdout,
            /settings\.json/
        );
    }
);

test(
    "doctor --fix reports manual repair when missing backup state cannot be recreated safely",
    t => {
        const directories =
            createTestDirectories(t);

        const setupResult = runCli(
            ["setup"],
            directories
        );

        assert.equal(
            setupResult.status,
            0,
            setupResult.stderr
        );

        fs.unlinkSync(
            getGlobalTrackerPath(
                directories.home,
                "original-statusline.json"
            )
        );

        const result = runCli(
            ["doctor", "--fix"],
            directories
        );

        assert.equal(
            result.status,
            0,
            result.stderr
        );
        assert.match(
            result.stdout,
            /Manual repair required/
        );
        assert.match(
            result.stdout,
            /original-statusline\.json/
        );
    }
);
