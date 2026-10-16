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
const DOCTOR_MODULE_PATH = path.resolve(
    __dirname,
    "../src/integration/doctor.js"
);

function createTestDirectories(t) {
    const root = fs.mkdtempSync(
        path.join(
            os.tmpdir(),
            "claude-cost-tracker-doctor-report-"
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

function runDoctorReport(
    scope,
    {
        home,
        project
    }
) {
    const proxyCommand =
        `node "${CLI_PATH}" proxy`;
    const script = [
        `const { runDoctor } = require(${JSON.stringify(DOCTOR_MODULE_PATH)});`,
        `const report = runDoctor(${JSON.stringify(scope)}, ${JSON.stringify(proxyCommand)}, { fix: false });`,
        "process.stdout.write(JSON.stringify(report));"
    ].join("\n");

    const result = spawnSync(
        process.execPath,
        ["-e", script],
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

    assert.equal(
        result.status,
        0,
        result.stderr
    );

    return JSON.parse(result.stdout);
}

test(
    "runDoctor marks the not-set-up status line as a warning so interactive output can color it yellow",
    t => {
        const directories =
            createTestDirectories(t);

        const report = runDoctorReport(
            "global",
            directories
        );

        assert.equal(
            report.result,
            "INFO"
        );
        assert.equal(
            report.lines[0].text,
            "✗ Not set up"
        );
        assert.equal(
            report.lines[0].severity,
            "warning"
        );
    }
);
