const assert = require("node:assert/strict");
const test = require("node:test");
const { generateReportHtml } = require("../src/report/report-html");

const SESSION_OLDER = {
    session_id: "sess-older-001",
    session_name: "Older Session",
    model: "claude-sonnet-4",
    created_at: "2026-10-01T08:00:00.000Z",
    updated_at: "2026-10-01T09:00:00.000Z",
    total_cost_usd: 0.15,
    checkpoints: [
        {
            name: "analysis",
            model: "claude-sonnet-4",
            cost_usd: 0.07,
            cost_before: 0,
            cost_after: 0.07,
            timestamp_before: null,
            timestamp_after: "2026-10-01T08:30:00.000Z",
            time: null
        },
        {
            name: "implementation",
            model: "claude-sonnet-4",
            cost_usd: 0.08,
            cost_before: 0.07,
            cost_after: 0.15,
            timestamp_before: "2026-10-01T08:30:00.000Z",
            timestamp_after: "2026-10-01T09:00:00.000Z",
            time: "00:30:00"
        }
    ]
};

const SESSION_NEWER = {
    session_id: "sess-newer-002",
    session_name: "Newer Session",
    model: "claude-opus-5",
    created_at: "2026-10-15T10:00:00.000Z",
    updated_at: "2026-10-15T11:00:00.000Z",
    total_cost_usd: 0.42,
    checkpoints: [
        {
            name: "analysis",
            model: "claude-opus-5",
            cost_usd: 0.42,
            cost_before: 0,
            cost_after: 0.42,
            timestamp_before: null,
            timestamp_after: "2026-10-15T11:00:00.000Z",
            time: null
        }
    ]
};

test("generateReportHtml contains both session names", () => {
    const html = generateReportHtml([SESSION_NEWER, SESSION_OLDER]);
    assert.ok(
        html.includes("Newer Session"),
        "HTML should contain newer session name"
    );
    assert.ok(
        html.includes("Older Session"),
        "HTML should contain older session name"
    );
});

test("generateReportHtml lists newer session before older session (pre-sorted input)", () => {
    const html = generateReportHtml([SESSION_NEWER, SESSION_OLDER]);
    const newerIdx = html.indexOf("Newer Session");
    const olderIdx = html.indexOf("Older Session");
    assert.ok(
        newerIdx < olderIdx,
        "Newer session should appear before older session in HTML"
    );
});

test("generateReportHtml contains both stage names", () => {
    const html = generateReportHtml([SESSION_NEWER, SESSION_OLDER]);
    assert.ok(
        html.includes("analysis"),
        "HTML should contain 'analysis' stage name"
    );
    assert.ok(
        html.includes("implementation"),
        "HTML should contain 'implementation' stage name"
    );
});

test("generateReportHtml has no external URLs", () => {
    const html = generateReportHtml([SESSION_NEWER, SESSION_OLDER]);
    assert.doesNotMatch(
        html,
        /https?:\/\//,
        "HTML must not contain any http/https URLs (must be self-contained)"
    );
});

test("generateReportHtml embeds SESSIONS in a script tag", () => {
    const html = generateReportHtml([SESSION_NEWER, SESSION_OLDER]);
    assert.ok(
        html.includes("<script") && html.includes("SESSIONS"),
        "HTML should contain a <script> tag with SESSIONS data"
    );
});
