const {
  readSession,
  writeSession
} = require("./session-store");
 
function recordCheckpoint(sessionId, stage) {
  const session =
    readSession(sessionId);
 
  if (!session) {
    throw new Error(
      `Session file not found for session: ${sessionId}`
    );
  }
 
  const currentCost =
    Number(session.total_cost_usd);
 
  if (!Number.isFinite(currentCost)) {
    throw new Error(
      "Current session cost is unavailable."
    );
  }
 
  if (!Array.isArray(session.stages)) {
    session.stages = [];
  }
 
  let previousCost = 0;
 
  if (session.stages.length > 0) {
    const lastStage =
      session.stages[
        session.stages.length - 1
      ];
 
    if (
      !Number.isFinite(
        Number(lastStage.ended_cost_usd)
      )
    ) {
      throw new Error(
        "Previous checkpoint contains invalid cost data."
      );
    }
 
    previousCost =
      Number(lastStage.ended_cost_usd);
  }
 
  const stageCost =
    currentCost - previousCost;
 
  if (stageCost < 0) {
    throw new Error(
      `Current session cost is lower than previous checkpoint. ` +
      `Previous: $${previousCost.toFixed(4)}, ` +
      `Current: $${currentCost.toFixed(4)}`
    );
  }
 
  const now =
    new Date().toISOString();
 
  session.stages.push({
    name: stage,
 
    started_cost_usd:
      previousCost,
 
    ended_cost_usd:
      currentCost,
 
    cost_usd:
      stageCost,
 
    timestamp:
      now
  });
 
  session.updated_at =
    now;
 
  writeSession(
    sessionId,
    session
  );
 
  return {
    sessionId,
    stage,
    stageCost,
    totalCost: currentCost
  };
}
 
module.exports = {
  recordCheckpoint
};
