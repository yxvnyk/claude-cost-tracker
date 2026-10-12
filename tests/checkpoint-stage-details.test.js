const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const CLI_PATH = path.resolve(
  __dirname,
  "../bin/claude-cost-tracker.js"
);

const STAGE_RECORD_MODULE_PATH =
  require.resolve(
    "../src/session/stage-record"
  );
const SESSION_STORE_MODULE_PATH =
  require.resolve(
    "../src/session/session-store"
  );
const SESSION_SERVICE_MODULE_PATH =
  require.resolve(
    "../src/session/session-service"
  );

function createTestDirectories(t) {
  const root = fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "claude-cost-tracker-stage-"
    )
  );
  const home = path.join(root, "home");
  const project = path.join(root, "project");

  fs.mkdirSync(home);
  fs.mkdirSync(project);

  t.after(() => {
    const relativePath = path.relative(
      os.tmpdir(),
      root
    );

    assert.ok(
      relativePath &&
        !relativePath.startsWith("..") &&
        !path.isAbsolute(relativePath),
      "test cleanup target must remain inside the OS temporary directory"
    );

    const currentCwd =
      process.cwd();
    const cwdRelativeToRoot =
      path.relative(
        root,
        currentCwd
      );

    if (
      cwdRelativeToRoot === "" ||
      (
        cwdRelativeToRoot &&
        !cwdRelativeToRoot.startsWith("..") &&
        !path.isAbsolute(cwdRelativeToRoot)
      )
    ) {
      process.chdir(os.tmpdir());
    }

    fs.rmSync(root, {
      recursive: true,
      force: true
    });
  });

  return { home, project };
}

function clearSessionModules() {
  delete require.cache[
    STAGE_RECORD_MODULE_PATH
  ];
  delete require.cache[
    SESSION_STORE_MODULE_PATH
  ];
  delete require.cache[
    SESSION_SERVICE_MODULE_PATH
  ];
}

function loadSessionModules(project) {
  clearSessionModules();

  const previousCwd =
    process.cwd();

  process.chdir(project);

  const sessionStore =
    require("../src/session/session-store");
  const sessionService =
    require("../src/session/session-service");

  return {
    sessionStore,
    sessionService,
    restore() {
      process.chdir(previousCwd);
      clearSessionModules();
    }
  };
}

function withFixedDate(
  fixedIsoTimestamp,
  callback
) {
  const RealDate = Date;

  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fixedIsoTimestamp);
        return;
      }

      super(...args);
    }

    static now() {
      return new RealDate(
        fixedIsoTimestamp
      ).getTime();
    }

    static parse(value) {
      return RealDate.parse(value);
    }

    static UTC(...args) {
      return RealDate.UTC(...args);
    }
  }

  global.Date = FakeDate;

  try {
    return callback();
  } finally {
    global.Date = RealDate;
  }
}

function runStatusCli({
  home,
  project
}) {
  return spawnSync(
    process.execPath,
    [CLI_PATH, "status"],
    {
      cwd: project,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home
      }
    }
  );
}

function runProxyCli({
  home,
  project,
  payload
}) {
  return spawnSync(
    process.execPath,
    [CLI_PATH, "proxy"],
    {
      cwd: project,
      input: JSON.stringify(payload),
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home
      }
    }
  );
}

function writeRawSessionFile(
  project,
  sessionId,
  session
) {
  const sessionsDir = path.join(
    project,
    ".claude-cost-tracker",
    "sessions"
  );

  fs.mkdirSync(sessionsDir, {
    recursive: true
  });

  fs.writeFileSync(
    path.join(
      sessionsDir,
      `${sessionId}.json`
    ),
    JSON.stringify(
      session,
      null,
      2
    ),
    "utf8"
  );
}

function readRawSessionFile(
  project,
  sessionId
) {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        project,
        ".claude-cost-tracker",
        "sessions",
        `${sessionId}.json`
      ),
      "utf8"
    )
  );
}

test(
  "recordCheckpoint stores unknown timing for a first checkpoint",
  t => {
    const { project } =
      createTestDirectories(t);
    const {
      sessionStore,
      sessionService,
      restore
    } = loadSessionModules(project);

    t.after(restore);

    const fixedTimestamp =
      "2026-10-11T12:00:00.000Z";

    sessionStore.writeSession(
      "session-1",
      {
        session_id: "session-1",
        model: "claude-sonnet-5",
        created_at: fixedTimestamp,
        updated_at: fixedTimestamp,
        total_cost_usd: 1.5,
        checkpoints: []
      }
    );

    withFixedDate(
      fixedTimestamp,
      () => {
        sessionService.recordCheckpoint(
          "session-1",
          "analysis"
        );
      }
    );

    const savedSession =
      sessionStore.readSession(
        "session-1"
      );

    assert.equal(
      savedSession.session_name,
      null
    );

    assert.deepEqual(
      savedSession.checkpoints[0],
      {
        name: "analysis",
        model: "claude-sonnet-5",
        cost_before: 0,
        cost_after: 1.5,
        cost_usd: 1.5,
        timestamp_before:
          null,
        timestamp_after:
          fixedTimestamp,
        time: null
      }
    );
  }
);

test(
  "recordCheckpoint migrates legacy stages into checkpoints without losing history",
  t => {
    const { project } =
      createTestDirectories(t);
    const {
      sessionService,
      restore
    } = loadSessionModules(project);

    t.after(restore);

    const previousTimestamp =
      "2026-10-11T10:00:00.000Z";
    const currentTimestamp =
      "2026-10-11T10:05:07.000Z";

    writeRawSessionFile(
      project,
      "session-2",
      {
        session_id: "session-2",
        session_name:
          "Legacy planning session",
        model: null,
        model_display_name:
          "Sonnet 5",
        created_at:
          "2026-10-11T09:55:00.000Z",
        updated_at:
          previousTimestamp,
        total_cost_usd: 2.5,
        stages: [
          {
            name: "analysis",
            started_cost_usd: 0,
            ended_cost_usd: 1.25,
            cost_usd: 1.25,
            timestamp:
              previousTimestamp
          }
        ]
      }
    );

    withFixedDate(
      currentTimestamp,
      () => {
        sessionService.recordCheckpoint(
          "session-2",
          "implementation"
        );
      }
    );

    const savedSession =
      readRawSessionFile(
        project,
        "session-2"
      );

    assert.equal(
      savedSession.session_name,
      "Legacy planning session"
    );
    assert.equal(
      Object.hasOwn(
        savedSession,
        "stages"
      ),
      false
    );
    assert.equal(
      Object.hasOwn(
        savedSession,
        "model_display_name"
      ),
      false
    );

    assert.deepEqual(
      savedSession.checkpoints[0],
      {
        name: "analysis",
        started_cost_usd: 0,
        ended_cost_usd: 1.25,
        cost_usd: 1.25,
        timestamp:
          previousTimestamp
      }
    );

    assert.deepEqual(
      savedSession.checkpoints[1],
      {
        name: "implementation",
        model: "undefined",
        cost_before: 1.25,
        cost_after: 2.5,
        cost_usd: 1.25,
        timestamp_before:
          previousTimestamp,
        timestamp_after:
          currentTimestamp,
        time: "00:05:07"
      }
    );
  }
);

test(
  "recordCheckpoint keeps zero duration when known timestamps are equal",
  t => {
    const { project } =
      createTestDirectories(t);
    const {
      sessionStore,
      sessionService,
      restore
    } = loadSessionModules(project);

    t.after(restore);

    const sharedTimestamp =
      "2026-10-11T10:05:07.000Z";

    sessionStore.writeSession(
      "session-3",
      {
        session_id: "session-3",
        model: "claude-sonnet-5",
        created_at:
          "2026-10-11T10:00:00.000Z",
        updated_at:
          sharedTimestamp,
        total_cost_usd: 3.25,
        checkpoints: [
          {
            name: "analysis",
            model: "claude-sonnet-5",
            cost_before: 0,
            cost_after: 2.5,
            cost_usd: 2.5,
            timestamp_before: null,
            timestamp_after:
              sharedTimestamp,
            time: null
          }
        ]
      }
    );

    withFixedDate(
      sharedTimestamp,
      () => {
        sessionService.recordCheckpoint(
          "session-3",
          "implementation"
        );
      }
    );

    const savedSession =
      sessionStore.readSession(
        "session-3"
      );

    assert.deepEqual(
      savedSession.checkpoints[1],
      {
        name: "implementation",
        model: "claude-sonnet-5",
        cost_before: 2.5,
        cost_after: 3.25,
        cost_usd: 0.75,
        timestamp_before:
          sharedTimestamp,
        timestamp_after:
          sharedTimestamp,
        time: "00:00:00"
      }
    );
  }
);

test(
  "status prints unknown timing from checkpoints and shows the session name",
  t => {
    const {
      home,
      project
    } = createTestDirectories(t);

    writeRawSessionFile(
      project,
      "session-4",
      {
        session_id: "session-4",
        session_name:
          "Renamed planning session",
        model: "claude-sonnet-5",
        created_at:
          "2026-10-11T10:00:00.000Z",
        updated_at:
          "2026-10-11T10:05:07.000Z",
        total_cost_usd: 2.5,
        checkpoints: [
          {
            name: "analysis",
            model: "claude-sonnet-5",
            cost_before: 0,
            cost_after: 2.5,
            cost_usd: 2.5,
            timestamp_before:
              null,
            timestamp_after:
              "2026-10-11T10:05:07.000Z",
            time: null
          }
        ]
      }
    );

    const result =
      runStatusCli({
        home,
        project
      });

    assert.equal(
      result.status,
      0,
      result.stderr
    );

    assert.match(
      result.stdout,
      /Session: Renamed planning session/
    );
    assert.match(
      result.stdout,
      /Session ID: session-4/
    );
    assert.match(
      result.stdout,
      /Model: claude-sonnet-5/
    );
    assert.match(
      result.stdout,
      /Checkpoints:/
    );
    assert.match(
      result.stdout,
      /analysis\s+\$2\.5000/
    );
    assert.match(
      result.stdout,
      /model: claude-sonnet-5 \| elapsed: Unknown/
    );
    assert.match(
      result.stdout,
      /cost: \$0\.0000 -> \$2\.5000/
    );
    assert.match(
      result.stdout,
      /from: Unknown/
    );
    assert.match(
      result.stdout,
      /to:\s+2026-10-11T10:05:07\.000Z/
    );
  }
);

test(
  "proxy stores session_name using the canonical session schema",
  t => {
    const {
      home,
      project
    } = createTestDirectories(t);

    const result =
      runProxyCli({
        home,
        project,
        payload: {
          session_id: "session-5",
          session_name:
            "Schema migration session",
          model: {
            id: "claude-opus-4",
            display_name:
              "Claude Opus 4"
          },
          cost: {
            total_cost_usd: 1.75
          }
        }
      });

    assert.equal(
      result.status,
      0,
      result.stderr
    );

    const savedSession =
      readRawSessionFile(
        project,
        "session-5"
      );

    assert.equal(
      savedSession.session_id,
      "session-5"
    );
    assert.equal(
      savedSession.session_name,
      "Schema migration session"
    );
    assert.equal(
      savedSession.model,
      "claude-opus-4"
    );
    assert.equal(
      savedSession.total_cost_usd,
      1.75
    );
    assert.deepEqual(
      savedSession.checkpoints,
      []
    );
    assert.equal(
      savedSession.created_at,
      savedSession.updated_at
    );
    assert.equal(
      Object.hasOwn(
        savedSession,
        "stages"
      ),
      false
    );
    assert.equal(
      Object.hasOwn(
        savedSession,
        "model_display_name"
      ),
      false
    );
  }
);

test(
  "proxy preserves the last known session name until a newer one is observed",
  t => {
    const {
      home,
      project
    } = createTestDirectories(t);

    const initialResult =
      runProxyCli({
        home,
        project,
        payload: {
          session_id: "session-6",
          session_name:
            "Original title",
          model: {
            id: "claude-sonnet-5"
          },
          cost: {
            total_cost_usd: 1
          }
        }
      });

    assert.equal(
      initialResult.status,
      0,
      initialResult.stderr
    );

    const missingTitleResult =
      runProxyCli({
        home,
        project,
        payload: {
          session_id: "session-6",
          model: {
            id: "claude-sonnet-5"
          },
          cost: {
            total_cost_usd: 1.5
          }
        }
      });

    assert.equal(
      missingTitleResult.status,
      0,
      missingTitleResult.stderr
    );

    let savedSession =
      readRawSessionFile(
        project,
        "session-6"
      );

    assert.equal(
      savedSession.session_name,
      "Original title"
    );

    const renamedResult =
      runProxyCli({
        home,
        project,
        payload: {
          session_id: "session-6",
          session_name:
            "Updated title",
          model: {
            id: "claude-sonnet-5"
          },
          cost: {
            total_cost_usd: 2
          }
        }
      });

    assert.equal(
      renamedResult.status,
      0,
      renamedResult.stderr
    );

    savedSession =
      readRawSessionFile(
        project,
        "session-6"
      );

    assert.equal(
      savedSession.session_name,
      "Updated title"
    );
  }
);
