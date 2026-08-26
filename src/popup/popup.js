import {
  DEFAULT_SETTINGS,
  SPEED_MODES,
  intervalToWpm,
  getSettings,
  saveSettings,
} from "../shared/settings.js";
import { getSessions, clearSessions, summarize } from "../shared/stats.js";

// ---- throttle mapping ----------------------------------------------------
// The fader is 0..1000. It maps logarithmically to the delay so the fast end
// (redline) has fine control. Right = faster = shorter delay.
const THROTTLE_MAX = 1000;
const REDLINE_AT = 0.85; // fraction of throttle where the UI goes hot

function throttleToInterval(t, s) {
  const min = s.minIntervalMs;
  const max = s.maxIntervalMs;
  const frac = 1 - t / THROTTLE_MAX; // t=1000 -> 0 -> fastest
  return Math.round(min * Math.pow(max / min, frac));
}

function intervalToThrottle(ms, s) {
  const min = s.minIntervalMs;
  const max = s.maxIntervalMs;
  const clamped = Math.max(min, Math.min(max, ms));
  const frac = Math.log(clamped / min) / Math.log(max / min);
  return Math.round((1 - frac) * THROTTLE_MAX);
}

// ---- element handles -----------------------------------------------------
const el = (id) => document.getElementById(id);
const els = {
  status: el("status"),
  statusLabel: el("statusLabel"),
  siteHint: el("siteHint"),
  start: el("startBtn"),
  restart: el("restartBtn"),
  modes: el("modes"),
  throttle: el("throttle"),
  speedReadout: el("speedReadout"),
  randomize: el("randomize"),
  jitterField: el("jitterField"),
  jitter: el("jitter"),
  jitterReadout: el("jitterReadout"),
  accuracy: el("accuracy"),
  accuracyReadout: el("accuracyReadout"),
  accuracyNote: el("accuracyNote"),
  statWpm: el("statWpm"),
  statAcc: el("statAcc"),
  statWords: el("statWords"),
  statsEmpty: el("statsEmpty"),
  history: el("history"),
  historyChart: el("historyChart"),
  bestWpm: el("bestWpm"),
  avgWpm: el("avgWpm"),
  avgAcc: el("avgAcc"),
  clearStats: el("clearStats"),
  copyright: el("copyright"),
};

let settings = { ...DEFAULT_SETTINGS };
let activeTabId = null;
let onSupportedSite = false;

// ---- rendering -----------------------------------------------------------

function renderSpeed() {
  els.throttle.value = intervalToThrottle(settings.intervalMs, settings);
  const wpm = intervalToWpm(settings.intervalMs);
  els.speedReadout.textContent = `${settings.intervalMs} ms · ~${wpm} WPM`;

  const frac = Number(els.throttle.value) / THROTTLE_MAX;
  document.body.classList.toggle("redline", frac >= REDLINE_AT);

  for (const btn of els.modes.querySelectorAll(".mode")) {
    btn.setAttribute(
      "aria-pressed",
      String(btn.dataset.mode === settings.speedMode)
    );
  }
}

function renderVariance() {
  els.randomize.checked = settings.randomize;
  els.jitter.value = settings.randomJitter;
  els.jitterReadout.textContent = `± ${settings.randomJitter} ms`;
  els.jitterField.classList.toggle("field--off", !settings.randomize);
}

function renderAccuracy() {
  els.accuracy.value = settings.accuracy;
  els.accuracyReadout.textContent = `${settings.accuracy}%`;
  els.accuracyNote.textContent =
    settings.accuracy >= 100
      ? "Every word typed perfectly."
      : `Roughly ${100 - settings.accuracy} in 100 words fumbled on purpose.`;
}

function renderState(state) {
  const s = state || "idle";
  els.status.dataset.state = s;
  els.statusLabel.textContent =
    s === "running" ? "Running" : s === "finished" ? "Finished" : "Idle";

  const running = s === "running";
  const finished = s === "finished";

  els.start.hidden = finished;
  els.restart.hidden = !finished;

  if (!onSupportedSite) {
    els.start.disabled = true;
    els.start.textContent = "Start auto-typing";
  } else if (running) {
    els.start.disabled = true;
    els.start.textContent = "Auto-typing…";
    els.start.classList.add("btn--running");
  } else {
    els.start.disabled = false;
    els.start.textContent = "Start auto-typing";
    els.start.classList.remove("btn--running");
  }
}

function renderLiveSpeed(ms, state) {
  if (state === "running" && ms) {
    els.speedReadout.textContent = `live · ${ms} ms · ~${intervalToWpm(ms)} WPM`;
  } else {
    els.speedReadout.textContent = `${settings.intervalMs} ms · ~${intervalToWpm(
      settings.intervalMs
    )} WPM`;
  }
}

const MODE_COLOR = {
  slow: "#5b6a90",
  human: "#3d7bff",
  fast: "#ffab3d",
  max: "#ff4d5e",
  custom: "#3d7bff",
};

function renderStats(sessions) {
  const hasData = sessions.length > 0;
  els.statsEmpty.hidden = hasData;
  els.history.hidden = !hasData;
  els.clearStats.hidden = !hasData;

  if (!hasData) {
    els.statWpm.textContent = "—";
    els.statAcc.textContent = "—";
    els.statWords.textContent = "—";
    return;
  }

  const last = sessions[sessions.length - 1];
  els.statWpm.textContent = last.wpm;
  els.statAcc.textContent = `${last.accuracy}%`;
  els.statWords.textContent = last.words;

  const agg = summarize(sessions);
  els.bestWpm.textContent = agg.best;
  els.avgWpm.textContent = agg.avgWpm;
  els.avgAcc.textContent = agg.avgAccuracy;

  const recent = sessions.slice(-12);
  const max = Math.max(...recent.map((s) => s.wpm), 1);
  els.historyChart.innerHTML = "";
  for (const s of recent) {
    const bar = document.createElement("div");
    bar.className = "history__bar";
    bar.style.height = `${Math.max(8, Math.round((s.wpm / max) * 100))}%`;
    bar.style.background = MODE_COLOR[s.mode] || MODE_COLOR.custom;
    bar.title = `${s.wpm} WPM · ${s.accuracy}% · ${s.words} words · ${
      SPEED_MODES[s.mode]?.label || "Custom"
    }`;
    els.historyChart.appendChild(bar);
  }
}

// ---- settings mutations --------------------------------------------------

async function update(patch) {
  settings = await saveSettings(patch);
}

els.modes.addEventListener("click", async (e) => {
  const btn = e.target.closest(".mode");
  if (!btn) return;
  const mode = btn.dataset.mode;
  const preset = SPEED_MODES[mode];
  if (!preset) return;
  await update({
    speedMode: mode,
    intervalMs: preset.intervalMs,
    randomJitter: preset.randomJitter,
  });
  renderSpeed();
  renderVariance();
});

els.throttle.addEventListener("input", () => {
  const ms = throttleToInterval(Number(els.throttle.value), settings);
  settings.intervalMs = ms;
  settings.speedMode = "custom";
  const wpm = intervalToWpm(ms);
  els.speedReadout.textContent = `${ms} ms · ~${wpm} WPM`;
  const frac = Number(els.throttle.value) / THROTTLE_MAX;
  document.body.classList.toggle("redline", frac >= REDLINE_AT);
  for (const btn of els.modes.querySelectorAll(".mode")) {
    btn.setAttribute("aria-pressed", "false");
  }
});

// Persist once the drag settles (input fires continuously).
els.throttle.addEventListener("change", () => {
  update({ intervalMs: settings.intervalMs, speedMode: "custom" });
});

els.randomize.addEventListener("change", async () => {
  await update({ randomize: els.randomize.checked });
  renderVariance();
});

els.jitter.addEventListener("input", () => {
  settings.randomJitter = Number(els.jitter.value);
  els.jitterReadout.textContent = `± ${settings.randomJitter} ms`;
});
els.jitter.addEventListener("change", () => {
  update({ randomJitter: settings.randomJitter });
});

els.accuracy.addEventListener("input", () => {
  settings.accuracy = Number(els.accuracy.value);
  renderAccuracy();
});
els.accuracy.addEventListener("change", () => {
  update({ accuracy: settings.accuracy });
});

// ---- actions -------------------------------------------------------------

els.start.addEventListener("click", () => {
  if (!onSupportedSite || activeTabId == null) return;
  chrome.tabs.sendMessage(activeTabId, { action: "startHack" });
});

els.restart.addEventListener("click", () => {
  chrome.storage.local.set({ raceState: "idle", liveSpeed: null });
  if (activeTabId != null) chrome.tabs.reload(activeTabId);
});

els.clearStats.addEventListener("click", async () => {
  await clearSessions();
  renderStats([]);
});

// ---- live sync -----------------------------------------------------------

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.raceState) {
    renderState(changes.raceState.newValue);
  }
  if (changes.liveSpeed || changes.raceState) {
    chrome.storage.local.get(["liveSpeed", "raceState"], (d) =>
      renderLiveSpeed(d.liveSpeed, d.raceState)
    );
  }
  if (changes.sessions) {
    renderStats(
      Array.isArray(changes.sessions.newValue) ? changes.sessions.newValue : []
    );
  }
});

// ---- init ----------------------------------------------------------------

async function init() {
  els.copyright.textContent = `© ${new Date().getFullYear()} Olivier Lüthy`;

  settings = await getSettings();
  // Persist defaults so the content script has a full settings object.
  await saveSettings({});

  renderSpeed();
  renderVariance();
  renderAccuracy();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab ? tab.id : null;
  onSupportedSite = Boolean(tab && tab.url && tab.url.startsWith("https://10ff.net"));
  els.siteHint.hidden = onSupportedSite;

  chrome.storage.local.get(["raceState", "liveSpeed", "sessions"], (d) => {
    renderState(d.raceState);
    renderLiveSpeed(d.liveSpeed, d.raceState);
    renderStats(Array.isArray(d.sessions) ? d.sessions : []);
  });
}

init();
