const {
  getSessions
} = require("../session/session-store");
 
function getStatusSessions() {
  const sessions =
    getSessions();
 
  sessions.sort((a, b) => {
    const aTime =
      Date.parse(a.updated_at ?? "") || 0;
 
    const bTime =
      Date.parse(b.updated_at ?? "") || 0;
 
    return bTime - aTime;
  });
 
  return sessions;
}
 
module.exports = {
  getStatusSessions
};