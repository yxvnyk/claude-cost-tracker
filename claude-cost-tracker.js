#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
 
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
 
const CONFIG_PATH = path.join(
    APP_DIR,
    "config.json"
);
 
const BACKUP_PATH = path.join(
    APP_DIR,
    "original-statusline.json"
);
 
const PROXY_SCRIPT_PATH = 
    path.resolve(process.argv[1]);

const PROXY_COMMAND =
    `node "${PROXY_SCRIPT_PATH}" proxy`;
 
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
 
async function install() {
    const isLocal =
        process.argv.includes("--local");
 
    const settingsPath = isLocal
        ? LOCAL_SETTINGS_PATH
        : GLOBAL_SETTINGS_PATH;
 
    const settingsDir = path.dirname(
        settingsPath
    );
 
    fs.mkdirSync(
        settingsDir,
        { recursive: true }
    );
 
    const settings =
        readJsonOrEmpty(settingsPath);
 
    /*
     * Check whether our proxy is already installed.
     */
 
    if (
        settings.statusLine?.command ===
        PROXY_COMMAND
    ) {
        console.log(
            "Claude Cost Tracker is already installed."
        );
 
        return;
    }
 
    /*
     * Save existing statusLine.
     */
 
    const existingStatusLine =
        settings.statusLine ?? null;
 
    /*
     * If another status line exists,
     * remember it as downstream.
     */
 
    if (existingStatusLine) {
        const config = {
            downstream: {
                type:
                    existingStatusLine.type ??
                    "command",
 
                command:
                    existingStatusLine.command
            }
        };
 
        fs.mkdirSync(
            APP_DIR,
            { recursive: true }
        );
 
        writeJson(
            CONFIG_PATH,
            config
        );
 
        writeJson(
            BACKUP_PATH,
            {
                statusLine:
                    existingStatusLine
            }
        );
    } else {
        /*
         * No existing status line.
         */
 
        fs.mkdirSync(
            APP_DIR,
            { recursive: true }
        );
 
        writeJson(
            CONFIG_PATH,
            {
                downstream: null
            }
        );
 
        writeJson(
            BACKUP_PATH,
            {
                statusLine: null
            }
        );
    }
 
    /*
     * Replace statusLine with our proxy.
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
            isLocal
                ? "locally"
                : "globally"
        }.`
    );
 
    if (existingStatusLine) {
        console.log(
            `Downstream status line saved: ${
                existingStatusLine.command
            }`
        );
    } else {
        console.log(
            "No existing status line was found."
        );
    }
}
 
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
     * Do not modify another configuration.
     */
 
    if (
        settings.statusLine?.command !==
        PROXY_COMMAND
    ) {
        console.log(
            "Claude Cost Tracker is not installed here."
        );
 
        return;
    }
 
    /*
     * Restore original status line.
     */
 
    if (
        fs.existsSync(BACKUP_PATH)
    ) {
        const backup =
            readJsonOrEmpty(
                BACKUP_PATH
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
        `Claude Cost Tracker ${
            isLocal
                ? "local"
                : "global"
        } installation removed.`
    );
}
 
async function proxy() {
    let input = "";
 
    process.stdin.setEncoding(
        "utf8"
    );
 
    process.stdin.on(
        "data",
        chunk => {
            input += chunk;
        }
    );
 
    process.stdin.on(
        "end",
        async () => {
            let payload;
 
            try {
                payload =
                    JSON.parse(input);
            } catch {
                process.exit(1);
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
             * Load downstream.
             */
 
            const config =
                readJsonOrEmpty(
                    CONFIG_PATH
                );
 
            const downstream =
                config.downstream;
 
            /*
             * No downstream.
             */
 
            if (
                !downstream?.command
            ) {
                return;
            }
 
            /*
             * Run downstream command.
             */
 
            const child = spawn(
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
 
            child.stdout.on(
                "data",
                chunk => {
                    process.stdout.write(
                        chunk
                    );
                }
            );
 
            child.stderr.on(
                "data",
                chunk => {
                    process.stderr.write(
                        chunk
                    );
                }
            );
 
            child.stdin.write(input);
            child.stdin.end();
 
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
                        error.message
                    );
 
                    process.exit(1);
                }
            );
        }
    );
}
 
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
        { recursive: true }
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
 
main().catch(error => {
    console.error(
        "Claude Cost Tracker:",
        error.message
    );
 
    process.exit(1);
});