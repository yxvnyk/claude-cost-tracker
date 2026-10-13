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
            "claude-cost-tracker-global-fallback-"
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
    command,
    {
        home,
        project,
        local = false,
        input = ""
    }
) {
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
            input,
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

function getLocalSettingsPath(project) {
    return path.join(
        project,
        ".claude",
        "settings.json"
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

function createStatusLineRecorder(
    root
) {
    const outputPath = path.join(
        root,
        "status-line-output.json"
    );
    const scriptPath = path.join(
        root,
        "record-status-line.js"
    );

    fs.writeFileSync(
        scriptPath,
        [
            'const fs = require("node:fs");',
            'const outputPath = process.argv[2];',
            'let input = "";',
            'process.stdin.setEncoding("utf8");',
            'process.stdin.on("data", chunk => { input += chunk; });',
            'process.stdin.on("end", () => {',
            '  fs.writeFileSync(outputPath, input, "utf8");',
            '  process.stdout.write("recorded");',
            '});'
        ].join("\n"),
        "utf8"
    );

    return {
        outputPath,
        command:
            `"${process.execPath}" ` +
            `"${scriptPath}" ` +
            `"${outputPath}"`
    };
}

test(
    "setup --local uses the global statusLine as downstream when the project has no local statusLine",
    t => {
        const directories =
            createTestDirectories(t);
        const globalStatusLineCommand =
            "npx -y ccstatusline@latest";

        writeJsonFile(
            getGlobalSettingsPath(
                directories.home
            ),
            {
                statusLine: {
                    type: "command",
                    command:
                        globalStatusLineCommand
                }
            }
        );

        const result = runCli(
            "setup",
            {
                ...directories,
                local: true
            }
        );

        assert.equal(
            result.status,
            0,
            result.stderr
        );

        const localTrackerConfig =
            JSON.parse(
                fs.readFileSync(
                    getLocalTrackerPath(
                        directories.project,
                        "config.json"
                    ),
                    "utf8"
                )
            );

        assert.deepEqual(
            localTrackerConfig,
            {
                downstream: {
                    type: "command",
                    command:
                        globalStatusLineCommand
                }
            }
        );
    }
);

test(
    "setup --local prefers the project-local statusLine over the global one",
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
                        "npx -y global-statusline@latest"
                }
            }
        );

        writeJsonFile(
            getLocalSettingsPath(
                directories.project
            ),
            {
                statusLine: {
                    type: "command",
                    command:
                        "npx -y local-statusline@latest"
                }
            }
        );

        const result = runCli(
            "setup",
            {
                ...directories,
                local: true
            }
        );

        assert.equal(
            result.status,
            0,
            result.stderr
        );

        const localTrackerConfig =
            JSON.parse(
                fs.readFileSync(
                    getLocalTrackerPath(
                        directories.project,
                        "config.json"
                    ),
                    "utf8"
                )
            );

        assert.deepEqual(
            localTrackerConfig,
            {
                downstream: {
                    type: "command",
                    command:
                        "npx -y local-statusline@latest"
                }
            }
        );
    }
);

test(
    "proxy falls back to the global statusLine when local downstream config is empty",
    t => {
        const directories =
            createTestDirectories(t);
        const recorder =
            createStatusLineRecorder(
                directories.home
            );
        const proxyCommand =
            `node "${CLI_PATH}" proxy`;
        const payload =
            JSON.stringify({
                session_id: "session-1",
                model: {
                    id: "claude-sonnet"
                },
                cost: {
                    total_cost_usd: 1.23
                }
            });

        writeJsonFile(
            getGlobalSettingsPath(
                directories.home
            ),
            {
                statusLine: {
                    type: "command",
                    command:
                        recorder.command
                }
            }
        );

        writeJsonFile(
            getLocalSettingsPath(
                directories.project
            ),
            {
                statusLine: {
                    type: "command",
                    command: proxyCommand
                }
            }
        );

        writeJsonFile(
            getLocalTrackerPath(
                directories.project,
                "config.json"
            ),
            {
                downstream: null
            }
        );

        const result = runCli(
            "proxy",
            {
                ...directories,
                input: payload
            }
        );

        assert.equal(
            result.status,
            0,
            result.stderr
        );

        assert.equal(
            fs.readFileSync(
                recorder.outputPath,
                "utf8"
            ),
            payload
        );
    }
);

test(
    "setup --local uses the effective global downstream when the global scope already uses the tracker proxy",
    t => {
        const directories =
            createTestDirectories(t);
        const proxyCommand =
            `node "${CLI_PATH}" proxy`;

        writeJsonFile(
            getGlobalSettingsPath(
                directories.home
            ),
            {
                statusLine: {
                    type: "command",
                    command: proxyCommand
                }
            }
        );

        writeJsonFile(
            getGlobalTrackerPath(
                directories.home,
                "config.json"
            ),
            {
                downstream: {
                    type: "command",
                    command:
                        "npx -y ccstatusline@latest"
                }
            }
        );

        const result = runCli(
            "setup",
            {
                ...directories,
                local: true
            }
        );

        assert.equal(
            result.status,
            0,
            result.stderr
        );

        const localTrackerConfig =
            JSON.parse(
                fs.readFileSync(
                    getLocalTrackerPath(
                        directories.project,
                        "config.json"
                    ),
                    "utf8"
                )
            );

        assert.deepEqual(
            localTrackerConfig,
            {
                downstream: {
                    type: "command",
                    command:
                        "npx -y ccstatusline@latest"
                }
            }
        );
    }
);
