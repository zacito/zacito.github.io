/* ============================================================
   GRAVEL APP — basic phone functionality (no dependencies).
   The features Zac's apps/pages keep needing:
   local store, toast, share, haptics, dark-theme toggle,
   bottom sheet, view tabs, Add-to-Home-Screen install.
   Load after gravel.js.
   ============================================================ */

/* --- local store: JSON in localStorage, namespaced --- */
const GravelStore = {
  _key: "gravel:" + (document.title || "app"),
  get(fallback) {
    try {
      const v = localStorage.getItem(this._key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  },
  set(value) {
    try { localStorage.setItem(this._key, JSON.stringify(value)); } catch (e) {}
  },
  ns(name) { const s = Object.create(this); s._key = "gravel:" + name; return s; }
};

/* --- toast --- */
let _toastTimer = null;
function gravelToast(msg, ms) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), ms || 2200);
}

/* --- share: native share sheet, clipboard fallback --- */
async function gravelShare(data) {
  if (navigator.share) {
    try { await navigator.share(data); return true; } catch (e) { return false; }
  }
  const text = [data.title, data.text, data.url].filter(Boolean).join(" ");
  if (text && navigator.clipboard) {
    try { await navigator.clipboard.writeText(text); gravelToast("Copied to clipboard"); return true; }
    catch (e) {}
  }
  return false;
}

/* --- haptics (Android Chrome; iOS Safari ignores) --- */
function gravelHaptic(ms) { if (navigator.vibrate) navigator.vibrate(ms || 10); }

/* --- dark theme toggle: [data-theme="dark"] on <html>, persisted --- */
function gravelThemeToggle() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = dark ? "" : "dark";
  if (next) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  GravelStore.ns("gravel").set({ theme: next });
  return next;
}
(function gravelThemeInit() {
  const saved = GravelStore.ns("gravel").get({});
  if (saved && saved.theme) document.documentElement.setAttribute("data-theme", saved.theme);
})();

/* --- bottom sheet: open/close by id (with backdrop) --- */
function gravelSheet(id, open) {
  const sheet = document.getElementById(id);
  if (!sheet) return;
  let bd = document.querySelector(".sheet-backdrop");
  if (!bd) {
    bd = document.createElement("div");
    bd.className = "sheet-backdrop";
    bd.addEventListener("click", () => document.querySelectorAll(".sheet.open").forEach(s => gravelSheet(s.id, false)));
    document.body.appendChild(bd);
  }
  sheet.classList.toggle("open", !!open);
  bd.classList.toggle("open", !!open);
  if (open) gravelHaptic(8);
}

/* --- views / bottom-nav tabs --- */
function gravelShowView(id, el) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === id));
  if (el) {
    const nav = el.closest(".bottom-nav");
    if (nav) nav.querySelectorAll("a, button").forEach(b => b.classList.toggle("active", b === el));
  }
  window.scrollTo(0, 0);
}

/* --- Add to Home Screen: capture the install prompt --- */
let _installEvent = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  _installEvent = e;
  document.querySelectorAll(".install-banner, .install-btn").forEach(el => el.classList.add("show"));
});
async function gravelInstall() {
  if (!_installEvent) { gravelToast("Use your browser menu: Add to Home Screen"); return false; }
  _installEvent.prompt();
  const choice = await _installEvent.userChoice;
  _installEvent = null;
  document.querySelectorAll(".install-banner").forEach(el => el.classList.remove("show"));
  return choice.outcome === "accepted";
}

/* --- photo input helper: <input type=file accept=image/* capture> --- */
function gravelPhotoInput(onFile) {
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*"; input.capture = "environment";
  input.addEventListener("change", () => { if (input.files[0]) onFile(input.files[0]); });
  input.click();
}
