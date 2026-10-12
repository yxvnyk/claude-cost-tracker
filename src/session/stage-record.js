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

function getElapsedSeconds(
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

  return Math.floor(
    Math.max(0, endTime - startTime) /
      1000
  );
}

function formatElapsedSeconds(
  totalSeconds
) {
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

function parseElapsedTime(
  elapsedTime
) {
  if (
    typeof elapsedTime !== "string" ||
    elapsedTime.trim() === ""
  ) {
    return null;
  }

  const match =
    /^(\d+):([0-5]\d):([0-5]\d)$/.exec(
      elapsedTime.trim()
    );

  if (!match) {
    return null;
  }

  const hours =
    Number(match[1]);
  const minutes =
    Number(match[2]);
  const seconds =
    Number(match[3]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds)
  ) {
    return null;
  }

  return (
    hours * 3600 +
    minutes * 60 +
    seconds
  );
}

function formatCompactElapsedTime(
  totalSeconds
) {
  if (
    !Number.isInteger(totalSeconds) ||
    totalSeconds < 0
  ) {
    return null;
  }

  const hours =
    Math.floor(totalSeconds / 3600);
  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );
  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function formatElapsedTime(
  timestampBefore,
  timestampAfter
) {
  const totalSeconds =
    getElapsedSeconds(
      timestampBefore,
      timestampAfter
    );

  if (totalSeconds === null) {
    return null;
  }

  return formatElapsedSeconds(
    totalSeconds
  );
}

function formatElapsedTimeForDisplay(
  elapsedTime
) {
  const totalSeconds =
    parseElapsedTime(elapsedTime);

  if (totalSeconds === null) {
    return null;
  }

  return formatCompactElapsedTime(
    totalSeconds
  );
}

function formatElapsedRangeForDisplay(
  timestampBefore,
  timestampAfter
) {
  const totalSeconds =
    getElapsedSeconds(
      timestampBefore,
      timestampAfter
    );

  if (totalSeconds === null) {
    return null;
  }

  return formatCompactElapsedTime(
    totalSeconds
  );
}

module.exports = {
  formatElapsedRangeForDisplay,
  formatElapsedTime,
  formatElapsedTimeForDisplay,
  getStageCostAfter,
  getStageCostBefore,
  getStageModel,
  getStageTimestampAfter,
  getStageTimestampBefore,
  resolveStageStartTimestamp
};
