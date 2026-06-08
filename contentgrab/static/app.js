const state = {
  leads: [],
  shortlist: [],
  filter: "all",
  sourceFilter: "all",
  previewOnly: false,
};

const els = {
  collectForm: document.querySelector("#collect-form"),
  shortlistForm: document.querySelector("#shortlist-form"),
  limit: document.querySelector("#limit"),
  minScore: document.querySelector("#min-score"),
  selectMinScore: document.querySelector("#select-min-score"),
  indexes: document.querySelector("#indexes"),
  tags: document.querySelector("#tags"),
  includeErrors: document.querySelector("#include-errors"),
  sourceFilter: document.querySelector("#source-filter"),
  previewOnly: document.querySelector("#preview-only"),
  clearShortlist: document.querySelector("#clear-shortlist"),
  leads: document.querySelector("#leads"),
  shortlist: document.querySelector("#shortlist"),
  leadCount: document.querySelector("#lead-count"),
  shortlistCount: document.querySelector("#shortlist-count"),
  sources: document.querySelector("#sources"),
  status: document.querySelector("#status"),
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

function setStatus(message) {
  els.status.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderSources(sources) {
  els.sources.innerHTML = sources
    .map((source) => {
      const enabled = source.enabled ? "enabled" : "paused";
      return `
        <div class="source-item">
          <strong>${escapeHtml(source.name)}</strong>
          <p>${escapeHtml(source.kind)} - ${enabled} - priority ${source.priority}</p>
        </div>
      `;
    })
    .join("");
}

function renderLeads() {
  const leads = state.leads.filter((lead) => {
    const statusMatch = state.filter === "all" || lead.status === state.filter;
    const sourceMatch = state.sourceFilter === "all" || lead.source === state.sourceFilter;
    const previewMatch = !state.previewOnly || hasPreview(lead);
    return statusMatch && sourceMatch && previewMatch;
  });
  els.leadCount.textContent = `${state.leads.length} media leads - ${leads.length} shown`;
  els.leads.innerHTML = leads.map(renderLeadCard).join("");
  renderSourceFilter();
}

function renderLeadCard(lead) {
  const index = state.leads.indexOf(lead) + 1;
  const tags = lead.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  const badgeClass = lead.status === "error" ? "badge error" : "badge";
  const actionText =
    lead.status === "hit-search" ? "Open X posts" : lead.status === "media-search" ? "Open media search" : "Open";
  const preview = renderPreview(lead);
  const media = lead.media_urls
    .filter((url) => /\.(jpe?g|png|gif|webp)$/i.test(url))
    .slice(0, 5)
    .map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(url)}" alt=""></a>`)
    .join("");
  return `
    <article class="lead-card ${escapeHtml(lead.status)}">
      <div class="lead-meta">
        <span class="${badgeClass}">#${index}</span>
        <span class="badge">score ${lead.score}</span>
        <span class="${badgeClass}">${escapeHtml(lead.status)}</span>
        <span class="tag">${escapeHtml(lead.source)}</span>
      </div>
      <a class="lead-title" href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer">${escapeHtml(lead.title)}</a>
      ${lead.summary ? `<p class="note">${escapeHtml(lead.summary)}</p>` : ""}
      ${preview}
      <div class="tag-row">${tags}</div>
      ${media ? `<div class="media-strip">${media}</div>` : ""}
      <div class="card-actions">
        <button class="secondary" type="button" data-add="${index}">Shortlist</button>
        <a class="secondary" href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer">${actionText}</a>
      </div>
    </article>
  `;
}

function hasPreview(lead) {
  return Boolean(lead.preview_title || lead.preview_description || lead.media_urls.length || lead.status === "media-search");
}

function renderSourceFilter() {
  const sources = [...new Set(state.leads.map((lead) => lead.source))].sort();
  const current = sources.includes(state.sourceFilter) ? state.sourceFilter : "all";
  state.sourceFilter = current;
  els.sourceFilter.innerHTML = [
    '<option value="all">All sources</option>',
    ...sources.map((source) => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`),
  ].join("");
  els.sourceFilter.value = current;
}

function renderPreview(lead) {
  if (!lead.preview_title && !lead.preview_description && lead.status !== "media-search") {
    return "";
  }
  const eyebrow =
    lead.status === "media-search" ? "Trend media search" : lead.media_urls.length ? "Preview available" : "Source preview";
  const label = lead.status === "hit-search" ? "X hit post search" : eyebrow;
  return `
    <div class="preview-box">
      <span>${label}</span>
      ${lead.preview_title ? `<strong>${escapeHtml(lead.preview_title)}</strong>` : ""}
      ${lead.preview_description ? `<p>${escapeHtml(lead.preview_description)}</p>` : ""}
    </div>
  `;
}

function renderShortlist() {
  els.shortlistCount.textContent = `${state.shortlist.length} saved`;
  els.shortlist.innerHTML = state.shortlist
    .map(
      (lead) => `
        <article class="shortlist-card">
          <a href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer">${escapeHtml(lead.title)}</a>
          <p>${escapeHtml(lead.source)} - score ${lead.score}</p>
          <button class="secondary" type="button" data-remove="${escapeHtml(lead.url)}">Remove</button>
        </article>
      `
    )
    .join("");
}

async function collect(event) {
  event.preventDefault();
  setStatus("Collecting Japanese entertainment hit posts...");
  els.collectForm.querySelector("button").disabled = true;
  try {
    const payload = await requestJson("/api/collect", {
      method: "POST",
      body: JSON.stringify({
        limit: els.limit.value,
        min_score: els.minScore.value,
      }),
    });
    state.leads = payload.leads;
    state.shortlist = payload.shortlist;
    state.sourceFilter = "all";
    renderLeads();
    renderShortlist();
    setStatus("Entertainment hit post collection complete.");
  } catch (error) {
    setStatus(error.message);
  } finally {
    els.collectForm.querySelector("button").disabled = false;
  }
}

async function buildShortlist(event) {
  event.preventDefault();
  const tags = els.tags.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const payload = await requestJson("/api/shortlist", {
    method: "POST",
    body: JSON.stringify({
      indexes: els.indexes.value,
      tags,
      min_score: els.selectMinScore.value,
      include_errors: els.includeErrors.checked,
    }),
  });
  state.shortlist = payload.shortlist;
  renderShortlist();
}

async function addLead(index) {
  const payload = await requestJson("/api/shortlist/add", {
    method: "POST",
    body: JSON.stringify({ index }),
  });
  state.shortlist = payload.shortlist;
  renderShortlist();
}

async function removeLead(url) {
  const payload = await requestJson("/api/shortlist/remove", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  state.shortlist = payload.shortlist;
  renderShortlist();
}

async function clearShortlist() {
  const payload = await requestJson("/api/shortlist/clear", {
    method: "POST",
    body: JSON.stringify({}),
  });
  state.shortlist = payload.shortlist;
  renderShortlist();
}

async function init() {
  const config = await requestJson("/api/config");
  renderSources(config.sources);
  const current = await requestJson("/api/state");
  state.leads = current.leads;
  state.shortlist = current.shortlist;
  renderLeads();
  renderShortlist();
}

els.collectForm.addEventListener("submit", collect);
els.shortlistForm.addEventListener("submit", buildShortlist);
els.sourceFilter.addEventListener("change", () => {
  state.sourceFilter = els.sourceFilter.value;
  renderLeads();
});
els.previewOnly.addEventListener("change", () => {
  state.previewOnly = els.previewOnly.checked;
  renderLeads();
});
els.clearShortlist.addEventListener("click", clearShortlist);
els.leads.addEventListener("click", (event) => {
  const index = event.target.dataset.add;
  if (index) {
    addLead(Number(index));
  }
});
els.shortlist.addEventListener("click", (event) => {
  const url = event.target.dataset.remove;
  if (url) {
    removeLead(url);
  }
});
document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    state.filter = button.dataset.filter;
    renderLeads();
  });
});

init().catch((error) => setStatus(error.message));
