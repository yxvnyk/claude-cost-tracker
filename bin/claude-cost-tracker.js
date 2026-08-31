#!/usr/bin/env node

const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const {
    readSession,
    writeSession,
} = require("../src/session/session-store");
const {
    recordCheckpoint
} = require("../src/session/session-service");
const {
    getStatusSessions
} = require("../src/status/status-service");
const {
    install: installClaudeCode,
    uninstall: uninstallClaudeCode,
    getDownstreamStatusLine
} = require("../src/integration/claude-code-config");


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
        case "install":
            await install();
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
 
 claude-cost-tracker install
     Install globally
 
 claude-cost-tracker install --local
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
`);
}
 
/*
 * ---------------------------------------------------------
 * INSTALL
 * ---------------------------------------------------------
 */
 
async function install() {
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
        const model =
            session.model_display_name ??
            session.model ??
            "Unknown model";
 
        const total =
            Number(session.total_cost_usd);
 
        const totalText =
            Number.isFinite(total)
                ? `$${total.toFixed(4)}`
                : "Unknown";
 
        console.log(
            `${index + 1}. ${session.session_id}`
        );
 
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
    const model =
        session.model_display_name ??
        session.model ??
        "Unknown model";
 
    const total =
        Number(session.total_cost_usd);
 
    console.log(
        `Session: ${session.session_id}`
    );
 
    console.log(
        `Model: ${model}`
    );
 
    console.log();
 
    console.log(
        `Total: ${
            Number.isFinite(total)
                ? `$${total.toFixed(4)}`
                : "Unknown"
        }`
    );
 
    console.log();
 
    console.log("Stages:");
 
    if (
        !Array.isArray(session.stages) ||
        session.stages.length === 0
    ) {
        console.log(
            "  No checkpoints recorded."
        );
 
        return;
    }
 
    for (const stage of session.stages) {
        const cost =
            Number(stage.cost_usd);
 
        const costText =
            Number.isFinite(cost)
                ? `$${cost.toFixed(4)}`
                : "Unknown";
 
        console.log(
            `  ${stage.name}    ${costText}`
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
            ...existingSession,
 
            session_id:
                sessionId,
 
            model:
                payload.model?.id ??
                existingSession.model ??
                null,
 
            model_display_name:
                payload.model?.display_name ??
                existingSession.model_display_name ??
                null,
 
            created_at:
                existingSession.created_at ??
                now,
 
            updated_at:
                now,
 
            total_cost_usd:
                totalCost,
 
            stages:
                Array.isArray(
                    existingSession.stages
                )
                    ? existingSession.stages
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
 