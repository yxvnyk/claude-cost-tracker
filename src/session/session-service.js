const {
  readSession,
  writeSession
} = require("./session-store");
const {
  formatElapsedTime,
  getStageCostAfter,
  getStageModel,
  resolveStageStartTimestamp
} = require("./stage-record");

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
  let previousStage = null;
 
  if (session.stages.length > 0) {
    previousStage =
      session.stages[
        session.stages.length - 1
      ];
 
    if (
      !Number.isFinite(
        getStageCostAfter(previousStage)
      )
    ) {
      throw new Error(
        "Previous checkpoint contains invalid cost data."
      );
    }
 
    previousCost =
      getStageCostAfter(previousStage);
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

  const timestampBefore =
    resolveStageStartTimestamp(
      previousStage
    );
 
  session.stages.push({
    name: stage,

    model:
      getStageModel(session),
 
    cost_before:
      previousCost,
 
    cost_after:
      currentCost,
 
    cost_usd:
      stageCost,
 
    timestamp_before:
      timestampBefore,

    timestamp_after:
      now,

    time:
      formatElapsedTime(
        timestampBefore,
        now
      )
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
