#!/usr/bin/env node

const os = require("os");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const {
    readSession,
    writeSession,
    getSessions,
} = require("../src/session/session-store");
const {
    generateReportHtml,
} = require("../src/report/report-html");
const {
    recordCheckpoint
} = require("../src/session/session-service");
const {
    getStatusSessions
} = require("../src/status/status-service");
const {
    formatElapsedRangeForDisplay,
    formatElapsedTimeForDisplay
} = require("../src/session/stage-record");
const {
    getNonEmptyString
} = require("../src/session/session-record");
const {
    install: installClaudeCode,
    uninstall: uninstallClaudeCode,
    getDownstreamStatusLine
} = require("../src/integration/claude-code-config");
const {
    runDoctor
} = require("../src/integration/doctor");
const {
    formatDoctorReport
} = require("../src/integration/doctor-output");


/*
 * Absolute path to this script.
 */
 
const SCRIPT_PATH = path.resolve(
    process.argv[1]
);
 
const PROXY_COMMAND =
    `node "${SCRIPT_PATH}" proxy`;
 
/*
 * ---------------------------------------------------------
 * Entry point
 * ---------------------------------------------------------
 */
 
async function main() {
    const command = process.argv[2];
 
    switch (command) {
        case "setup":
            await setup();
            break;
 
        case "uninstall":
            await uninstall();
            break;
 
        case "proxy":
            await proxy();
            break;
 
        case "checkpoint":
            await checkpoint();
            break;

        case "status":
            await status();
            break;

        case "doctor":
            await doctor();
            break;

        case "report":
            await report();
            break;

        default:
            printHelp();
            process.exit(1);
    }
}
 
/*
 * ---------------------------------------------------------
 * Help
 * ---------------------------------------------------------
 */
 
function printHelp() {
    console.log(`
Claude Cost Tracker
 
Usage:
 
 claude-cost-tracker setup
     Install globally
 
 claude-cost-tracker setup --local
     Install for current project
 
 claude-cost-tracker uninstall
     Uninstall globally
 
 claude-cost-tracker uninstall --local
     Uninstall from current project
 
 claude-cost-tracker proxy
     Run Status Line middleware
 
 claude-cost-tracker checkpoint <stage>
     Save current session cost for a stage
 
 claude-cost-tracker checkpoint <stage> --session-id <id>
     Save checkpoint for an explicitly specified session

 claude-cost-tracker status
     Show active Claude Code sessions info

 claude-cost-tracker doctor
     Check global Claude Cost Tracker setup

 claude-cost-tracker doctor --local
     Check Claude Cost Tracker setup in the current project

 claude-cost-tracker doctor [--local] --fix
     Repair safe setup issues in the selected scope

 claude-cost-tracker report
     Generate an HTML report of all tracked sessions
`);
}

function getSessionDisplayName(session) {
    return (
        getNonEmptyString(
            session.session_name
        ) ??
        session.session_id
    );
}

function getSessionModelName(session) {
    return (
        getNonEmptyString(
            session.model
        ) ??
        "Unknown model"
    );
}

function getObservedSessionName(
    payload,
    existingSession
) {
    return (
        getNonEmptyString(
            payload.session_name
        ) ??
        getNonEmptyString(
            existingSession.session_name
        ) ??
        null
    );
}

function supportsColor() {
    return Boolean(
        process.stdout &&
        process.stdout.isTTY
    );
}

function printDoctorReport(report) {
    console.log(
        formatDoctorReport(
            report,
            {
                color:
                    supportsColor()
            }
        )
    );
}
 
/*
 * ---------------------------------------------------------
 * SETUP
 * ---------------------------------------------------------
 */
 
async function setup() {
    const isLocal =
        process.argv.includes("--local");
 
    const result =
        installClaudeCode(
            isLocal,
            PROXY_COMMAND
        );
 
    if (result.alreadyInstalled) {
        console.log(
            `Claude Cost Tracker is already installed ${
                isLocal ? "locally" : "globally"
            }.`
        );
 
        return;
    }
 
    console.log(
        `Claude Cost Tracker installed ${
            isLocal ? "locally" : "globally"
        }.`
    );
 
    if (result.previousStatusLine) {
        console.log(
            `Previous Status Line: ${
                result.previousStatusLine.command
            }`
        );
    } else {
        console.log(
            "No previous Status Line found."
        );
    }
}
 
/*
 * ---------------------------------------------------------
 * UNINSTALL
 * ---------------------------------------------------------
 */
 
async function uninstall() {
    const isLocal =
        process.argv.includes("--local");
 
    const result =
        uninstallClaudeCode(
            isLocal,
            PROXY_COMMAND
        );
 
    if (result.reason === "settings-not-found") {
        console.log(
            "Settings file does not exist."
        );
 
        return;
    }
 
    if (result.reason === "not-installed") {
        console.log(
            `Claude Cost Tracker is not installed ${
                isLocal ? "locally" : "globally"
            }.`
        );
 
        return;
    }
 
    console.log(
        `Claude Cost Tracker ${
            isLocal
                ? "local"
                : "global"
        } installation removed.`
    );
}

/*
 * ---------------------------------------------------------
 * DOCTOR
 * ---------------------------------------------------------
 */

async function doctor() {
    const isLocal =
        process.argv.includes("--local");
    const applyFix =
        process.argv.includes("--fix");
    const report =
        runDoctor(
            isLocal
                ? "local"
                : "global",
            PROXY_COMMAND,
            {
                fix: applyFix
            }
        );

    printDoctorReport(report);
}

/*
 * ---------------------------------------------------------
 * REPORT
 * ---------------------------------------------------------
 */

async function report() {
    const trackerDir = path.join(
        process.cwd(),
        ".claude-cost-tracker"
    );

    if (!fs.existsSync(trackerDir)) {
        console.error(
            "Claude Cost Tracker is not set up in this project."
        );
        console.error(
            "Run: claude-cost-tracker setup --local"
        );
        process.exit(1);
    }

    const sessions = getSessions();

    if (sessions.length === 0) {
        console.log("No sessions found.");
        return;
    }

    sessions.sort(
        (a, b) =>
            (b.created_at ? Date.parse(b.created_at) : 0) -
            (a.created_at ? Date.parse(a.created_at) : 0)
    );

    const html = generateReportHtml(sessions);
    const reportPath = path.join(trackerDir, "report.html");

    fs.writeFileSync(reportPath, html, "utf8");
    console.log(reportPath);
}

/*
 * ---------------------------------------------------------
 * CHECKPOINT
 * ---------------------------------------------------------
 */
 
async function checkpoint() {
    const stage =
        process.argv[3];
 
    if (!stage) {
        console.error(
            "Usage: claude-cost-tracker checkpoint <stage> [--session-id <id>]"
        );
 
        process.exit(1);
    }
 
    /*
     * -----------------------------------------------------
     * Determine session ID
     * -----------------------------------------------------
     *
     * Priority:
     *
     * 1. Explicit --session-id
     * 2. CLAUDE_CODE_SESSION_ID
     *
     * No "latest session" fallback.
     */
 
    let sessionId = null;
 
    const sessionIdFlagIndex =
        process.argv.indexOf("--session-id");
 
    if (sessionIdFlagIndex !== -1) {
        sessionId =
            process.argv[
                sessionIdFlagIndex + 1
            ];
 
        if (!sessionId) {
            console.error(
                "Missing value for --session-id."
            );
 
            process.exit(1);
        }
    }
 
    if (!sessionId) {
        sessionId =
            process.env.CLAUDE_CODE_SESSION_ID;
    }
 
    if (!sessionId) {
        console.error(
            "Claude Code session ID is not available."
        );
 
        console.error(
            "Run this command from Claude Code or provide --session-id."
        );
 
        process.exit(1);
    }
 
    /*
     * -----------------------------------------------------
     * Find exact project session file
     * -----------------------------------------------------
     */
 
    try {
    const result =
        recordCheckpoint(
        sessionId,
        stage
        );
 
      console.log(
        `Stage "${result.stage}" recorded.`
    );
 
      console.log(
        `Session: ${result.sessionId}`
    );
 
    console.log(
        `Stage cost: $${result.stageCost.toFixed(4)}`
    );
 
    console.log(
        `Session total: $${result.totalCost.toFixed(4)}`
    );
    } catch (error) {
    console.error(
        error.message
    );
 
    process.exit(1);
    }
}
 
/*
* ---------------------------------------------------------
* STATUS
* ---------------------------------------------------------
*/
 
async function status() {
    const sessions =
        getStatusSessions();
 
    if (sessions.length === 0) {
        console.log("No sessions found.");
        return;
    }
 
    /*
     * One session — show it immediately.
     */
 
    if (sessions.length === 1) {
        printSessionStatus(sessions[0]);
        return;
    }
 
    /*
     * Multiple sessions — let user choose.
     */
 
    console.log(
        "\nClaude Cost Tracker — Sessions\n"
    );
 
    sessions.forEach((session, index) => {
        const label =
            getSessionDisplayName(
                session
            );
        const model =
            getSessionModelName(
                session
            );
 
        const total =
            Number(session.total_cost_usd);
 
        const totalText =
            Number.isFinite(total)
                ? `$${total.toFixed(4)}`
                : "Unknown";
 
        console.log(
            `${index + 1}. ${label}`
        );

        if (
            label !== session.session_id
        ) {
            console.log(
                `   ${session.session_id}`
            );
        }
 
        console.log(
            `   ${model} — ${totalText}`
        );
 
        console.log();
    });
 
    const selected =
        await selectSession(sessions);
 
    if (!selected) {
        console.log("Cancelled.");
        return;
    }
 
    console.log();
 
    printSessionStatus(selected);
}
 
/*
* ---------------------------------------------------------
* SESSION SELECTION
* ---------------------------------------------------------
*/
 
async function selectSession(sessions) {
    const readline =
        require("readline");
 
    const rl =
        readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
 
    const ask = () =>
        new Promise(resolve => {
            rl.question(
                `Select session [1-${sessions.length}] (0 to exit): `,
                resolve
            );
        });
 
    try {
        while (true) {
            let answer;
 
            try {
                answer =
                    (await ask()).trim();
            } catch {
                return null;
            }
 
            /*
             * Ctrl+D / EOF.
             */
 
            if (answer === "") {
                console.log(
                    "Please enter a session number."
                );
 
                continue;
            }
 
            /*
             * Exit.
             */
 
            if (answer === "0") {
                return null;
            }
 
            /*
             * Only digits are accepted.
             */
 
            if (!/^\d+$/.test(answer)) {
                console.log(
                    `Please enter a number from 1 to ${sessions.length}.`
                );
 
                continue;
            }
 
            const number =
                Number(answer);
 
            /*
             * Prevent invalid or unsafe numbers.
             */
 
            if (
                !Number.isSafeInteger(number) ||
                number < 1 ||
                number > sessions.length
            ) {
                console.log(
                    `Invalid selection. Please choose 1 to ${sessions.length}.`
                );
 
                continue;
            }
 
            return sessions[number - 1];
        }
    } finally {
        rl.close();
    }
}
 
/*
* ---------------------------------------------------------
* PRINT SESSION STATUS
* ---------------------------------------------------------
*/
 
function printSessionStatus(session) {
    const checkpoints =
        Array.isArray(
            session.checkpoints
        )
            ? session.checkpoints
            : [];
 
    const total =
        Number(session.total_cost_usd);
 
    console.log(
        `Total: ${
            Number.isFinite(total)
                ? `$${total.toFixed(4)}`
                : "Unknown"
        }`
    );

    const sessionTime =
        formatElapsedRangeForDisplay(
            session.created_at,
            session.updated_at
        );

    console.log(
        `Time: ${
            sessionTime ?? "Unknown"
        }`
    );
 
    console.log();
 
    console.log("Checkpoints:");
 
    if (
        checkpoints.length === 0
    ) {
        console.log(
            "  No checkpoints recorded."
        );
 
        return;
    }
 
    for (const stage of checkpoints) {
        const stageName =
            typeof stage.name === "string" &&
            stage.name.trim() !== ""
                ? stage.name
                : "Unknown";

        const cost =
            Number(stage.cost_usd);
 
        const costText =
            Number.isFinite(cost)
                ? `$${cost.toFixed(4)}`
                : "Unknown";
 
        const stageTime =
            formatElapsedTimeForDisplay(
                stage.time
            ) ?? "-";

        console.log(
            `  ${stageName}    ${costText}  ${stageTime}`
        );
    }
}

/*
 * ---------------------------------------------------------
 * PROXY
 * ---------------------------------------------------------
 */
 
async function proxy() {
    /*
     * Read Status Line stdin.
     */
 
    const input =
        await readStdin();
 
    let payload;
 
    try {
        payload =
            JSON.parse(input);
    } catch {
        console.error(
            "Claude Cost Tracker: invalid JSON."
        );
 
        process.exit(1);
    }

    const downstream = 
        getDownstreamStatusLine(
            PROXY_COMMAND
        )
 
    /*
     * Extract session information.
     */
 
    const sessionId =
        payload.session_id;
 
    const totalCost =
        payload.cost?.total_cost_usd;
 
    /*
     * Save session state to the current project.
     */
 
    if (
        sessionId &&
        typeof totalCost ===
            "number"
    ) {
        const existingSession =
            readSession(sessionId) ?? {};
 
        const now =
            new Date().toISOString();
 
        const updatedSession = {
            session_id:
                sessionId,

            session_name:
                getObservedSessionName(
                    payload,
                    existingSession
                ),
 
            model:
                payload.model?.id ??
                existingSession.model ??
                null,
 
            created_at:
                existingSession.created_at ??
                now,
 
            updated_at:
                now,
 
            total_cost_usd:
                totalCost,
 
            checkpoints:
                Array.isArray(
                    existingSession.checkpoints
                )
                    ? existingSession.checkpoints
                    : []
        };
 
        writeSession(
            sessionId,
            updatedSession
        );
    }
 
    /*
     * No downstream Status Line.
     */
 
    if (
        !downstream?.command
    ) {
        return;
    }
 
    /*
     * Start downstream Status Line.
     */
 
    const child =
        spawn(
            downstream.command,
            {
                shell: true,
 
                stdio: [
                    "pipe",
                    "pipe",
                    "pipe"
                ]
            }
        );
 
    /*
     * Forward stdout.
     */
 
    child.stdout.on(
        "data",
        chunk => {
            process.stdout.write(
                chunk
            );
        }
    );
 
    /*
     * Forward stderr.
     */
 
    child.stderr.on(
        "data",
        chunk => {
            process.stderr.write(
                chunk
            );
        }
    );
 
    /*
     * Forward ORIGINAL JSON.
     */
 
    child.stdin.write(
        input
    );
 
    child.stdin.end();
 
    /*
     * Finish with downstream.
     */
 
    child.on(
        "close",
        code => {
            process.exit(
                code ?? 0
            );
        }
    );
 
    child.on(
        "error",
        error => {
            console.error(
                "Claude Cost Tracker downstream error:",
                error.message
            );
 
            process.exit(1);
        }
    );
}
 
/*
 * ---------------------------------------------------------
 * STDIN
 * ---------------------------------------------------------
 */
 
function readStdin() {
    return new Promise(
        (resolve, reject) => {
            let data = "";
 
            process.stdin.setEncoding(
                "utf8"
            );
 
            process.stdin.on(
                "data",
                chunk => {
                    data += chunk;
                }
            );
 
            process.stdin.on(
                "end",
                () => resolve(data)
            );
 
            process.stdin.on(
                "error",
                reject
            );
        }
    );
}
 
/*
 * ---------------------------------------------------------
 * Start
 * ---------------------------------------------------------
 */
 
main().catch(
    error => {
        console.error(
            "Claude Cost Tracker:",
            error.message
        );
 
        process.exit(1);
    }
);
