const state = {
  leads: [],
  shortlist: [],
  filter: "all",
};

const els = {
  collectForm: document.querySelector("#collect-form"),
  shortlistForm: document.querySelector("#shortlist-form"),
  query: document.querySelector("#query"),
  limit: document.querySelector("#limit"),
  minScore: document.querySelector("#min-score"),
  selectMinScore: document.querySelector("#select-min-score"),
  indexes: document.querySelector("#indexes"),
  tags: document.querySelector("#tags"),
  includeErrors: document.querySelector("#include-errors"),
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
          <p>${escapeHtml(source.kind)} · ${enabled} · priority ${source.priority}</p>
        </div>
      `;
    })
    .join("");
}

function renderLeads() {
  const leads = state.leads.filter((lead) => state.filter === "all" || lead.status === state.filter);
  els.leadCount.textContent = `${state.leads.length} leads · ${leads.length} shown`;
  els.leads.innerHTML = leads.map(renderLeadCard).join("");
}

function renderLeadCard(lead) {
  const index = state.leads.indexOf(lead) + 1;
  const tags = lead.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  const badgeClass = lead.status === "error" ? "badge error" : "badge";
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
      <div class="tag-row">${tags}</div>
      ${media ? `<div class="media-strip">${media}</div>` : ""}
      <div class="card-actions">
        <button class="secondary" type="button" data-add="${index}">Shortlist</button>
        <a class="secondary" href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer">Open</a>
      </div>
    </article>
  `;
}

function renderShortlist() {
  els.shortlistCount.textContent = `${state.shortlist.length} saved`;
  els.shortlist.innerHTML = state.shortlist
    .map(
      (lead) => `
        <article class="shortlist-card">
          <a href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer">${escapeHtml(lead.title)}</a>
          <p>${escapeHtml(lead.source)} · score ${lead.score}</p>
          <button class="secondary" type="button" data-remove="${escapeHtml(lead.url)}">Remove</button>
        </article>
      `
    )
    .join("");
}

async function collect(event) {
  event.preventDefault();
  setStatus("Collecting leads...");
  els.collectForm.querySelector("button").disabled = true;
  try {
    const payload = await requestJson("/api/collect", {
      method: "POST",
      body: JSON.stringify({
        query: els.query.value,
        limit: els.limit.value,
        min_score: els.minScore.value,
      }),
    });
    state.leads = payload.leads;
    state.shortlist = payload.shortlist;
    renderLeads();
    renderShortlist();
    setStatus("Collection complete.");
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

async function init() {
  const config = await requestJson("/api/config");
  els.query.value = config.default_query || els.query.value;
  renderSources(config.sources);
  const current = await requestJson("/api/state");
  state.leads = current.leads;
  state.shortlist = current.shortlist;
  renderLeads();
  renderShortlist();
}

els.collectForm.addEventListener("submit", collect);
els.shortlistForm.addEventListener("submit", buildShortlist);
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
