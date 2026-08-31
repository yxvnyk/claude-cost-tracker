
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
- [CLI Reference](#cli-reference)
  - [Install](#install)
  - [Uninstall](#uninstall)
  - [Proxy](#proxy)
  - [Checkpoint](#checkpoint)
  - [Status](#status)
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
  "model": {
    "id": "claude-sonnet",
    "display_name": "Claude Sonnet"
  },
  "cost": {
    "total_cost_usd": 0.1234
  }
}
```

Claude Cost Tracker uses:

```text
session_id
model.id
model.display_name
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
claude-cost-tracker install
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
claude-cost-tracker install --local
```

Claude Code configuration:

```text
<project>/.claude/settings.json
```

Tracker configuration:

```text
<project>/.claude-cost-tracker/
├── config.json
└── original-statusline.json
```

The tracker keeps its project-specific state outside of `.claude`.

---

# Global vs Local Installation

|                      | Global                    | Local                             |
| -------------------- | ------------------------- | --------------------------------- |
| Claude Code settings | `~/.claude/settings.json` | `<project>/.claude/settings.json` |
| Tracker directory    | `~/.claude-cost-tracker/` | `<project>/.claude-cost-tracker/` |
| Scope                | All projects              | Current project                   |
| Installation         | `install`                 | `install --local`                 |
| Uninstallation       | `uninstall`               | `uninstall --local`               |

Local installation is useful when a framework or project needs its Claude Code integration to be isolated from the user's global environment.



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

A session contains information such as:

```json
{
  "session_id": "abc123",
  "model": "claude-sonnet",
  "model_display_name": "Claude Sonnet",
  "created_at": "2026-08-31T10:00:00.000Z",
  "updated_at": "2026-08-31T10:30:00.000Z",
  "total_cost_usd": 0.8234,
  "stages": []
}
```

The session is updated whenever the proxy receives valid session and cost information.

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

Each checkpoint marks the current cumulative session cost. Claude Cost Tracker then calculates how much the current stage has consumed since the previous checkpoint.

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
        └── stages[]
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

The resulting session contains the individual stage costs:

```json
{
  "stages": [
    {
      "name": "analysis",
      "started_cost_usd": 0,
      "ended_cost_usd": 0.30,
      "cost_usd": 0.30
    },
    {
      "name": "implementation",
      "started_cost_usd": 0.30,
      "ended_cost_usd": 0.75,
      "cost_usd": 0.45
    },
    {
      "name": "testing",
      "started_cost_usd": 0.75,
      "ended_cost_usd": 1.00,
      "cost_usd": 0.25
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

1. abc123
   Claude Sonnet — $0.8234

2. def456
   Claude Opus — $1.2401

Select session [1-2] (0 to exit):
```

After selecting a session:

```text
Session: abc123
Model: Claude Sonnet

Total: $0.8234

Stages:
 planning $0.20
 implementation $0.45
 testing $0.17
```

Sessions are sorted by their last update time.

---

# CLI Reference

## Install

Install globally:

```bash
claude-cost-tracker install
```

Install for the current project:

```bash
claude-cost-tracker install --local
```

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
│   │   ├── session-store.js
│   │   └── session-service.js
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
* listing sessions.

## Session Service

```text
src/session/session-service.js
```

Responsible for:

* checkpoint logic;
* stage cost calculation;
* checkpoint validation.

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

The tracker does not independently calculate Claude API pricing from token counts.

Instead, it uses the cumulative cost reported by Claude Code.

---

# License

See the repository license for details.
