const state = {
  leads: [],
  shortlist: [],
};

const els = {
  collectForm: document.querySelector("#collect-form"),
  limit: document.querySelector("#limit"),
  minScore: document.querySelector("#min-score"),
  clearShortlist: document.querySelector("#clear-shortlist"),
  leads: document.querySelector("#leads"),
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
  els.status.textContent = message || "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderLeads() {
  const visibleLeads = state.leads
    .map((lead, index) => ({ lead, index }))
    .filter((item) => item.lead.media_urls.length);
  els.leadCount.textContent = visibleLeads.length ? `${visibleLeads.length} photos` : "No photos yet";
  els.shortlistCount.textContent = `${state.shortlist.length} selected`;
  document.querySelectorAll(".selection-action").forEach((element) => {
    element.hidden = state.shortlist.length === 0;
  });
  els.leads.innerHTML = visibleLeads.map(({ lead, index }) => renderLeadCard(lead, index + 1)).join("");
}

function renderLeadCard(lead, index) {
  const selected = isSelected(lead);
  const media = lead.media_urls
    .filter(isImageUrl)
    .slice(0, 5)
    .map((url) => `<img src="${escapeHtml(url)}" alt="">`)
    .join("");
  return `
    <article class="lead-card ${escapeHtml(lead.status)} ${selected ? "selected" : ""}">
      <input class="pick" type="checkbox" data-toggle="${index}" ${selected ? "checked" : ""} aria-label="${escapeHtml(lead.title)}">
      <a class="content-tile" href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(lead.title)}">
        <div class="media-strip">${media}</div>
      </a>
    </article>
  `;
}

function isImageUrl(value) {
  try {
    return /\.(jpe?g|png|gif|webp)$/i.test(new URL(value).pathname);
  } catch {
    return /\.(jpe?g|png|gif|webp)(?:\?|$)/i.test(value);
  }
}

function isSelected(lead) {
  return state.shortlist.some((item) => item.url === lead.url);
}

async function collect(event) {
  event.preventDefault();
  setStatus("Collecting...");
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
    setStatus("");
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
}

async function removeLead(url) {
  const payload = await requestJson("/api/shortlist/remove", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  state.shortlist = payload.shortlist;
  renderLeads();
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
}

async function init() {
  const current = await requestJson("/api/state");
  state.leads = current.leads;
  state.shortlist = current.shortlist;
  renderLeads();
}

els.collectForm.addEventListener("submit", collect);
els.clearShortlist.addEventListener("click", clearShortlist);
els.leads.addEventListener("click", (event) => {
  const index = event.target.dataset.toggle;
  if (index) {
    toggleLead(Number(index));
  }
});
init().catch((error) => setStatus(error.message));
