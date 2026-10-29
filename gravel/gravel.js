/* ============================================================
   GRAVEL — tiny JS helpers (no dependencies)
   The patterns every Gravel data site repeats:
   load a canonical data file -> render from it -> filter it.
   Source patterns: Cuhlur app.js, kscmn.com sets/releases pages.
   ============================================================ */

/* Load JSON (or a .js data file that sets a global) and hand it back. */
async function gravelLoad(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("gravel: failed to load " + url + " (" + res.status + ")");
  return res.json();
}

/* Escape a value for safe insertion into HTML. */
function gravelEsc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Render an array of items into a container using a row template fn. */
function gravelRender(container, items, rowFn, emptyText) {
  if (!items.length) {
    container.innerHTML = '<p class="empty">' + gravelEsc(emptyText || "Nothing here yet.") + "</p>";
    return;
  }
  container.innerHTML = items.map(rowFn).join("");
}

/* Case-insensitive substring filter across the given fields. */
function gravelFilter(items, query, fields) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter(it => fields.some(f => String(it[f] || "").toLowerCase().includes(q)));
}

/* Only allow http(s) links through (znet /rss security fix, 2026-10). */
function gravelSafeUrl(u) {
  try {
    const url = new URL(String(u), location.href);
    return (url.protocol === "http:" || url.protocol === "https:") ? url.href : "#";
  } catch (e) { return "#"; }
}
