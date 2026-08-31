const fs = require("fs");
const path = require("path");
 
const PROJECT_TRACKER_DIR = path.join(
  process.cwd(),
  ".claude-cost-tracker"
);
 
const SESSIONS_DIR = path.join(
  PROJECT_TRACKER_DIR,
  "sessions"
);
 
function getSessionsDir() {
  return SESSIONS_DIR;
}
 
function getSessionFile(sessionId) {
  return path.join(
    SESSIONS_DIR,
    `${sessionId}.json`
  );
}
 
function readSession(sessionId) {
  const filePath =
    getSessionFile(sessionId);
 
  if (!fs.existsSync(filePath)) {
    return null;
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
      `Cannot parse session file: ${filePath}`
    );
  }
}
 
function writeSession(sessionId, session) {
  const filePath =
    getSessionFile(sessionId);
 
  fs.mkdirSync(
    SESSIONS_DIR,
    {
      recursive: true
    }
  );
 
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      session,
      null,
      2
    ),
    "utf8"
  );
}
 
function getSessionIds() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    return [];
  }
 
  return fs.readdirSync(SESSIONS_DIR)
    .filter(file => file.endsWith(".json"))
    .map(file =>
      path.basename(file, ".json")
    );
}
 
function getSessions() {
  const sessionIds =
    getSessionIds();
 
  const sessions = [];
 
  for (const sessionId of sessionIds) {
    try {
      const session =
        readSession(sessionId);
 
      if (
        session &&
        session.session_id
      ) {
        sessions.push(session);
      }
    } catch {
      // Ignore invalid session files.
    }
  }
 
  return sessions;
}
 
module.exports = {
  getSessionsDir,
  getSessionFile,
  readSession,
  writeSession,
  getSessionIds,
  getSessions
};