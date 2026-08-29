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
* Absolute path to this script.
*
* Claude Code will use this path instead of relying
* on PATH to find "claude-cost-tracker".
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
      Run status line middleware
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
 
        /*
         * Remove local tracker config.
         */
 
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
* PROXY
* ---------------------------------------------------------
*/
 
async function proxy() {
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
     * Determine whether this invocation
     * belongs to a local installation.
     *
     * We check the current project's .claude
     * settings first.
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
     * Save cost.
     */
 
    const sessionId =
        payload.session_id;
 
    const totalCost =
        payload.cost?.total_cost_usd;
 
    const sessionsDir =
        path.join(
            APP_DIR,
            "sessions"
        );
 
    fs.mkdirSync(
        sessionsDir,
        { recursive: true }
    );
 
    /*
     * Save complete input.
     */
 
    fs.writeFileSync(
        path.join(
            APP_DIR,
            "last-input.json"
        ),
        input,
        "utf8"
    );
 
    /*
     * Save session cost.
     */
 
    if (
        sessionId &&
        typeof totalCost ===
            "number"
    ) {
        writeJson(
            path.join(
                sessionsDir,
                `${sessionId}.json`
            ),
            {
                session_id:
                    sessionId,
 
                total_cost_usd:
                    totalCost,
 
                updated_at:
                    new Date()
                        .toISOString()
            }
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
     * Start downstream.
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
        !fs.existsSync(filePath)
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