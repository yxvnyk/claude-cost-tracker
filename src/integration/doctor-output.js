function colorize(
    text,
    colorCode,
    enabled
) {
    if (!enabled || !colorCode) {
        return text;
    }

    return `\u001b[${colorCode}m${text}\u001b[0m`;
}

function getResultColor(
    result
) {
    switch (result) {
        case "OK":
            return "32";
        case "INFO":
            return "36";
        case "WARNING":
            return "33";
        case "FAIL":
            return "31";
        default:
            return null;
    }
}

function getSeverityColor(
    severity
) {
    switch (severity) {
        case "ok":
            return "32";
        case "info":
            return "36";
        case "warning":
            return "33";
        case "fail":
            return "31";
        default:
            return null;
    }
}

function formatDoctorReport(
    report,
    options = {}
) {
    const color =
        options.color === true;

    const lines = [
        colorize(
            "Claude Cost Tracker Health Check",
            "34",
            color
        ),
        "",
        `Scope: ${report.scopeLabel}`,
        colorize(
            `    Result: ${report.result}`,
            getResultColor(
                report.result
            ),
            color
        ),
        "",
        `  ${report.sectionTitle}`
    ];

    for (const line of report.lines) {
        lines.push(
            colorize(
                `    ${line.text}`,
                getSeverityColor(
                    line.severity
                ),
                color
            )
        );
    }

    return lines.join("\n");
}

module.exports = {
    formatDoctorReport
};
