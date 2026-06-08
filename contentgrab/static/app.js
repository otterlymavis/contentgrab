const state = {
  leads: [],
  shortlist: [],
  filter: "all",
};

const els = {
  collectForm: document.querySelector("#collect-form"),
  limit: document.querySelector("#limit"),
  minScore: document.querySelector("#min-score"),
  clearShortlist: document.querySelector("#clear-shortlist"),
  leads: document.querySelector("#leads"),
  shortlist: document.querySelector("#shortlist"),
  leadCount: document.querySelector("#lead-count"),
  shortlistCount: document.querySelector("#shortlist-count"),
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
  if (!els.sources) {
    return;
  }
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
  const leads = state.leads.filter((lead) => state.filter === "all" || lead.status === state.filter);
  els.leadCount.textContent = `${state.leads.length} media leads - ${leads.length} shown - ${state.shortlist.length} selected`;
  els.leads.innerHTML = leads.map(renderLeadCard).join("");
}

function renderLeadCard(lead) {
  const index = state.leads.indexOf(lead) + 1;
  const tags = lead.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  const badgeClass = lead.status === "error" ? "badge error" : "badge";
  const selected = isSelected(lead);
  const actionText =
    lead.status === "hit-search" ? "Open X posts" : lead.status === "media-search" ? "Open media search" : "Open";
  const preview = renderPreview(lead);
  const media = lead.media_urls
    .filter((url) => /\.(jpe?g|png|gif|webp)$/i.test(url))
    .slice(0, 5)
    .map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(url)}" alt=""></a>`)
    .join("");
  return `
    <article class="lead-card ${escapeHtml(lead.status)} ${selected ? "selected" : ""}">
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
        <button class="${selected ? "primary" : "secondary"}" type="button" data-toggle="${index}">
          ${selected ? "Selected" : "Select"}
        </button>
        <a class="secondary" href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer">${actionText}</a>
      </div>
    </article>
  `;
}

function hasPreview(lead) {
  return Boolean(lead.preview_title || lead.preview_description || lead.media_urls.length || lead.status === "media-search");
}

function isSelected(lead) {
  return state.shortlist.some((item) => item.url === lead.url);
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
  els.shortlistCount.textContent = `${state.shortlist.length} selected`;
  els.shortlist.innerHTML = state.shortlist
    .map(
      (lead) => `
        <article class="shortlist-card">
          <a href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer">${escapeHtml(lead.title)}</a>
          <p>${escapeHtml(lead.source)} - score ${lead.score}</p>
          <div class="shortlist-card-actions">
            <a class="secondary" href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer">Open</a>
            <button class="secondary" type="button" data-remove="${escapeHtml(lead.url)}">Remove</button>
          </div>
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
    renderLeads();
    renderShortlist();
    setStatus("Entertainment hit post collection complete.");
  } catch (error) {
    setStatus(error.message);
  } finally {
    els.collectForm.querySelector("button").disabled = false;
  }
}

async function addLead(index) {
  const payload = await requestJson("/api/shortlist/add", {
    method: "POST",
    body: JSON.stringify({ index }),
  });
  state.shortlist = payload.shortlist;
  renderLeads();
  renderShortlist();
}

async function removeLead(url) {
  const payload = await requestJson("/api/shortlist/remove", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  state.shortlist = payload.shortlist;
  renderLeads();
  renderShortlist();
}

async function toggleLead(index) {
  const lead = state.leads[index - 1];
  if (!lead) {
    return;
  }
  if (isSelected(lead)) {
    await removeLead(lead.url);
  } else {
    await addLead(index);
  }
}

async function clearShortlist() {
  const payload = await requestJson("/api/shortlist/clear", {
    method: "POST",
    body: JSON.stringify({}),
  });
  state.shortlist = payload.shortlist;
  renderLeads();
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
els.clearShortlist.addEventListener("click", clearShortlist);
els.leads.addEventListener("click", (event) => {
  const index = event.target.dataset.toggle;
  if (index) {
    toggleLead(Number(index));
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
