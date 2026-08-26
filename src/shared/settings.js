// Single source of truth for user settings, shared by the popup UI.
// The content script keeps its own minimal fallbacks and reads whatever the
// popup persists here, so this schema stays authoritative.

export const DEFAULT_SETTINGS = {
  speedMode: "human", // slow | human | fast | max | custom
  intervalMs: 250, // base delay between words (lower = faster)
  randomize: true, // vary the delay each word so timing looks human
  randomJitter: 150, // +/- range applied to the base delay (ms)
  accuracy: 100, // % of words typed correctly; below 100 introduces typos
  minIntervalMs: 30, // clamp: fastest allowed delay
  maxIntervalMs: 2000, // clamp: slowest allowed delay
};

// Preset modes. Picking one writes its intervalMs + randomJitter into settings;
// the throttle then reflects that value. "custom" is entered by dragging.
export const SPEED_MODES = {
  slow: { label: "Slow", intervalMs: 600, randomJitter: 250 },
  human: { label: "Human", intervalMs: 250, randomJitter: 150 },
  fast: { label: "Fast", intervalMs: 120, randomJitter: 60 },
  max: { label: "Max", intervalMs: 35, randomJitter: 0 },
};

// One word is typed per delay, so words/minute ≈ 60000 / delay.
export function intervalToWpm(ms) {
  if (!ms || ms <= 0) return 0;
  return Math.round(60000 / ms);
}

export function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get("settings", (data) => {
      resolve({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
    });
  });
}

export function saveSettings(patch) {
  return getSettings().then(
    (current) =>
      new Promise((resolve) => {
        const next = { ...current, ...patch };
        chrome.storage.local.set({ settings: next }, () => resolve(next));
      })
  );
}
