function getNonEmptyString(value) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return null;
  }

  return value;
}

function getSessionCheckpoints(session) {
  if (
    Array.isArray(
      session?.checkpoints
    )
  ) {
    return session.checkpoints;
  }

  if (
    Array.isArray(session?.stages)
  ) {
    return session.stages;
  }

  return [];
}

function normalizeSession(session) {
  const source =
    session &&
    typeof session === "object"
      ? session
      : {};

  const totalCost =
    Number(source.total_cost_usd);

  return {
    session_id:
      getNonEmptyString(
        source.session_id
      ),

    session_name:
      getNonEmptyString(
        source.session_name
      ),

    model:
      getNonEmptyString(
        source.model
      ),

    created_at:
      getNonEmptyString(
        source.created_at
      ),

    updated_at:
      getNonEmptyString(
        source.updated_at
      ),

    total_cost_usd:
      Number.isFinite(totalCost)
        ? totalCost
        : null,

    checkpoints:
      getSessionCheckpoints(
        source
      )
  };
}

module.exports = {
  getNonEmptyString,
  getSessionCheckpoints,
  normalizeSession
};
