const fs = require("fs");
const path = require("path");

const {
    GLOBAL_SETTINGS_PATH,
    LOCAL_SETTINGS_PATH,
    GLOBAL_CONFIG_PATH,
    GLOBAL_BACKUP_PATH,
    LOCAL_CONFIG_PATH,
    LOCAL_BACKUP_PATH,
    LOCAL_TRACKER_GITIGNORE_PATH,
    LOCAL_TRACKER_GITIGNORE_CONTENT,
    normalizeStatusLine,
    writeJson
} = require("./claude-code-config");

function safeReadJson(filePath) {
    if (!fs.existsSync(filePath)) {
        return {
            exists: false,
            value: null,
            error: null
        };
    }

    try {
        return {
            exists: true,
            value: JSON.parse(
                fs.readFileSync(filePath, "utf8")
            ),
            error: null
        };
    } catch {
        return {
            exists: true,
            value: null,
            error: `Cannot parse JSON: ${filePath}`
        };
    }
}

function getSafeGlobalDownstream(
    proxyCommand
) {
    const settings =
        safeReadJson(
            GLOBAL_SETTINGS_PATH
        );

    if (settings.error) {
        return {
            settings,
            config: null,
            downstream: null,
            source: "error"
        };
    }

    const settingsStatusLine =
        normalizeStatusLine(
            settings.value?.statusLine
        );

    if (
        settingsStatusLine?.command ===
        proxyCommand
    ) {
        const config =
            safeReadJson(
                GLOBAL_CONFIG_PATH
            );

        if (config.error) {
            return {
                settings,
                config,
                downstream: null,
                source: "error"
            };
        }

        return {
            settings,
            config,
            downstream:
                normalizeStatusLine(
                    config.value?.downstream
                ),
            source: "global tracker config"
        };
    }

    return {
        settings,
        config: null,
        downstream: settingsStatusLine,
        source: settingsStatusLine
            ? "global settings"
            : "none"
    };
}

function createReport(
    scope,
    sectionTitle
) {
    return {
        scope,
        scopeLabel:
            scope === "local"
                ? "project"
                : "global",
        sectionTitle,
        installed: false,
        result: "INFO",
        lines: [],
        hasWarning: false,
        hasFail: false
    };
}

function addLine(
    report,
    severity,
    text,
    options = {}
) {
    if (
        severity === "warning" &&
        options.affectsResult !==
            false
    ) {
        report.hasWarning = true;
    }

    if (severity === "fail") {
        report.hasFail = true;
    }

    report.lines.push({
        severity,
        text
    });
}

function finalizeReport(report) {
    if (report.hasFail) {
        report.result = "FAIL";
    } else if (report.hasWarning) {
        report.result = "WARNING";
    } else if (report.installed) {
        report.result = "OK";
    } else {
        report.result = "INFO";
    }

    return report;
}

function buildGlobalConfigFromBackup(
    backupValue
) {
    return {
        downstream:
            normalizeStatusLine(
                backupValue?.statusLine
            )
    };
}

function getLocalConfigRepairPlan(
    localBackup,
    globalState
) {
    if (localBackup.error) {
        return {
            canRepair: false,
            reason: "local-backup-invalid",
            config: null
        };
    }

    const backupStatusLine =
        localBackup.exists
            ? normalizeStatusLine(
                  localBackup.value?.statusLine
              )
            : null;

    if (backupStatusLine) {
        return {
            canRepair: true,
            reason: "local-backup",
            config: {
                downstream:
                    backupStatusLine
            }
        };
    }

    if (
        globalState.settings?.error ||
        globalState.config?.error
    ) {
        return {
            canRepair: false,
            reason: "global-fallback-unreadable",
            config: null
        };
    }

    return {
        canRepair: true,
        reason: localBackup.exists
            ? "global-fallback"
            : "global-fallback-without-backup",
        config: {
            downstream:
                globalState.downstream ??
                null
        }
    };
}

function inspectGlobalDoctor(
    proxyCommand,
    applyFix
) {
    const report =
        createReport(
            "global",
            "Setup globally"
        );
    const settings =
        safeReadJson(
            GLOBAL_SETTINGS_PATH
        );

    if (settings.error) {
        addLine(
            report,
            "fail",
            "✗ Cannot inspect global setup"
        );
        addLine(
            report,
            "fail",
            settings.error
        );
        addLine(
            report,
            "warning",
            `Manual repair required: fix ${GLOBAL_SETTINGS_PATH} and rerun doctor`
        );

        return finalizeReport(report);
    }

    const settingsStatusLine =
        normalizeStatusLine(
            settings.value?.statusLine
        );

    if (
        !settings.exists ||
        settingsStatusLine?.command !==
            proxyCommand
    ) {
        addLine(
            report,
            "warning",
            "✗ Not set up",
            {
                affectsResult: false
            }
        );
        addLine(
            report,
            "info",
            "Claude Cost Tracker is not enabled globally."
        );
        addLine(
            report,
            "info",
            "Run: claude-cost-tracker setup"
        );

        return finalizeReport(report);
    }

    report.installed = true;

    let config =
        safeReadJson(
            GLOBAL_CONFIG_PATH
        );
    const backup =
        safeReadJson(
            GLOBAL_BACKUP_PATH
        );
    const configWasMissing =
        !config.exists;
    const configHadError =
        config.error;

    const canRepairConfig =
        backup.exists &&
        !backup.error;

    if (
        applyFix &&
        (config.error ||
            !config.exists) &&
        canRepairConfig
    ) {
        writeJson(
            GLOBAL_CONFIG_PATH,
            buildGlobalConfigFromBackup(
                backup.value
            )
        );

        config =
            safeReadJson(
                GLOBAL_CONFIG_PATH
            );
    }

    const downstream =
        !config.error &&
        config.exists
            ? normalizeStatusLine(
                  config.value?.downstream
              )
            : null;

    addLine(
        report,
        "ok",
        "✓ Set up"
    );

    addLine(
        report,
        "info",
        downstream
            ? `Downstream command: ${downstream.command}`
            : "No downstream command"
    );

    if (configWasMissing) {
        addLine(
            report,
            "warning",
            `! Warning: ${GLOBAL_CONFIG_PATH} is missing`
        );

        if (canRepairConfig) {
            if (applyFix) {
                addLine(
                    report,
                    "info",
                    `Fix applied: recreated ${GLOBAL_CONFIG_PATH}`
                );
                addLine(
                    report,
                    "info",
                    "Effective downstream behavior preserved"
                );
            } else {
                addLine(
                    report,
                    "info",
                    "Run: claude-cost-tracker doctor --fix"
                );
            }
        } else {
            addLine(
                report,
                "warning",
                `Manual repair required: cannot safely recreate ${GLOBAL_CONFIG_PATH}`
            );
        }
    } else if (configHadError) {
        addLine(
            report,
            canRepairConfig &&
                applyFix
                ? "warning"
                : "fail",
            configHadError
        );

        if (canRepairConfig) {
            if (applyFix) {
                addLine(
                    report,
                    "info",
                    `Fix applied: recreated ${GLOBAL_CONFIG_PATH}`
                );
                addLine(
                    report,
                    "info",
                    "Effective downstream behavior preserved"
                );
            } else {
                addLine(
                    report,
                    "info",
                    "Run: claude-cost-tracker doctor --fix"
                );
            }
        } else {
            addLine(
                report,
                "warning",
                `Manual repair required: cannot safely recreate ${GLOBAL_CONFIG_PATH}`
            );
        }
    }

    if (!backup.exists) {
        addLine(
            report,
            "warning",
            `! Warning: ${GLOBAL_BACKUP_PATH} is missing`
        );
        addLine(
            report,
            "warning",
            `Manual repair required: cannot safely recreate ${GLOBAL_BACKUP_PATH}`
        );
    } else if (backup.error) {
        addLine(
            report,
            "warning",
            `! Warning: ${GLOBAL_BACKUP_PATH} is invalid`
        );
        addLine(
            report,
            "warning",
            `Manual repair required: cannot safely recreate ${GLOBAL_BACKUP_PATH}`
        );
    }

    return finalizeReport(report);
}

function determineLocalDownstream(
    localConfig,
    localBackup,
    globalDownstream
) {
    const configuredDownstream =
        localConfig.error
            ? null
            : normalizeStatusLine(
                  localConfig.value?.downstream
              );
    const backupStatusLine =
        localBackup.error
            ? null
            : normalizeStatusLine(
                  localBackup.value?.statusLine
              );

    if (backupStatusLine) {
        return {
            source: "project local",
            downstream:
                configuredDownstream ??
                backupStatusLine
        };
    }

    if (
        globalDownstream &&
        (
            !configuredDownstream ||
            configuredDownstream.command ===
                globalDownstream.command
        )
    ) {
        return {
            source: "global fallback",
            downstream:
                configuredDownstream ??
                globalDownstream
        };
    }

    if (configuredDownstream) {
        return {
            source: "project tracker config",
            downstream:
                configuredDownstream
        };
    }

    return {
        source: "none",
        downstream: null
    };
}

function inspectLocalDoctor(
    proxyCommand,
    applyFix
) {
    const report =
        createReport(
            "local",
            "Setup in project"
        );
    const settings =
        safeReadJson(
            LOCAL_SETTINGS_PATH
        );

    if (settings.error) {
        addLine(
            report,
            "fail",
            "✗ Cannot inspect project setup"
        );
        addLine(
            report,
            "fail",
            settings.error
        );
        addLine(
            report,
            "warning",
            `Manual repair required: fix ${LOCAL_SETTINGS_PATH} and rerun doctor`
        );

        return finalizeReport(report);
    }

    const settingsStatusLine =
        normalizeStatusLine(
            settings.value?.statusLine
        );

    if (
        !settings.exists ||
        settingsStatusLine?.command !==
            proxyCommand
    ) {
        addLine(
            report,
            "warning",
            "✗ Not set up",
            {
                affectsResult: false
            }
        );
        addLine(
            report,
            "info",
            "Claude Cost Tracker is not enabled in this project."
        );
        addLine(
            report,
            "info",
            "Run: claude-cost-tracker setup --local"
        );

        return finalizeReport(report);
    }

    report.installed = true;

    const globalState =
        getSafeGlobalDownstream(
            proxyCommand
        );
    let localConfig =
        safeReadJson(
            LOCAL_CONFIG_PATH
        );
    const localBackup =
        safeReadJson(
            LOCAL_BACKUP_PATH
        );
    const gitignoreExists =
        fs.existsSync(
            LOCAL_TRACKER_GITIGNORE_PATH
        );
    const localConfigWasMissing =
        !localConfig.exists;
    const localConfigHadError =
        localConfig.error;
    const localConfigRepairPlan =
        getLocalConfigRepairPlan(
            localBackup,
            globalState
        );
    const canRepairConfig =
        localConfigRepairPlan.canRepair;

    if (
        applyFix &&
        (localConfig.error ||
            !localConfig.exists) &&
        canRepairConfig
    ) {
        writeJson(
            LOCAL_CONFIG_PATH,
            localConfigRepairPlan.config
        );

        localConfig =
            safeReadJson(
                LOCAL_CONFIG_PATH
            );
    }

    if (
        applyFix &&
        !gitignoreExists
    ) {
        fs.mkdirSync(
            path.dirname(
                LOCAL_TRACKER_GITIGNORE_PATH
            ),
            {
                recursive: true
            }
        );

        fs.writeFileSync(
            LOCAL_TRACKER_GITIGNORE_PATH,
            LOCAL_TRACKER_GITIGNORE_CONTENT,
            "utf8"
        );
    }

    const localDownstream =
        determineLocalDownstream(
            localConfig,
            localBackup,
            globalState.downstream
        );

    addLine(
        report,
        "ok",
        "✓ Set up"
    );
    addLine(
        report,
        "info",
        `Downstream command source: ${localDownstream.source}`
    );
    addLine(
        report,
        "info",
        localDownstream.downstream
            ? `Downstream command: ${localDownstream.downstream.command}`
            : "No downstream command"
    );

    if (!gitignoreExists) {
        addLine(
            report,
            "warning",
            `! Warning: ${LOCAL_TRACKER_GITIGNORE_PATH} is missing`
        );

        if (applyFix) {
            addLine(
                report,
                "info",
                `Fix applied: recreated ${LOCAL_TRACKER_GITIGNORE_PATH}`
            );
            addLine(
                report,
                "info",
                "Effective downstream behavior preserved"
            );
        } else {
            addLine(
                report,
                "info",
                "Run: claude-cost-tracker doctor --local --fix"
            );
        }
    }

    if (localConfigWasMissing) {
        addLine(
            report,
            "warning",
            `! Warning: ${LOCAL_CONFIG_PATH} is missing`
        );

        if (canRepairConfig) {
            if (applyFix) {
                addLine(
                    report,
                    "info",
                    `Fix applied: recreated ${LOCAL_CONFIG_PATH}`
                );
                addLine(
                    report,
                    "info",
                    "Effective downstream behavior preserved"
                );
            } else {
                addLine(
                    report,
                    "info",
                    "Run: claude-cost-tracker doctor --local --fix"
                );
            }
        } else {
            addLine(
                report,
                "warning",
                `Manual repair required: cannot safely recreate ${LOCAL_CONFIG_PATH}`
            );

            if (
                localConfigRepairPlan.reason ===
                "global-fallback-unreadable"
            ) {
                addLine(
                    report,
                    "warning",
                    "Manual repair required: the global fallback command cannot be read safely"
                );
            }
        }
    } else if (localConfigHadError) {
        addLine(
            report,
            canRepairConfig &&
                applyFix
                ? "warning"
                : "fail",
            localConfigHadError
        );

        if (canRepairConfig) {
            if (applyFix) {
                addLine(
                    report,
                    "info",
                    `Fix applied: recreated ${LOCAL_CONFIG_PATH}`
                );
                addLine(
                    report,
                    "info",
                    "Effective downstream behavior preserved"
                );
            } else {
                addLine(
                    report,
                    "info",
                    "Run: claude-cost-tracker doctor --local --fix"
                );
            }
        } else {
            addLine(
                report,
                "warning",
                `Manual repair required: cannot safely recreate ${LOCAL_CONFIG_PATH}`
            );

            if (
                localConfigRepairPlan.reason ===
                "global-fallback-unreadable"
            ) {
                addLine(
                    report,
                    "warning",
                    "Manual repair required: the global fallback command cannot be read safely"
                );
            }
        }
    }

    if (!localBackup.exists) {
        addLine(
            report,
            "warning",
            `! Warning: ${LOCAL_BACKUP_PATH} is missing`
        );
        addLine(
            report,
            "warning",
            `Manual repair required: cannot safely recreate ${LOCAL_BACKUP_PATH}`
        );
    } else if (localBackup.error) {
        addLine(
            report,
            "warning",
            `! Warning: ${LOCAL_BACKUP_PATH} is invalid`
        );
        addLine(
            report,
            "warning",
            `Manual repair required: cannot safely recreate ${LOCAL_BACKUP_PATH}`
        );
    }

    if (
        localDownstream.source ===
            "global fallback" &&
        (
            globalState.settings?.error ||
            globalState.config?.error
        )
    ) {
        addLine(
            report,
            "warning",
            "Global fallback is unavailable because global setup is invalid"
        );
    }

    return finalizeReport(report);
}

function runDoctor(
    scope,
    proxyCommand,
    options = {}
) {
    const applyFix =
        options.fix === true;

    if (scope === "local") {
        return inspectLocalDoctor(
            proxyCommand,
            applyFix
        );
    }

    return inspectGlobalDoctor(
        proxyCommand,
        applyFix
    );
}

module.exports = {
    runDoctor
};
