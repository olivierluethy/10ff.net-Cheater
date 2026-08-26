// Session telemetry helpers for the popup. Sessions are written by the content
// script when a race finishes; the popup only reads and summarizes them.

export function getSessions() {
  return new Promise((resolve) => {
    chrome.storage.local.get("sessions", (data) => {
      resolve(Array.isArray(data.sessions) ? data.sessions : []);
    });
  });
}

export function clearSessions() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ sessions: [] }, () => resolve());
  });
}

// Aggregate figures used by the telemetry panel.
export function summarize(sessions) {
  if (!sessions.length) {
    return { count: 0, best: 0, avgWpm: 0, avgAccuracy: 0 };
  }
  const best = Math.max(...sessions.map((s) => s.wpm));
  const avgWpm = Math.round(
    sessions.reduce((sum, s) => sum + s.wpm, 0) / sessions.length
  );
  const avgAccuracy = Math.round(
    sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length
  );
  return { count: sessions.length, best, avgWpm, avgAccuracy };
}
