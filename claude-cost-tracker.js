#!/usr/bin/env node
 
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
 
/*
 * ---------------------------------------------------------
 * Paths
 * ---------------------------------------------------------
 */
 
const APP_DIR = path.join(
    os.homedir(),
    ".claude-cost-tracker"
);
 
const GLOBAL_CLAUDE_DIR = path.join(
    os.homedir(),
    ".claude"
);
 
const GLOBAL_SETTINGS_PATH = path.join(
    GLOBAL_CLAUDE_DIR,
    "settings.json"
);
 
const LOCAL_CLAUDE_DIR = path.join(
    process.cwd(),
    ".claude"
);
 
const LOCAL_SETTINGS_PATH = path.join(
    LOCAL_CLAUDE_DIR,
    "settings.json"
);
 
const GLOBAL_CONFIG_PATH = path.join(
    APP_DIR,
    "config.json"
);
 
const GLOBAL_BACKUP_PATH = path.join(
    APP_DIR,
    "original-statusline.json"
);
 
const LOCAL_CONFIG_PATH = path.join(
    LOCAL_CLAUDE_DIR,
    "cost-tracker.json"
);
 
/*
 * Project-local runtime data.
 *
 * Session history belongs to the current project,
 * not to the global application directory.
 */
 
const PROJECT_TRACKER_DIR = path.join(
    process.cwd(),
    ".claude-cost-tracker"
);
 
const SESSIONS_DIR = path.join(
    PROJECT_TRACKER_DIR,
    "sessions"
);
 
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
 
    const settingsPath = isLocal
        ? LOCAL_SETTINGS_PATH
        : GLOBAL_SETTINGS_PATH;
 
    const settingsDir =
        path.dirname(settingsPath);
 
    fs.mkdirSync(
        settingsDir,
        { recursive: true }
    );
 
    const settings =
        readJsonOrEmpty(settingsPath);
 
    /*
     * Already installed?
     */
 
    if (
        settings.statusLine?.command ===
        PROXY_COMMAND
    ) {
        console.log(
            `Claude Cost Tracker is already installed ${
                isLocal ? "locally" : "globally"
            }.`
        );
 
        return;
    }
 
    /*
     * Save existing Status Line.
     */
 
    const existingStatusLine =
        settings.statusLine ?? null;
 
    /*
     * LOCAL INSTALL
     */
 
    if (isLocal) {
        const localConfig = {
            installed: true,
            originalStatusLine:
                existingStatusLine
        };
 
        writeJson(
            LOCAL_CONFIG_PATH,
            localConfig
        );
    }
 
    /*
     * GLOBAL INSTALL
     */
 
    else {
        fs.mkdirSync(
            APP_DIR,
            { recursive: true }
        );
 
        writeJson(
            GLOBAL_BACKUP_PATH,
            {
                statusLine:
                    existingStatusLine
            }
        );
 
        writeJson(
            GLOBAL_CONFIG_PATH,
            {
                downstream:
                    existingStatusLine
                        ? {
                            type:
                                existingStatusLine.type ??
                                "command",
 
                            command:
                                existingStatusLine.command
                        }
                        : null
            }
        );
    }
 
    /*
     * Replace Status Line with our proxy.
     */
 
    settings.statusLine = {
        type: "command",
        command: PROXY_COMMAND
    };
 
    writeJson(
        settingsPath,
        settings
    );
 
    console.log(
        `Claude Cost Tracker installed ${
            isLocal ? "locally" : "globally"
        }.`
    );
 
    if (existingStatusLine) {
        console.log(
            `Previous Status Line: ${
                existingStatusLine.command
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
 
    const settingsPath = isLocal
        ? LOCAL_SETTINGS_PATH
        : GLOBAL_SETTINGS_PATH;
 
    if (
        !fs.existsSync(settingsPath)
    ) {
        console.log(
            "Settings file does not exist."
        );
 
        return;
    }
 
    const settings =
        readJsonOrEmpty(settingsPath);
 
    /*
     * Make sure we're uninstalling OUR proxy.
     */
 
    if (
        settings.statusLine?.command !==
        PROXY_COMMAND
    ) {
        console.log(
            `Claude Cost Tracker is not installed ${
                isLocal ? "locally" : "globally"
            }.`
        );
 
        return;
    }
 
    /*
     * LOCAL
     */
 
    if (isLocal) {
        const config =
            readJsonOrEmpty(
                LOCAL_CONFIG_PATH
            );
 
        if (
            config.originalStatusLine
        ) {
            settings.statusLine =
                config.originalStatusLine;
        } else {
            delete settings.statusLine;
        }
 
        writeJson(
            settingsPath,
            settings
        );
 
        if (
            fs.existsSync(
                LOCAL_CONFIG_PATH
            )
        ) {
            fs.unlinkSync(
                LOCAL_CONFIG_PATH
            );
        }
 
        console.log(
            "Claude Cost Tracker local installation removed."
        );
 
        return;
    }
 
    /*
     * GLOBAL
     */
 
    if (
        fs.existsSync(
            GLOBAL_BACKUP_PATH
        )
    ) {
        const backup =
            readJsonOrEmpty(
                GLOBAL_BACKUP_PATH
            );
 
        if (
            backup.statusLine
        ) {
            settings.statusLine =
                backup.statusLine;
        } else {
            delete settings.statusLine;
        }
    } else {
        delete settings.statusLine;
    }
 
    writeJson(
        settingsPath,
        settings
    );
 
    console.log(
        "Claude Cost Tracker global installation removed."
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
 
    const sessionFile =
        path.join(
            SESSIONS_DIR,
            `${sessionId}.json`
        );
 
    if (!fs.existsSync(sessionFile)) {
        console.error(
            `Session file not found for session: ${sessionId}`
        );
 
        console.error(
            `Expected file: ${sessionFile}`
        );
 
        process.exit(1);
    }
 
    /*
     * -----------------------------------------------------
     * Read session
     * -----------------------------------------------------
     */
 
    const session =
        readJsonOrEmpty(
            sessionFile
        );
 
    /*
     * -----------------------------------------------------
     * Current session cost
     * -----------------------------------------------------
     */
 
    const currentCost =
        Number(
            session.total_cost_usd
        );
 
    if (!Number.isFinite(currentCost)) {
        console.error(
            "Current session cost is unavailable."
        );
 
        process.exit(1);
    }
 
    /*
     * -----------------------------------------------------
     * Existing stages
     * -----------------------------------------------------
     */
 
    if (!Array.isArray(session.stages)) {
        session.stages = [];
    }
 
    /*
     * -----------------------------------------------------
     * Previous checkpoint
     * -----------------------------------------------------
     */
 
    let previousCost = 0;
 
    if (session.stages.length > 0) {
        const lastStage =
            session.stages[
                session.stages.length - 1
            ];
 
        if (
            Number.isFinite(
                Number(
                    lastStage.ended_cost_usd
                )
            )
        ) {
            previousCost =
                Number(
                    lastStage.ended_cost_usd
                );
        } else {
            console.error(
                "Previous checkpoint contains invalid cost data."
            );
 
            process.exit(1);
        }
    }
 
    /*
     * -----------------------------------------------------
    
 
if (session.stages.length > 0) {
        const lastStage =
            session.stages[
                session.stages.length - 1
            ];
 
        if (
            Number.isFinite(
                Number(
                    lastStage.ended_cost_usd
                )
            )
        ) {
            previousCost =
                Number(
                    lastStage.ended_cost_usd
                );
        } else {
            console.error(
                "Previous checkpoint contains invalid cost data."
            );
 
            process.exit(1);
        }
    }
 
    /*
     * -----------------------------------------------------
     * Calculate stage cost
     * -----------------------------------------------------
     */
 
    const stageCost =
        currentCost -
        previousCost;
 
    if (stageCost < 0) {
        console.error(
            "Current session cost is lower than previous checkpoint."
        );
 
        console.error(
            `Previous: $${previousCost.toFixed(4)}`
        );
 
        console.error(
            `Current:  $${currentCost.toFixed(4)}`
        );
 
        process.exit(1);
    }
 
    /*
     * -----------------------------------------------------
     * Add stage
     * -----------------------------------------------------
     */
 
    session.stages.push({
        name: stage,
 
        started_cost_usd:
            previousCost,
 
        ended_cost_usd:
            currentCost,
 
        cost_usd:
            stageCost,
 
        timestamp:
            new Date().toISOString()
    });
 
    /*
     * -----------------------------------------------------
     * Update session
     * -----------------------------------------------------
     */
 
    session.updated_at =
        new Date().toISOString();
 
    /*
     * -----------------------------------------------------
     * Save
     * -----------------------------------------------------
 */
 
    writeJson(
        sessionFile,
        session
    );
 
    /*
     * -----------------------------------------------------
     * Output
     * -----------------------------------------------------
 */
 
    console.log(
        `Stage "${stage}" recorded.`
    );
 
    console.log(
        `Session: ${session.session_id}`
    );
 
    console.log(
        `Stage cost: $${stageCost.toFixed(4)}`
    );
 
    console.log(
        `Session total: $${currentCost.toFixed(4)}`
    );
}
 
/*
* ---------------------------------------------------------
* STATUS
* ---------------------------------------------------------
*/
 
async function status() {
    if (!fs.existsSync(SESSIONS_DIR)) {
        console.log("No sessions found.");
        return;
    }
 
    const files = fs.readdirSync(SESSIONS_DIR)
        .filter(file => file.endsWith(".json"));
 
    if (files.length === 0) {
        console.log("No sessions found.");
        return;
    }
 
    const sessions = [];
 
    for (const file of files) {
        const filePath = path.join(
            SESSIONS_DIR,
            file
        );
 
        try {
            const session =
                readJsonOrEmpty(filePath);
 
            if (!session.session_id) {
                continue;
            }
 
            sessions.push(session);
        } catch {
            // Ignore invalid session files.
        }
    }
 
    if (sessions.length === 0) {
        console.log("No valid sessions found.");
        return;
    }
 
    /*
     * Most recently updated session first.
     */
 
    sessions.sort((a, b) => {
        const aTime =
            Date.parse(a.updated_at ?? "") || 0;
 
        const bTime =
            Date.parse(b.updated_at ?? "") || 0;
 
        return bTime - aTime;
    });
 
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
 
    /*
     * Determine downstream Status Line.
     */
 
    const localSettings =
        readJsonOrEmpty(
            LOCAL_SETTINGS_PATH
        );
 
    const globalSettings =
        readJsonOrEmpty(
            GLOBAL_SETTINGS_PATH
        );
 
    let downstream = null;
 
    /*
     * Local Status Line has priority.
     */
 
    if (
        localSettings.statusLine?.command ===
        PROXY_COMMAND
    ) {
        const localConfig =
            readJsonOrEmpty(
                LOCAL_CONFIG_PATH
            );
 
        downstream =
            localConfig.originalStatusLine;
    }
 
    /*
     * Otherwise use global configuration.
     */
 
    else {
        const globalConfig =
            readJsonOrEmpty(
                GLOBAL_CONFIG_PATH
            );
 
        downstream =
            globalConfig.downstream;
    }
 
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
        fs.mkdirSync(
            SESSIONS_DIR,
            { recursive: true }
        );
 
        const sessionFile =
            path.join(
                SESSIONS_DIR,
                `${sessionId}.json`
            );
 
        /*
         * Read existing session first.
         * This preserves stages.
         */
 
        const existingSession =
            readJsonOrEmpty(
                sessionFile
            );
 
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
 
        writeJson(
            sessionFile,
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
 * JSON helpers
 * ---------------------------------------------------------
 */
 
function readJsonOrEmpty(
    filePath
) {
    if (
        !fs.existsSync(
            filePath
        )
    ) {
        return {};
    }
 
    try {
        return JSON.parse(
            fs.readFileSync(
                filePath,
                "utf8"
            )
        );
    } catch {
        throw new Error(
            `Cannot parse JSON: ${filePath}`
        );
    }
}
 
function writeJson(
    filePath,
    data
) {
    fs.mkdirSync(
        path.dirname(filePath),
        {
            recursive: true
        }
    );
 
    fs.writeFileSync(
        filePath,
        JSON.stringify(
            data,
            null,
            2
        ),
        "utf8"
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
 