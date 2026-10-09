// Zacito blog: list view, post view, and #/admin CMS.
// Posts come from the Worker's /api/posts (KV-backed). Reads are public;
// publishing and deleting need the admin password as a Bearer token.
(() => {
  const app = document.querySelector("#blog-app");
  const TOKEN_KEY = "zacito_admin_token";
  let posts = [];
  let bySlug = new Map();
  let blogAvailable = false;

  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const formatDate = iso => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  async function refreshPosts() {
    try {
      const res = await fetch("/api/posts", { headers: { accept: "application/json" } });
      if (!res.ok) return false;
      const data = await res.json();
      if (!Array.isArray(data)) return false;
      posts = data.sort((a, b) => b.date.localeCompare(a.date));
      bySlug = new Map(posts.map(post => [post.slug, post]));
      return true;
    } catch (err) {
      return false; // e.g. page viewed outside the Worker
    }
  }

  function renderList() {
    document.title = "Blog · Zacito";
    if (!blogAvailable) {
      app.innerHTML = `
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">← Home</a></nav>
        <h1>Blog</h1>
        <p class="empty">Blog unavailable — couldn't reach the server.</p>`;
      return;
    }
    app.innerHTML = `
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">← Home</a></nav>
      <h1>Blog</h1>
      ${posts.length ? `<div class="blog-list">${posts.map(post => `
        <a class="blog-item" href="#/post/${encodeURIComponent(post.slug)}">
          <h2>${escapeHtml(post.title)}</h2>
          <span class="blog-date">${escapeHtml(formatDate(post.date))}</span>
          ${post.excerpt ? `<p class="excerpt">${escapeHtml(post.excerpt)}</p>` : ""}
        </a>`).join("")}</div>` : `<p class="empty">No posts yet.</p>`}`;
  }

  function renderPost(slug) {
    const post = bySlug.get(slug);
    if (!post) {
      document.title = "Not found · Zacito";
      app.innerHTML = `
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">← Home</a> / <a href="#/">Blog</a></nav>
        <h1>Post not found</h1>
        <p class="empty">This post may have been removed.</p>`;
      return;
    }
    document.title = `${post.title} · Zacito`;
    app.innerHTML = `
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">← Home</a> / <a href="#/">Blog</a> / ${escapeHtml(post.title)}</nav>
      <article>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="post-date">${escapeHtml(formatDate(post.date))}</p>
        <div class="post-body">${(post.body || []).map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div>
      </article>`;
  }

  function renderAdmin() {
    document.title = "Admin · Zacito";
    const today = new Date().toISOString().slice(0, 10);
    const savedToken = sessionStorage.getItem(TOKEN_KEY) || "";
    app.innerHTML = `
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">← Home</a> / <a href="#/">Blog</a> / Admin</nav>
      <h1>Blog admin</h1>
      <p class="empty">Posts publish instantly — no file upload needed.</p>
      <form class="admin-form" id="postForm">
        <label>Admin password<input id="adminToken" type="password" value="${escapeHtml(savedToken)}" autocomplete="current-password" placeholder="Asked once, remembered in this browser"></label>
        <label>Title<input id="postTitle" required maxlength="120" autocomplete="off"></label>
        <label>Date<input id="postDate" type="date" value="${today}" required></label>
        <label>Excerpt<textarea id="postExcerpt" rows="2" maxlength="300"></textarea></label>
        <label>Body <span class="hint">(one paragraph per line)</span><textarea id="postBody" rows="8" required></textarea></label>
        <button type="submit">Publish post</button>
        <p class="form-status" id="formStatus" role="status"></p>
      </form>
      <h2 class="admin-subhead">Posts (<span id="postCount">${posts.length}</span>)</h2>
      <div id="adminList" class="blog-list"></div>`;
    const listEl = document.querySelector("#adminList");
    const setStatus = msg => { document.querySelector("#formStatus").textContent = msg; };
    const getToken = () => {
      const token = document.querySelector("#adminToken").value.trim();
      sessionStorage.setItem(TOKEN_KEY, token);
      return token;
    };
    const renderList = () => {
      document.querySelector("#postCount").textContent = posts.length;
      listEl.innerHTML = posts.length ? posts.map(post => `
        <div class="blog-item admin-item">
          <div>
            <h2>${escapeHtml(post.title)}</h2>
            <span class="blog-date">${escapeHtml(formatDate(post.date))} · ${escapeHtml(post.slug)}</span>
          </div>
          <button type="button" data-delete="${escapeHtml(post.slug)}">Delete</button>
        </div>`).join("") : `<p class="empty">No posts yet.</p>`;
    };
    renderList();
    listEl.addEventListener("click", async event => {
      const slug = event.target.dataset ? event.target.dataset.delete : null;
      if (!slug) return;
      const post = bySlug.get(slug);
      if (!post || !confirm(`Delete "${post.title}"?`)) return;
      let res;
      try {
        res = await fetch(`/api/posts/${encodeURIComponent(slug)}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${getToken()}` }
        });
      } catch (err) {
        alert("Couldn't reach the server.");
        return;
      }
      if (res.status === 401) { alert("Wrong admin password."); return; }
      if (!res.ok) { alert("Couldn't delete that post."); return; }
      posts = posts.filter(p => p.slug !== slug);
      bySlug.delete(slug);
      renderList();
    });
    document.querySelector("#postForm").addEventListener("submit", async event => {
      event.preventDefault();
      const title = document.querySelector("#postTitle").value.trim();
      const body = document.querySelector("#postBody").value.split(/\n+/).map(s => s.trim()).filter(Boolean);
      if (!title || !body.length) return;
      setStatus("Publishing…");
      let res;
      try {
        res = await fetch("/api/posts", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({
            title,
            date: document.querySelector("#postDate").value,
            excerpt: document.querySelector("#postExcerpt").value.trim(),
            body
          })
        });
      } catch (err) {
        setStatus("Couldn't reach the server.");
        return;
      }
      if (res.status === 401) { setStatus("Wrong admin password."); return; }
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json()).error || ""; } catch (err) {}
        setStatus(`Couldn't publish. ${detail}`);
        return;
      }
      const post = await res.json();
      posts.push(post);
      posts.sort((a, b) => b.date.localeCompare(a.date));
      bySlug.set(post.slug, post);
      event.target.reset();
      document.querySelector("#adminToken").value = sessionStorage.getItem(TOKEN_KEY) || "";
      document.querySelector("#postDate").value = today;
      renderList();
      setStatus("Published.");
    });
  }

  function route() {
    const postMatch = location.hash.match(/^#\/post\/(.+)$/);
    if (postMatch) renderPost(decodeURIComponent(postMatch[1]));
    else if (location.hash === "#/admin") renderAdmin();
    else renderList();
    app.focus({ preventScroll: true });
  }

  window.addEventListener("hashchange", route);
  refreshPosts().then(available => {
    blogAvailable = available;
    route();
  });
})();
