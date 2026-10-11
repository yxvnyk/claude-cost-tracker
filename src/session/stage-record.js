function getNumericField(stage, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = Number(stage?.[fieldName]);

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return NaN;
}

function getStringField(record, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = record?.[fieldName];

    if (
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      return value;
    }
  }

  return null;
}

function getStageCostBefore(stage) {
  return getNumericField(
    stage,
    [
      "cost_before",
      "started_cost_usd"
    ]
  );
}

function getStageCostAfter(stage) {
  return getNumericField(
    stage,
    [
      "cost_after",
      "ended_cost_usd"
    ]
  );
}

function getStageTimestampBefore(stage) {
  return getStringField(
    stage,
    [
      "timestamp_before",
      "timestamp"
    ]
  );
}

function getStageTimestampAfter(stage) {
  return getStringField(
    stage,
    [
      "timestamp_after",
      "timestamp"
    ]
  );
}

function getStageModel(session) {
  if (
    typeof session?.model === "string" &&
    session.model.trim() !== ""
  ) {
    return session.model;
  }

  return "undefined";
}

function resolveStageStartTimestamp(
  previousStage
) {
  return (
    getStageTimestampAfter(previousStage) ??
    null
  );
}

function formatElapsedTime(
  timestampBefore,
  timestampAfter
) {
  if (
    typeof timestampBefore !== "string" ||
    timestampBefore.trim() === "" ||
    typeof timestampAfter !== "string" ||
    timestampAfter.trim() === ""
  ) {
    return null;
  }

  const startTime =
    Date.parse(timestampBefore);

  const endTime =
    Date.parse(timestampAfter);

  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime)
  ) {
    return null;
  }

  const elapsedMs =
    Math.max(0, endTime - startTime);

  const totalSeconds =
    Math.floor(elapsedMs / 1000);

  const hours =
    String(
      Math.floor(totalSeconds / 3600)
    ).padStart(2, "0");

  const minutes =
    String(
      Math.floor(
        (totalSeconds % 3600) / 60
      )
    ).padStart(2, "0");

  const seconds =
    String(
      totalSeconds % 60
    ).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

module.exports = {
  formatElapsedTime,
  getStageCostAfter,
  getStageCostBefore,
  getStageModel,
  getStageTimestampAfter,
  getStageTimestampBefore,
  resolveStageStartTimestamp
};
