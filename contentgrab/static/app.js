const state = {
  leads: [],
  searchButtons: [],
  shortlist: [],
};

const els = {
  collectForm: document.querySelector("#collect-form"),
  limit: document.querySelector("#limit"),
  minScore: document.querySelector("#min-score"),
  copyShortlist: document.querySelector("#copy-shortlist"),
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
    "Girls Channel Entertainment Manual": "ガールズちゃんねる 芸能",
    "Girls Channel Drama TV Manual": "ガールズちゃんねる ドラマ",
    "5ch Entertainment Board Manual": "5ch 芸スポ",
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
  return lead.media_urls.filter((url) => isImageUrl(url) && !isPlaceholderImageUrl(url));
}

function isImageUrl(value) {
  try {
    return /\.(jpe?g|png|gif|webp)$/i.test(new URL(value).pathname);
  } catch {
    return /\.(jpe?g|png|gif|webp)(?:\?|$)/i.test(value);
  }
}

function isPlaceholderImageUrl(value) {
  const normalized = value.toLowerCase();
  return ["blank", "loading", "no-image", "no_image", "noimage", "placeholder"].some((part) =>
    normalized.includes(part)
  );
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

async function copyShortlist() {
  const links = state.shortlist.map((lead) => lead.url).join("\n");
  if (!links) {
    return;
  }
  if (await writeClipboard(links)) {
    setStatus("コピーしました");
    return;
  }
  setStatus("コピーできませんでした");
}

async function writeClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
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
els.copyShortlist.addEventListener("click", copyShortlist);
els.clearShortlist.addEventListener("click", clearShortlist);
els.leads.addEventListener("click", (event) => {
  const index = event.target.dataset.toggle;
  if (index) {
    toggleLead(Number(index));
  }
});
init().catch((error) => setStatus(error.message));
