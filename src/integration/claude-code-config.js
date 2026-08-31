const fs = require("fs");
const os = require("os");
const path = require("path");
 
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

const LOCAL_TRACKER_DIR = path.join(
    process.cwd(),
    ".claude-cost-tracker"
)
 
const LOCAL_CONFIG_PATH = path.join(
    LOCAL_TRACKER_DIR,
    "config.json"
);

const LOCAL_BACKUP_PATH = path.join(
    LOCAL_TRACKER_DIR,
    "original-statusline.json"
);
 
function readJsonOrEmpty(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }
 
    try {
        return JSON.parse(
            fs.readFileSync(filePath, "utf8")
        );
    } catch {
        throw new Error(
            `Cannot parse JSON: ${filePath}`
        );
    }
}
 
function writeJson(filePath, data) {
    fs.mkdirSync(
        path.dirname(filePath),
        {
            recursive: true
        }
    );
 
    fs.writeFileSync(
        filePath,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}
 
function install(isLocal, proxyCommand) {
    const settingsPath = isLocal
        ? LOCAL_SETTINGS_PATH
        : GLOBAL_SETTINGS_PATH;
 
    fs.mkdirSync(
        path.dirname(settingsPath),
        { recursive: true }
    );
 
    const settings =
        readJsonOrEmpty(settingsPath);
 
    if (
        settings.statusLine?.command ===
        proxyCommand
    ) {
        return {
            installed: false,
            alreadyInstalled: true,
            isLocal
        };
    }
 
    const existingStatusLine =
        settings.statusLine ?? null;
 
    if (isLocal) {
    fs.mkdirSync(
        LOCAL_TRACKER_DIR,
        { recursive: true }
    );
 
    writeJson(
        LOCAL_BACKUP_PATH,
        {
            statusLine:
                existingStatusLine
        }
    );
 
    writeJson(
        LOCAL_CONFIG_PATH,
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
} else {
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
 
    settings.statusLine = {
        type: "command",
        command: proxyCommand
    };
 
    writeJson(
        settingsPath,
        settings
    );
 
    return {
        installed: true,
        alreadyInstalled: false,
        isLocal,
        previousStatusLine:
            existingStatusLine
    };
}
 
function uninstall(isLocal, proxyCommand) {
    const settingsPath = isLocal
        ? LOCAL_SETTINGS_PATH
        : GLOBAL_SETTINGS_PATH;
 
    if (!fs.existsSync(settingsPath)) {
        return {
            removed: false,
            reason: "settings-not-found",
            isLocal
        };
    }
 
    const settings =
        readJsonOrEmpty(settingsPath);
 
    if (
        settings.statusLine?.command !==
        proxyCommand
    ) {
        return {
            removed: false,
            reason: "not-installed",
            isLocal
        };
    }
 
    if (isLocal) {
    const backup =
        readJsonOrEmpty(
            LOCAL_BACKUP_PATH
        );
 
    if (backup.statusLine) {
        settings.statusLine =
            backup.statusLine;
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
 
    if (
        fs.existsSync(
            LOCAL_BACKUP_PATH
        )
    ) {
        fs.unlinkSync(
            LOCAL_BACKUP_PATH
        );
    }
 
    return {
        removed: true,
        isLocal
    };
    }
    if (
        fs.existsSync(
            GLOBAL_BACKUP_PATH
        )
    ) {
        const backup =
            readJsonOrEmpty(
                GLOBAL_BACKUP_PATH
            );
 
        if (backup.statusLine) {
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
 
    return {
        removed: true,
        isLocal
    };
}

function getDownstreamStatusLine(proxyCommand) {
    const localSettings =
        readJsonOrEmpty(
            LOCAL_SETTINGS_PATH
        );
 
    if (
        localSettings.statusLine?.command ===
        proxyCommand
    ) {
        const localConfig =
            readJsonOrEmpty(
                LOCAL_CONFIG_PATH
            );
 
        return localConfig.downstream ?? null;
    }
 
    const globalConfig =
        readJsonOrEmpty(
            GLOBAL_CONFIG_PATH
        );
 
    return globalConfig.downstream ?? null;
}
 
module.exports = {
    install,
    uninstall,
    getDownstreamStatusLine,
    readJsonOrEmpty,
    writeJson
};
