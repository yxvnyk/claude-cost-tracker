
# Claude Cost Tracker

> Middleware for Claude Code Status Line that tracks session costs and stage-level costs while preserving the existing Status Line.

The primary purpose of Claude Cost Tracker is to track the cost of individual stages executed by Claude Code Skills and Agents without relying on Claude Code hooks. 

The primary use case is not manual execution from an external terminal. A checkpoint is intended to be invoked from within a Claude Code workflow, such as a Skill that consists of multiple stages.

For example, a Skill may have the following structure:

```text
Skill
 │
 ├── Stage 1: Analysis
 │      │
 │      └── `claude-cost-tracker checkpoint analysis`
 │
 ├── Stage 2: Implementation
 │      │
 │      └── `claude-cost-tracker checkpoint implementation`
 │
 └── Stage 3: Testing
        │
        └── `claude-cost-tracker checkpoint testing`
```
 
The tracker uses the cost reported by Claude Code and associates checkpoints with the current Claude Code session. When a checkpoint is executed inside Claude Code, the tracker uses the "CLAUDE_CODE_SESSION_ID" environment variable to identify the current session and update its corresponding session data.
 
The key design goal is to provide stage-level cost tracking without requiring hooks or modifications to the Skill or Agent execution mechanism.
 
Claude Cost Tracker also provides Status Line middleware functionality. This allows it to receive Claude Code's Status Line payload, track session costs, and transparently forward the original payload to an existing Status Line tools.

---

## Table of Contents
 
- [Overview](#overview)
- [Why Middleware?](#why-middleware)
- [How It Works](#how-it-works)
- [Installation](#installation)
  - [Global Installation](#global-installation)
  - [Local Installation](#local-installation)
- [Global vs Local Installation](#global-vs-local-installation)
- [Configuration](#configuration)
  - [Original Status Line](#original-status-line)
  - [Downstream Status Line](#downstream-status-line)
- [Installation Lifecycle](#installation-lifecycle)
- [Status Line Proxy](#status-line-proxy)
  - [Transparent Forwarding](#transparent-forwarding)
- [Session Tracking](#session-tracking)
  - [Cost Tracking](#cost-tracking)
- [Checkpoints](#checkpoints)
  - [Checkpoints Inside Claude Code](#checkpoints-inside-claude-code)
  - [Session Identification](#session-identification)
  - [Session File Resolution](#session-file-resolution)
  - [Stage Cost Calculation](#stage-cost-calculation)
  - [Why This Is Useful for Skills](#why-this-is-useful-for-skills)
  - [Explicit Session ID](#explicit-session-id)
- [Status Command](#status-command)
- [Doctor Command](#doctor-command)
- [CLI Reference](#cli-reference)
  - [Install](#install)
  - [Uninstall](#uninstall)
  - [Proxy](#proxy)
  - [Checkpoint](#checkpoint)
  - [Status](#status)
  - [Doctor](#doctor)
  - [Report](#report)
- [Uninstallation](#uninstallation)
- [Project Structure](#project-structure)
- [Limitations](#limitations)
- [License](#license)

---

# Overview

Claude Cost Tracker is designed for environments where developers already use Claude Code and potentially already have other Status Line tools.

For example:

```text
Claude Code
    │
    ▼
ccstatusline
````

Claude Cost Tracker can be inserted without replacing `ccstatusline`:

```text
Claude Code
    │
    ▼
Claude Cost Tracker
    │
    ▼
ccstatusline
```

The tracker receives the Status Line JSON from Claude Code, extracts the information required for cost tracking, stores it, and then passes the **original JSON payload** to the existing Status Line.

This makes the tracker independent from the actual Status Line renderer.

---

# Why Middleware?

Claude Code already provides a mechanism for supplying information to a Status Line command.

Instead of implementing another Status Line, Claude Cost Tracker uses this existing mechanism.

The tracker does not need to render the Status Line itself.

Its responsibility is to:

* intercept the Status Line input;
* track Claude Code sessions;
* track cumulative session cost;
* record stage checkpoints;
* preserve the existing Status Line;
* forward the original payload to the existing Status Line.

This allows existing Status Line implementations to continue working unchanged.

For example:

```text
Before:

Claude Code
    │
    ▼
npx -y ccstatusline@latest
```

After:

```text
Claude Code
    │
    ▼
claude-cost-tracker proxy
    │
    ▼
npx -y ccstatusline@latest
```

The existing Status Line does not need to know that Claude Cost Tracker is present.

---

# How It Works

Claude Code invokes the configured Status Line command and provides structured JSON through `stdin`.

Conceptually:

```text
Claude Code
    │
    │ JSON via stdin
    ▼
Claude Cost Tracker
    │
    ├── Parse JSON
    │
    ├── Extract session_id
    │
    ├── Extract total_cost_usd
    │
    ├── Update session
    │
    ├── Determine downstream Status Line
    │
    └── Forward original JSON
    │
    ▼
Other Status Line tool
```

A simplified payload may look like:

```json
{
  "session_id": "abc123",
  "session_name": "Planning migration session",
  "model": {
    "id": "claude-sonnet"
  },
  "cost": {
    "total_cost_usd": 0.1234
  }
}
```

Claude Cost Tracker uses:

```text
session_id
session_name
model.id
cost.total_cost_usd
```

for session tracking.

The original JSON is then forwarded to the downstream Status Line.

---

# Installation

Clone the repository and install its dependencies:
 
```bash
git clone <repository-url>
cd claude-cost-tracker
npm install
```

Claude Cost Tracker can be installed globally or locally for a specific project.

## Global Installation

Install the package:

```bash
npm install -g claude-cost-tracker
```

Then:

```bash
claude-cost-tracker setup
```

The global installation modifies:

```text
~/.claude/settings.json
```

Tracker configuration is stored separately:

```text
~/.claude-cost-tracker/
├── config.json
└── original-statusline.json
```

---

## Local Installation

To install the tracker for the current project:

```bash
claude-cost-tracker setup --local
```

Claude Code configuration:

```text
<project>/.claude/settings.json
```

Tracker configuration:

```text
<project>/.claude-cost-tracker/
├── .gitignore
├── config.json
└── original-statusline.json
```

`setup --local` also writes `<project>/.claude-cost-tracker/.gitignore` with this policy:

```gitignore
# ClaudeCostTracker data files — local to each machine, not for committing.
# Ignore everything in .claude-cost-tracker/ except this file itself, so transient
# files (the database, daemon.pid, sockets, logs) never show up in git.
*
!.gitignore
```

This keeps machine-specific tracker artifacts such as the database, `daemon.pid`, sockets, and logs out of git while leaving the ignore policy itself visible in the repository. If the file is removed later, rerunning `claude-cost-tracker setup --local` recreates it.

The tracker keeps its project-specific state outside of `.claude`.

When `setup --local` decides what to run downstream, it preserves the user's existing status-line
command with this precedence:

1. the project-local `statusLine` command, when the project already defines one;
2. otherwise the effective global `statusLine` command;
3. otherwise no downstream command.

The "effective global" command means the user's actual global renderer even when the global scope
already uses Claude Cost Tracker itself. In that case, the local install reuses the global tracker's
saved downstream command instead of chaining the proxy into itself.

---

# Global vs Local Installation

|                      | Global                    | Local                             |
| -------------------- | ------------------------- | --------------------------------- |
| Claude Code settings | `~/.claude/settings.json` | `<project>/.claude/settings.json` |
| Tracker directory    | `~/.claude-cost-tracker/` | `<project>/.claude-cost-tracker/` |
| Tracker ignore file  | Not created               | `<project>/.claude-cost-tracker/.gitignore` |
| Scope                | All projects              | Current project                   |
| Installation         | `setup`                   | `setup --local`                   |
| Uninstallation       | `uninstall`               | `uninstall --local`               |

Local installation is useful when a framework or project needs its Claude Code integration to be isolated from the user's global environment.
Global installation keeps tracker state under `~/.claude-cost-tracker/` and does not create a project-local `.claude-cost-tracker/.gitignore`.
When both scopes exist, the project-local downstream command wins; if the local install has no
project-specific downstream command to preserve, it falls back to the effective global status line.



---

# Configuration

Claude Cost Tracker maintains two pieces of Status Line configuration.

## Original Status Line

`original-statusline.json` stores the Status Line configuration that existed before the tracker was installed.

Example:

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx -y ccstatusline@latest"
  }
}
```

This configuration is used when uninstalling the tracker.

---

## Downstream Status Line

`config.json` stores the command that should receive the Status Line input while the tracker is active.

Example:

```json
{
  "downstream": {
    "type": "command",
    "command": "npx -y ccstatusline@latest"
  }
}
```

The distinction is intentional:

```text
original-statusline.json
        │
        └── Configuration to restore during uninstall


config.json
        │
        └── Configuration to execute downstream
```

This keeps restoration state separate from runtime integration state.

For a local installation, `config.json` stores the project-local status-line command when one existed
before setup. If the project had no local `statusLine`, the tracker stores the effective global
status-line command instead so local cost tracking does not suppress the user's existing global
renderer.

---

# Installation Lifecycle

When installing, the tracker performs the following steps:

```text
1. Read Claude Code settings
          │
          ▼
2. Find existing Status Line tool
          │
          ▼
3. Save original Status Line tool command
          │
          ▼
4. Save downstream configuration
          │
          ▼
5. Replace Status Line tool with tracker proxy
```

For example, before installation:

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx -y ccstatusline@latest"
  }
}
```

After installation:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \".../claude-cost-tracker.js\" proxy"
  }
}
```

The original command remains stored in the tracker configuration.

---

# Status Line Proxy

The proxy is the runtime component of the integration.

It is invoked using:

```bash
claude-cost-tracker proxy
```

Normally, developers do not need to invoke this command manually.

Claude Code invokes it through the configured `statusLine.command`.

The proxy:

1. Reads `stdin`.
2. Parses the JSON payload.
3. Extracts session information.
4. Updates session storage.
5. Determines the downstream Status Line.
6. Starts the downstream command.
7. Sends the original JSON payload to it.
8. Forwards `stdout`.
9. Forwards `stderr`.
10. Returns the downstream process exit code.

---

# Transparent Forwarding

The proxy forwards the **original input** to the downstream Status Line.

Conceptually:

```text
Claude Code
    │
    │ original JSON
    ▼
Tracker
    │
    │ same JSON
    ▼
Existing Status Line
```

The tracker does not need to modify the payload for the downstream Status Line.

This is important for compatibility with existing Status Line implementations.

---

# Session Tracking

Each session is identified using:

```text
session_id
```

If Claude Code exposes a renamed title, the tracker stores the latest observed
value in `session_name`.

A persisted session contains information such as:

```json
{
  "session_id": "abc123",
  "session_name": "Planning migration session",
  "model": "claude-sonnet",
  "created_at": "2026-08-31T10:00:00.000Z",
  "updated_at": "2026-08-31T10:30:00.000Z",
  "total_cost_usd": 0.8234,
  "checkpoints": []
}
```

The session is updated whenever the proxy receives valid session and cost information.

If no title has been observed yet, `session_name` is stored as `null`.
The tracker persists only this canonical top-level schema and does not write
`model_display_name` or `stages`.

The tracker does not calculate API prices independently.

It uses the cumulative cost reported by Claude Code.

---

# Cost Tracking

Claude Code provides a cumulative session cost.

For example:

```text
Session starts
    │
    ▼
$0.00
    │
    │ Claude Code activity
    ▼
$0.35
    │
    │ more activity
    ▼
$0.80
```

The tracker stores the latest cumulative value:

```text
total_cost_usd = $0.80
```

Stage costs are calculated from differences between checkpoints.

---

# Checkpoints

Checkpoints are designed to track the cost of **individual stages of work performed inside Claude Code**.

The primary use case is not manual execution from an external terminal. A checkpoint is intended to be invoked **from within a Claude Code workflow**, such as a Skill that consists of multiple stages.

For example, a Skill may have the following structure:

```text
Skill
 │
 ├── Stage 1: Analysis
 │      │
 │      └── checkpoint analysis
 │
 ├── Stage 2: Implementation
 │      │
 │      └── checkpoint implementation
 │
 └── Stage 3: Testing
        │
        └── checkpoint testing
```

Each checkpoint marks the current cumulative session cost. Claude Cost Tracker then calculates how much the current stage has consumed since the previous checkpoint and records the model, cost boundaries, UTC time window, and elapsed duration for that stage. For the first recorded stage, the start boundary is unknown until the tracker has a prior checkpoint to anchor from.

---

## Checkpoints Inside Claude Code

A Skill can invoke the CLI during its execution:

```bash
claude-cost-tracker checkpoint analysis
```

Then, after the next stage:

```bash
claude-cost-tracker checkpoint implementation
```

And finally:

```bash
claude-cost-tracker checkpoint testing
```

The important point is that these commands are executed **as part of the Claude Code workflow**.

The Skill does not need to determine which Claude Code session is currently running or manually locate the corresponding session file.

Claude Cost Tracker uses Claude Code's internal environment variables to identify the current session.

---

## Session Identification

When a checkpoint is executed inside Claude Code, the tracker first determines the current Claude Code session.

It uses the following information:

```text
CLAUDE_CODE_SESSION_ID
```

This allows the checkpoint command to associate the stage with the exact session in which the Skill is currently running.

The normal flow is:

```text
Claude Code
    │
    │ internal session information
    ▼
Skill
    │
    │ claude-cost-tracker checkpoint <stage>
    ▼
Claude Cost Tracker
    │
    ├── read CLAUDE_CODE_SESSION_ID
    │
    ├── identify current session
    │
    ├── locate session data
    │
    └── update session file
```

This is important for framework integration because the Skill does not need to pass session identifiers explicitly.

---

## Session File Resolution

Once the current session ID is obtained, Claude Cost Tracker uses it to locate the corresponding session file in its local session storage.

The checkpoint operation then:

1. Reads the session associated with the current Claude Code session.
2. Reads its current cumulative cost.
3. Finds the cost recorded by the previous checkpoint.
4. Calculates the cost of the current stage.
5. Appends the new checkpoint to the session.
6. Writes the updated session back to storage.

Conceptually:

```text
CLAUDE_CODE_SESSION_ID
        │
        ▼
   Session ID
        │
        ▼
<session-id>.json
        │
        ├── total_cost_usd
        └── checkpoints[]
               │
               ▼
        append checkpoint
               │
               ▼
        updated session
```

---

## Stage Cost Calculation

Claude Code reports a cumulative session cost.

For example:

```text
Session cost
    │
    ├── Stage 1 starts
    │
    │   Claude Code work
    │
    ├── Checkpoint: analysis
    │   $0.30
    │
    │   Claude Code work
    │
    ├── Checkpoint: implementation
    │   $0.75
    │
    │   Claude Code work
    │
    └── Checkpoint: testing
        $1.00
```

The tracker calculates each stage from the difference between checkpoints:

```text
analysis
= $0.30 - $0.00
= $0.30

implementation
= $0.75 - $0.30
= $0.45

testing
= $1.00 - $0.75
= $0.25
```

The resulting session contains the individual stage costs under
`checkpoints`:

```json
{
  "checkpoints": [
    {
      "name": "analysis",
      "model": "claude-sonnet-5",
      "cost_before": 0,
      "cost_after": 0.30,
      "cost_usd": 0.30,
      "timestamp_before": null,
      "timestamp_after": "2026-08-31T10:05:00.000Z",
      "time": null
    },
    {
      "name": "implementation",
      "model": "claude-sonnet-5",
      "cost_before": 0.30,
      "cost_after": 0.75,
      "cost_usd": 0.45,
      "timestamp_before": "2026-08-31T10:05:00.000Z",
      "timestamp_after": "2026-08-31T10:20:00.000Z",
      "time": "00:15:00"
    },
    {
      "name": "testing",
      "model": "claude-sonnet-5",
      "cost_before": 0.75,
      "cost_after": 1.00,
      "cost_usd": 0.25,
      "timestamp_before": "2026-08-31T10:20:00.000Z",
      "timestamp_after": "2026-08-31T10:30:00.000Z",
      "time": "00:10:00"
    }
  ]
}
```

---

## Why This Is Useful for Skills

This mechanism allows a framework to measure the cost of individual logical stages rather than only the total cost of a Claude Code session.

For example, a framework may define a Skill such as:

```text
Code Review Skill

    1. Analyze repository
       ↓
       checkpoint analysis

    2. Review implementation
       ↓
       checkpoint review

    3. Generate recommendations
       ↓
       checkpoint recommendations
```

The resulting session data can then answer questions such as:

* How much did the analysis stage cost?
* How expensive was the implementation/review stage?
* Which stage consumes the most tokens/cost?
* How does the cost of the Skill change between runs?

This makes checkpoints particularly useful for **AI-native frameworks and Skills composed of multiple Claude Code stages**.

---

## Explicit Session ID

Although the primary use case is execution inside Claude Code, a session ID can also be supplied explicitly:

```bash
claude-cost-tracker checkpoint <stage> --session-id <id>
```

This is useful for integrations where the Claude Code environment variable is not directly available.

When no explicit session ID is provided, the tracker uses:

```text
CLAUDE_CODE_SESSION_ID
```

The tracker intentionally does not use a "latest session" fallback. A checkpoint must always be associated with a known session to prevent stage costs from being attributed to the wrong Claude Code session.

---

# Status Command

View tracked sessions:

```bash
claude-cost-tracker status
```

If only one session exists, it is displayed directly.

If multiple sessions exist, the CLI displays a selection menu:

```text
Claude Cost Tracker — Sessions

1. Planning migration session
   abc123
   claude-sonnet-5 — $0.8234

2. def456
   claude-opus-4 — $1.2401

Select session [1-2] (0 to exit):
```

After selecting a session:

```text
Total: $0.8234
Time: 30m 0s

Checkpoints:
  planning    $0.2000  -
  implementation    $0.4500  15m 0s
  testing    $0.1700  10m 0s
```

The first recorded stage shows `Unknown` for its start time and elapsed
duration because the tracker has no earlier checkpoint proving when that stage
actually began.

If no renamed session title has been observed yet, the `status` command shows
the raw `session_id` in the `Session:` line and omits the `Session ID:` line.

Sessions are sorted by their last update time.

---

# Doctor Command

Use `doctor` to inspect Claude Cost Tracker setup rather than session data.

The command answers:

* is the tracker set up in the selected scope;
* what downstream Status Line command is active there;
* whether the selected scope has repairable setup problems;
* whether manual repair is required.

By default, `doctor` checks the **global** installation:

```bash
claude-cost-tracker doctor
```

To inspect the **current project** instead:

```bash
claude-cost-tracker doctor --local
```

To apply safe fixes in the selected scope:

```bash
claude-cost-tracker doctor --fix
claude-cost-tracker doctor --local --fix
```

`--fix` is intentionally conservative:

* it may recreate generated tracker files such as project-local `.gitignore` or derived downstream config;
* it does **not** silently run `setup`;
* it does **not** invent missing backup state such as `original-statusline.json`.

Example when the tracker is not installed globally:

```text
Claude Cost Tracker Health Check

Scope: global
    Result: INFO

  Setup globally
    ✗ Not set up
    Claude Cost Tracker is not enabled globally.
    Run: claude-cost-tracker setup
```

Example when a project-local install falls back to a global downstream command:

```text
Claude Cost Tracker Health Check

Scope: project
    Result: OK

  Setup in project
    ✓ Set up
    Downstream command source: global fallback
    Downstream command: npx -y ccstatusline@latest
```

In an interactive terminal, the report title is highlighted in blue, warnings in yellow, failures in red, successful health lines in green, and informational status lines in cyan. Redirected or piped output stays plain text.

---

# Report Command

Generate a self-contained HTML report of all tracked sessions:

```bash
claude-cost-tracker report
```

The command writes `.claude-cost-tracker/report.html` in the current project directory and prints its absolute path to stdout. Open the file in any browser — no web server or internet connection required.

The report has two tabs:

- **Sessions** — all sessions newest-to-oldest. Clicking a row reveals the models used, date range, total cost, and a per-stage breakdown (name, cost, elapsed time).
- **Stages** — every unique stage name across all sessions with aggregate cost stats (total/avg/min/max). Clicking a stage name opens a detail modal showing cost stats, time stats (total/avg/min/max), and a per-session occurrence table.

A dark/light mode toggle is available in the top-right corner; the choice is saved in the browser.

If `.claude-cost-tracker/` does not exist, the command exits non-zero with an error. If the directory exists but contains no sessions, it exits with an informational message.

---

# CLI Reference

## Install

Install globally:

```bash
claude-cost-tracker setup
```

Install for the current project:

```bash
claude-cost-tracker setup --local
```

This command also creates, or backfills if it is missing, `<project>/.claude-cost-tracker/.gitignore` with the local-only ignore policy shown in [Local Installation](#local-installation).

---

## Uninstall

Remove global installation:

```bash
claude-cost-tracker uninstall
```

Remove local installation:

```bash
claude-cost-tracker uninstall --local
```

---

## Proxy

Run the Status Line middleware:

```bash
claude-cost-tracker proxy
```

This command is normally executed by Claude Code.

---

## Checkpoint

Create a checkpoint for the current session:

```bash
claude-cost-tracker checkpoint <stage>
```

Example:

```bash
claude-cost-tracker checkpoint planning
```

Use an explicit session:

```bash
claude-cost-tracker checkpoint planning --session-id <id>
```

---

## Status

Display tracked sessions:

```bash
claude-cost-tracker status
```

---

## Doctor

Inspect global setup:

```bash
claude-cost-tracker doctor
```

Inspect the current project:

```bash
claude-cost-tracker doctor --local
```

Repair safe setup issues in the selected scope:

```bash
claude-cost-tracker doctor --fix
claude-cost-tracker doctor --local --fix
```

`doctor` reports one downstream command per scope, or explicitly reports that no downstream command is configured.

---

## Report

Generate an HTML report of all tracked sessions in the current project:

```bash
claude-cost-tracker report
```

Writes `.claude-cost-tracker/report.html` and prints its absolute path to stdout. The file is fully self-contained (no external network requests). The report includes a Sessions tab, a Stages tab with aggregate stats, per-stage cost and time breakdowns in a modal, and a dark/light mode toggle.

---

# Uninstallation

The tracker is designed to be removable without permanently modifying the user's existing Status Line.

When uninstalling, the tracker:

```text
1. Reads Claude Code settings
2. Verifies that the tracker proxy is currently installed
3. Reads the original Status Line
4. Restores it
5. Removes tracker-specific configuration
```

For example:

```text
Before installation:

Claude Code
    │
    ▼
ccstatusline


After installation:

Claude Code
    │
    ▼
Claude Cost Tracker
    │
    ▼
ccstatusline


After uninstall:

Claude Code
    │
    ▼
ccstatusline
```

The original Status Line is therefore restored to its previous configuration.

---

# Project Structure

The package is organized around separate responsibilities:

```text
claude-cost-tracker/
│
├── bin/
│   └── claude-cost-tracker.js
│
├── src/
│   │
│   ├── integration/
│   │   └── claude-code-config.js
│   │
│   ├── session/
│   │   ├── session-record.js
│   │   ├── session-store.js
│   │   └── session-service.js
│   │
│   ├── report/
│   │   └── report-html.js
│   │
│   └── status/
│       └── status-service.js
│
├── package.json
└── README.md
```

## CLI

```text
bin/claude-cost-tracker.js
```

Responsible for:

* CLI commands;
* proxy execution;
* input/output;
* connecting CLI commands to services.

## Integration

```text
src/integration/claude-code-config.js
```

Responsible for:

* global installation;
* local installation;
* uninstall;
* Claude Code settings;
* original Status Line;
* downstream Status Line.

## Session Store

```text
src/session/session-store.js
```

Responsible for:

* reading sessions;
* writing sessions;
* listing sessions;
* rewriting saved sessions into the canonical top-level schema.

## Session Record Helpers

```text
src/session/session-record.js
```

Responsible for:

* canonical session normalization;
* top-level legacy compatibility such as `stages -> checkpoints`;
* shared helpers for session naming and checkpoint collection access.

## Session Service

```text
src/session/session-service.js
```

Responsible for:

* checkpoint logic;
* stage cost calculation;
* checkpoint validation;
* appending new entries to the `checkpoints` collection.

## Status Service

```text
src/status/status-service.js
```

Responsible for preparing session data for the `status` command.

---

# Limitations

Claude Cost Tracker depends on Claude Code providing the required information through its Status Line payload.

Cost tracking requires:

```text
session_id
cost.total_cost_usd
```

to be available.

Session naming additionally depends on Claude Code exposing `session_name` in
the Status Line payload. If it is absent, the tracker keeps the last known
title or stores `null`.

The tracker does not independently calculate Claude API pricing from token counts.

Instead, it uses the cumulative cost reported by Claude Code.

---

# License

See the repository license for details.
