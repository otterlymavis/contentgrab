const state = {
  leads: [],
  searchButtons: [],
  shortlist: [],
};

const els = {
  collectForm: document.querySelector("#collect-form"),
  limit: document.querySelector("#limit"),
  minScore: document.querySelector("#min-score"),
  clearShortlist: document.querySelector("#clear-shortlist"),
  searches: document.querySelector("#searches"),
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
    .filter((item) => imageUrls(item.lead).length)
    .filter(uniqueImageItem());
  els.leadCount.textContent = visibleLeads.length ? `写真 ${visibleLeads.length}件` : "まだ写真はありません";
  els.shortlistCount.textContent = `選択 ${state.shortlist.length}件`;
  document.querySelectorAll(".selection-action").forEach((element) => {
    element.hidden = state.shortlist.length === 0;
  });
  renderSearchButtons();
  els.leads.innerHTML = visibleLeads.map(({ lead, index }) => renderLeadCard(lead, index + 1)).join("");
}

function renderSearchButtons() {
  const searchLeads = dedupeByUrl(state.searchButtons);
  els.searches.innerHTML = searchLeads
    .map(
      (lead) => `
        <a class="secondary search-button" href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer">
          ${escapeHtml(searchLabel(lead))}
        </a>
      `
    )
    .join("");
}

function dedupeByUrl(leads) {
  const seen = new Set();
  return leads.filter((lead) => {
    if (seen.has(lead.url)) {
      return false;
    }
    seen.add(lead.url);
    return true;
  });
}

function searchLabel(lead) {
  const labels = {
    "X Entertainment Hit Photos": "X エンタメ ヒット",
    "X Fresh Hit Photos": "X 新着ヒット",
    "X Film Drama Hit Photos": "X 映画・ドラマ",
    "X Celebrity Idol Hit Photos": "X 芸能人・アイドル",
    "Yahoo Realtime Entertainment Manual": "Yahooリアルタイム",
    "TikTok Japan Entertainment Manual": "TikTok 日本",
    "X Entertainment Sources Manual": "X エンタメ検索",
  };
  return labels[lead.title] || lead.title;
}

function uniqueImageItem() {
  const seen = new Set();
  return (item) => {
    const key = imageKey(imageUrls(item.lead)[0]);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  };
}

function renderLeadCard(lead, index) {
  const selected = isSelected(lead);
  const images = imageUrls(lead)
    .map((url) => `<img src="${escapeHtml(url)}" alt="">`)
    .join("");
  return `
    <article class="lead-card ${escapeHtml(lead.status)} ${selected ? "selected" : ""}">
      <div class="content-card">
        <a class="content-tile" href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(lead.title)}">
          <div class="article-photos">${images}</div>
        </a>
        <a class="source-link" href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer">${escapeHtml(compactUrl(lead.url))}</a>
        <div class="card-actions">
          <button class="${selected ? "primary" : "secondary"}" type="button" data-toggle="${index}">
            ${selected ? "選択中" : "選択"}
          </button>
          <a class="secondary" href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer">開く</a>
        </div>
      </div>
    </article>
  `;
}

function imageUrls(lead) {
  return lead.media_urls.filter(isImageUrl);
}

function isImageUrl(value) {
  try {
    return /\.(jpe?g|png|gif|webp)$/i.test(new URL(value).pathname);
  } catch {
    return /\.(jpe?g|png|gif|webp)(?:\?|$)/i.test(value);
  }
}

function imageKey(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.toLowerCase();
  } catch {
    return value.split("?")[0].toLowerCase();
  }
}

function compactUrl(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return value;
  }
}

function isSelected(lead) {
  return state.shortlist.some((item) => item.url === lead.url);
}

async function collect(event) {
  event.preventDefault();
  setStatus("収集中...");
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
  const config = await requestJson("/api/config");
  state.searchButtons = config.search_buttons || [];
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
