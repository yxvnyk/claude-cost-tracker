const assert = require("node:assert/strict");
const test = require("node:test");

const {
    formatDoctorReport
} = require("../src/integration/doctor-output");

test(
    "formatDoctorReport renders the indented doctor layout without ANSI colors",
    () => {
        const output =
            formatDoctorReport(
                {
                    scopeLabel: "global",
                    result: "WARNING",
                    sectionTitle:
                        "Setup globally",
                    lines: [
                        {
                            severity: "ok",
                            text: "\u2713 Set up"
                        },
                        {
                            severity: "info",
                            text: "No downstream command"
                        },
                        {
                            severity: "warning",
                            text:
                                "! Warning: C:\\Users\\you\\.claude-cost-tracker\\original-statusline.json is missing"
                        },
                        {
                            severity: "warning",
                            text:
                                "Manual repair required: cannot safely recreate C:\\Users\\you\\.claude-cost-tracker\\original-statusline.json"
                        }
                    ]
                },
                { color: false }
            );

        assert.equal(
            output,
            [
                "Claude Cost Tracker Health Check",
                "",
                "Scope: global",
                "    Result: WARNING",
                "",
                "  Setup globally",
                "    \u2713 Set up",
                "    No downstream command",
                "    ! Warning: C:\\Users\\you\\.claude-cost-tracker\\original-statusline.json is missing",
                "    Manual repair required: cannot safely recreate C:\\Users\\you\\.claude-cost-tracker\\original-statusline.json"
            ].join("\n")
        );
    }
);

test(
    "formatDoctorReport colorizes the header blue plus result and severity lines when color output is enabled",
    () => {
        const output =
            formatDoctorReport(
                {
                    scopeLabel: "project",
                    result: "WARNING",
                    sectionTitle:
                        "Setup in project",
                    lines: [
                        {
                            severity: "ok",
                            text: "\u2713 Set up"
                        },
                        {
                            severity: "warning",
                            text:
                                "! Warning: .claude-cost-tracker/.gitignore is missing"
                        }
                    ]
                },
                { color: true }
            );

        assert.match(
            output,
            /^\u001b\[34mClaude Cost Tracker Health Check\u001b\[0m\r?\n\r?\nScope: project\r?\n/
        );
        assert.match(
            output,
            /\u001b\[33m {4}Result: WARNING\u001b\[0m/
        );
        assert.match(
            output,
            /\u001b\[32m {4}\u2713 Set up\u001b\[0m/
        );
        assert.match(
            output,
            /\u001b\[33m {4}! Warning: \.claude-cost-tracker\/\.gitignore is missing\u001b\[0m/
        );
    }
);
