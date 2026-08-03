const STORAGE_KEY = "oneThingApp_v1";
const timers = [];

const defaultState = {
  settings: {
    appName: "One Thing",
    commitment: "Go live on Whatnot",
    showTime: "19:00",
    reminderMode: "relentless",
    voice: "direct",
    debtGoal: 200000,
    debtPaid: 0
  },
  entries: []
};

let state = loadState();

const $ = (id) => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0, 10);
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  scheduleTodayNotifications();
}

function getTodayEntry() {
  return state.entries.find((entry) => entry.date === todayKey());
}

function render() {
  const s = state.settings;
  $("appTitle").textContent = s.appName;
  document.title = s.appName;
  $("commitmentDisplay").textContent = s.commitment;
  $("showTimeDisplay").textContent = formatTime(s.showTime);

  $("appNameInput").value = s.appName;
  $("commitmentInput").value = s.commitment;
  $("showTimeInput").value = s.showTime;
  $("reminderModeInput").value = s.reminderMode;
  $("voiceInput").value = s.voice;
  $("debtGoalInput").value = s.debtGoal;
  $("debtPaidInput").value = s.debtPaid;

  const completed = state.entries.filter((e) => e.status === "completed");
  const totalProfit = completed.reduce((sum, e) => sum + Number(e.profit || 0), 0);
  const debtRemaining = Math.max(0, Number(s.debtGoal) - Number(s.debtPaid) - totalProfit);

  $("profitValue").textContent = money(totalProfit);
  $("debtRemainingValue").textContent = money(debtRemaining);
  $("showsValue").textContent = completed.length;
  $("streakValue").textContent = `${calculateStreak()} days`;

  const today = getTodayEntry();
  const status = $("todayStatus");
  status.className = "status-pill";
  if (!today) {
    status.textContent = "Waiting";
  } else if (today.status === "completed") {
    status.textContent = "Promise kept";
    status.classList.add("complete");
  } else {
    status.textContent = "Skipped";
    status.classList.add("skipped");
  }

  renderHistory();
  updateCountdown();
  updateNotificationStatus();
}

function renderHistory() {
  const list = $("historyList");
  const entries = [...state.entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  if (!entries.length) {
    list.innerHTML = '<p class="empty-state">No entries yet. Today can be the first green square.</p>';
    return;
  }
  list.innerHTML = entries.map((entry) => `
    <article class="history-entry">
      <div>
        <strong>${entry.status === "completed" ? "✓ Promise kept" : "✕ Skipped"}</strong>
        <small>${formatDate(entry.date)}${entry.reason ? ` · ${escapeHtml(entry.reason)}` : ""}</small>
      </div>
      <div class="history-amount">${entry.status === "completed" ? money(entry.profit) : "—"}</div>
    </article>
  `).join("");
}

function calculateStreak() {
  const statuses = new Map(state.entries.map((e) => [e.date, e.status]));
  let streak = 0;
  const cursor = new Date();
  if (!statuses.has(todayKey())) cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < 3650; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (statuses.get(key) === "completed") {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function recordCompletion(source = "completed") {
  const current = getTodayEntry();
  const entry = current || { date: todayKey() };
  entry.status = "completed";
  entry.source = source;
  entry.completedAt = new Date().toISOString();
  entry.reason = "";
  if (!current) state.entries.push(entry);
  cancelTimers();
  saveState();
  toast(source === "live" ? "Notifications stopped. Go make money." : "Promise kept.");
}

function recordSkip(reason) {
  const current = getTodayEntry();
  const entry = current || { date: todayKey() };
  entry.status = "skipped";
  entry.reason = reason;
  entry.completedAt = new Date().toISOString();
  if (!current) state.entries.push(entry);
  cancelTimers();
  saveState();
  toast("Skip recorded. Tomorrow is still available.");
}

function saveResult(event) {
  event.preventDefault();
  let entry = getTodayEntry();
  if (!entry) {
    entry = { date: todayKey(), status: "completed", completedAt: new Date().toISOString() };
    state.entries.push(entry);
  }
  entry.status = "completed";
  entry.gross = Number($("grossInput").value || 0);
  entry.profit = Number($("profitInput").value || 0);
  entry.items = Number($("itemsInput").value || 0);
  entry.minutes = Number($("minutesInput").value || 0);
  entry.notes = $("notesInput").value.trim();
  event.target.reset();
  saveState();
  toast(`${money(entry.profit)} closer.`);
}

function reminderOffsets(mode) {
  if (mode === "gentle") return [-60, -10, 0, 20];
  if (mode === "normal") return [-120, -60, -30, -10, 0, 10, 20, 30];
  return [-180, -120, -60, -45, -30, -20, -10, -5, 0, 10, 20, 30, 40, 50, 60, 75, 90, 120];
}

function scheduleTodayNotifications() {
  cancelTimers();
  if (getTodayEntry()) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const target = targetDate();
  const now = Date.now();

  reminderOffsets(state.settings.reminderMode).forEach((offset) => {
    const fireAt = target.getTime() + offset * 60_000;
    const delay = fireAt - now;
    if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
      timers.push(setTimeout(() => sendReminder(offset), delay));
    }
  });
}

function cancelTimers() {
  while (timers.length) clearTimeout(timers.pop());
}

function sendReminder(offset) {
  if (getTodayEntry()) return;
  const message = notificationMessage(offset, state.settings.voice);
  const options = {
    body: message,
    icon: "icons/icon-192.svg",
    badge: "icons/icon-192.svg",
    tag: `one-thing-${todayKey()}-${offset}`,
    requireInteraction: offset >= 0
  };

  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then((registration) => registration.showNotification(state.settings.commitment, options));
  } else {
    new Notification(state.settings.commitment, options);
  }
}

function notificationMessage(offset, voice) {
  const before = offset < 0;
  const mins = Math.abs(offset);
  const timing = offset === 0 ? "It is time." : before ? `${humanMinutes(mins)} until show time.` : `${humanMinutes(mins)} past show time.`;

  const messages = {
    encouraging: [
      `${timing} A short show still counts.`,
      `${timing} You only need to begin.`,
      `${timing} Future You will be glad you showed up.`
    ],
    direct: [
      `${timing} Your one commitment is still waiting.`,
      `${timing} Start before your brain negotiates.`,
      `${timing} The goal moves when you do.`
    ],
    accountant: [
      `${timing} Skipping earns $0.`,
      `${timing} Revenue begins after you press Go Live.`,
      `${timing} Your debt did not take today off.`
    ],
    funny: [
      `${timing} Kindly place yourself in front of the camera.`,
      `${timing} The inventory cannot sell itself. Rude, honestly.`,
      `${timing} This is the notification you specifically asked to annoy you.`
    ]
  };
  const group = messages[voice] || messages.direct;
  return group[Math.floor(Math.random() * group.length)];
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    toast("This browser does not support notifications.");
    return;
  }
  const permission = await Notification.requestPermission();
  updateNotificationStatus();
  if (permission === "granted") {
    scheduleTodayNotifications();
    toast("Notifications enabled.");
  }
}

function testNotification() {
  if (Notification.permission !== "granted") {
    toast("Enable notifications first.");
    return;
  }
  sendReminder(-10);
}

function updateNotificationStatus() {
  const el = $("notificationStatus");
  if (!("Notification" in window)) el.textContent = "Notifications are not supported in this browser.";
  else if (Notification.permission === "granted") el.textContent = "Notifications are enabled on this device.";
  else if (Notification.permission === "denied") el.textContent = "Notifications are blocked in browser settings.";
  else el.textContent = "Permission has not been requested.";
}

function updateCountdown() {
  const target = targetDate();
  const diff = target.getTime() - Date.now();
  const today = getTodayEntry();
  if (today?.status === "completed") {
    $("countdownDisplay").textContent = "Done for today. The notifications have been silenced.";
    return;
  }
  if (today?.status === "skipped") {
    $("countdownDisplay").textContent = "Today was recorded as skipped.";
    return;
  }
  if (diff > 0) {
    $("countdownDisplay").textContent = `${humanDuration(diff)} until show time.`;
  } else {
    $("countdownDisplay").textContent = `${humanDuration(Math.abs(diff))} past show time. Still available.`;
  }
}

function targetDate() {
  const [h, m] = state.settings.showTime.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date;
}

function formatTime(value) {
  const [h, m] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function humanMinutes(mins) {
  if (mins < 60) return `${mins} minutes`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours}h ${rem}m` : `${hours} hour${hours === 1 ? "" : "s"}`;
}

function humanDuration(ms) {
  const totalMins = Math.max(0, Math.floor(ms / 60000));
  return humanMinutes(totalMins);
}

function formatDate(key) {
  return new Date(`${key}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

$("settingsButton").addEventListener("click", () => $("settingsDialog").showModal());
$("skipButton").addEventListener("click", () => $("skipDialog").showModal());
$("liveButton").addEventListener("click", () => recordCompletion("live"));
$("completeButton").addEventListener("click", () => recordCompletion("completed"));
$("resultForm").addEventListener("submit", saveResult);
$("enableNotificationsButton").addEventListener("click", enableNotifications);
$("testNotificationButton").addEventListener("click", testNotification);

$("settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.settings = {
    appName: $("appNameInput").value.trim() || "One Thing",
    commitment: $("commitmentInput").value.trim(),
    showTime: $("showTimeInput").value,
    reminderMode: $("reminderModeInput").value,
    voice: $("voiceInput").value,
    debtGoal: Number($("debtGoalInput").value || 0),
    debtPaid: Number($("debtPaidInput").value || 0)
  };
  saveState();
  $("settingsDialog").close();
  toast("Settings saved.");
});

$("skipForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  recordSkip(data.get("skipReason"));
  event.target.reset();
  $("skipDialog").close();
});

$("clearHistoryButton").addEventListener("click", () => {
  if (confirm("Clear all history? This cannot be undone.")) {
    state.entries = [];
    saveState();
    toast("History cleared.");
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}

setInterval(updateCountdown, 30_000);
render();
scheduleTodayNotifications();
