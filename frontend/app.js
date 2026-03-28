const API_URL = "__API_URL__";

// ── State ──
let allGrouped = {};
let allDates = [];
let selectedHistoryIdx = 0;

// ── Helpers ──
function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function getTopMover(stocks) {
  return stocks.find((s) => s.is_top_mover);
}

// ── Main ──
async function fetchMovers() {
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");

  try {
    const resp = await fetch(`${API_URL}/movers`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    loading.hidden = true;

    if (data.length === 0) {
      error.textContent = "No data available yet. Check back after market close.";
      error.hidden = false;
      return;
    }

    // Group stocks by date
    allGrouped = {};
    data.forEach((item) => {
      if (!allGrouped[item.date]) allGrouped[item.date] = [];
      allGrouped[item.date].push(item);
    });
    allDates = Object.keys(allGrouped).sort().reverse();

    renderMarketPulse();
    renderHero();
    renderCharts();
    renderTodayTable();
    renderLeaderboard();
    renderHistory();
    initTooltips();
  } catch (err) {
    loading.hidden = true;
    error.textContent = `Failed to load data: ${err.message}`;
    error.hidden = false;
  }
}

// ── Market Pulse ──
function renderMarketPulse() {
  const el = document.getElementById("market-pulse");
  el.hidden = false;

  const latest = allDates[0];
  const stocks = allGrouped[latest] || [];
  const gainers = stocks.filter((s) => s.pct_change > 0).length;
  const total = stocks.length;
  const sentimentPct = total ? Math.round((gainers / total) * 100) : 0;

  document.getElementById("pulse-date").textContent = formatDate(latest);

  const sentimentEl = document.getElementById("sentiment-value");
  sentimentEl.textContent = `${gainers}/${total} Up`;
  sentimentEl.className = `pulse-value ${sentimentPct >= 50 ? "positive" : "negative"}`;

  const fill = document.getElementById("sentiment-fill");
  fill.style.width = `${sentimentPct}%`;
  fill.style.background = sentimentPct >= 50 ? "var(--green)" : "var(--red)";

  const avgVol = stocks.reduce((sum, s) => sum + Math.abs(s.pct_change), 0) / (total || 1);
  const volEl = document.getElementById("volatility-value");
  volEl.textContent = `${avgVol.toFixed(2)}%`;
  volEl.className = `pulse-value ${avgVol > 2 ? "negative" : avgVol > 1 ? "positive" : ""}`;

  const streak = calcStreak();
  const streakEl = document.getElementById("streak-value");
  streakEl.textContent = streak.count > 1 ? `${streak.ticker} ${streak.count}d` : streak.ticker || "--";
  streakEl.style.color = "var(--purple)";

  const rangeEl = document.getElementById("range-value");
  if (allDates.length > 1) {
    rangeEl.innerHTML = `${allDates[allDates.length - 1]}<br>to ${allDates[0]}`;
  } else {
    rangeEl.textContent = allDates[0] || "--";
  }
}

function calcStreak() {
  if (allDates.length === 0) return { ticker: null, count: 0 };
  const first = getTopMover(allGrouped[allDates[0]]);
  if (!first) return { ticker: null, count: 0 };
  let count = 1;
  for (let i = 1; i < allDates.length; i++) {
    const top = getTopMover(allGrouped[allDates[i]]);
    if (top && top.ticker === first.ticker) count++;
    else break;
  }
  return { ticker: first.ticker, count };
}

// ── Hero ──
function renderHero() {
  const el = document.getElementById("hero");
  const stocks = allGrouped[allDates[0]] || [];
  const top = getTopMover(stocks);
  if (!top) return;

  el.hidden = false;
  const pct = top.pct_change;
  const cls = pct >= 0 ? "positive" : "negative";
  const sign = pct >= 0 ? "+" : "";
  const diff = top.close_price - top.open_price;

  document.getElementById("hero-ticker").textContent = top.ticker;
  document.getElementById("hero-ticker").style.color = pct >= 0 ? "var(--green)" : "var(--red)";

  const pctEl = document.getElementById("hero-pct");
  pctEl.textContent = `${sign}${pct.toFixed(2)}%`;
  pctEl.className = `hero-pct ${cls}`;

  document.getElementById("hero-open").textContent = `$${top.open_price.toFixed(2)}`;
  document.getElementById("hero-close").textContent = `$${top.close_price.toFixed(2)}`;

  const moveEl = document.getElementById("hero-move");
  moveEl.textContent = `${diff >= 0 ? "+$" : "-$"}${Math.abs(diff).toFixed(2)}`;
  moveEl.className = cls;
}

// ── Charts ──
function renderCharts() {
  document.getElementById("charts-row").hidden = false;
  drawBarChart();
  drawDonutChart();
  window.addEventListener("resize", () => {
    drawBarChart();
    drawDonutChart();
  });
}

function drawBarChart() {
  const canvas = document.getElementById("bar-chart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = 240 * dpr;
  canvas.style.height = "240px";
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = 240;
  ctx.clearRect(0, 0, w, h);

  const stocks = [...(allGrouped[allDates[0]] || [])];
  stocks.sort((a, b) => b.pct_change - a.pct_change);
  if (stocks.length === 0) return;

  const maxAbs = Math.max(...stocks.map((s) => Math.abs(s.pct_change)), 0.5);
  const pad = { top: 18, bottom: 26, left: 68, right: 24 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;
  const barH = Math.min(30, (ch - (stocks.length - 1) * 5) / stocks.length);
  const gap = 5;
  const zeroX = pad.left + cw / 2;

  // Grid lines
  ctx.strokeStyle = "#243456";
  ctx.lineWidth = 0.5;
  for (const frac of [-0.5, 0, 0.5]) {
    const x = zeroX + frac * cw;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, h - pad.bottom);
    ctx.stroke();
  }

  // Zero line
  ctx.strokeStyle = "#3a5080";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(zeroX, pad.top);
  ctx.lineTo(zeroX, h - pad.bottom);
  ctx.stroke();

  // Scale labels
  ctx.fillStyle = "#5a6f8f";
  ctx.font = "11px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`-${maxAbs.toFixed(1)}%`, pad.left, h - 6);
  ctx.fillText("0%", zeroX, h - 6);
  ctx.fillText(`+${maxAbs.toFixed(1)}%`, w - pad.right, h - 6);

  stocks.forEach((stock, i) => {
    const y = pad.top + i * (barH + gap);
    const pct = stock.pct_change;
    const barW = (Math.abs(pct) / maxAbs) * (cw / 2);
    const isPos = pct >= 0;
    const color = isPos ? "#34d399" : "#f87171";
    const x = isPos ? zeroX : zeroX - barW;

    ctx.fillStyle = color;
    ctx.globalAlpha = stock.is_top_mover ? 1 : 0.6;
    roundRect(ctx, x, y, barW, barH, 4);
    ctx.fill();

    if (stock.is_top_mover) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      roundRect(ctx, x, y, barW, barH, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // Ticker
    ctx.fillStyle = stock.is_top_mover ? "#fff" : "#9bafc5";
    ctx.font = `${stock.is_top_mover ? "bold " : ""}12px -apple-system, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(stock.ticker, pad.left - 10, y + barH / 2 + 4);

    // Value
    ctx.fillStyle = color;
    ctx.font = "11px -apple-system, sans-serif";
    ctx.textAlign = isPos ? "left" : "right";
    ctx.fillText(`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`, isPos ? zeroX + barW + 6 : zeroX - barW - 6, y + barH / 2 + 4);
  });
}

function drawDonutChart() {
  const canvas = document.getElementById("donut-chart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  const size = Math.min(rect.width, 180);

  canvas.width = rect.width * dpr;
  canvas.height = 160 * dpr;
  canvas.style.height = "160px";
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = 160;
  ctx.clearRect(0, 0, w, h);

  const stocks = allGrouped[allDates[0]] || [];
  const gainers = stocks.filter((s) => s.pct_change > 0).length;
  const losers = stocks.filter((s) => s.pct_change < 0).length;
  const flat = stocks.length - gainers - losers;
  const total = stocks.length || 1;

  const cx = w / 2;
  const cy = h / 2;
  const r = size * 0.36;
  const innerR = r * 0.58;

  const slices = [
    { val: gainers, color: "#34d399", label: "Gainers" },
    { val: losers, color: "#f87171", label: "Losers" },
    { val: flat, color: "#3a5080", label: "Flat" },
  ].filter(s => s.val > 0);

  let angle = -Math.PI / 2;
  slices.forEach((slice) => {
    const sweep = (slice.val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.arc(cx, cy, innerR, angle + sweep, angle, true);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    angle += sweep;
  });

  // Center text
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${gainers}/${total}`, cx, cy - 6);
  ctx.fillStyle = "#7e8faa";
  ctx.font = "11px -apple-system, sans-serif";
  ctx.fillText("gainers", cx, cy + 12);

  // Legend
  const legend = document.getElementById("donut-legend");
  legend.innerHTML = slices
    .map((s) => `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${s.label}: ${s.val}</span>`)
    .join("");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Today Table ──
function renderTodayTable() {
  const card = document.getElementById("today-card");
  card.hidden = false;
  document.getElementById("today-header").textContent = `All Stocks \u2014 ${formatDate(allDates[0])}`;
  document.getElementById("today-table").innerHTML = buildTable(allGrouped[allDates[0]], 0);
}

// ── Leaderboard ──
function renderLeaderboard() {
  const el = document.getElementById("leaderboard");
  el.hidden = false;

  // Count wins per ticker
  const wins = {};
  allDates.forEach((d) => {
    const top = getTopMover(allGrouped[d]);
    if (top) wins[top.ticker] = (wins[top.ticker] || 0) + 1;
  });

  const sorted = Object.entries(wins).sort((a, b) => b[1] - a[1]);
  const maxWins = sorted.length ? sorted[0][1] : 1;

  document.getElementById("leaderboard-content").innerHTML = sorted
    .map(([ticker, count], i) => `
      <div class="lb-item ${i === 0 ? "lb-leader" : ""}">
        <div class="lb-ticker">${ticker}</div>
        <div class="lb-wins">${count} win${count !== 1 ? "s" : ""} / ${allDates.length} days</div>
        <div class="lb-bar-track"><div class="lb-bar-fill" style="width:${(count / maxWins) * 100}%"></div></div>
      </div>
    `)
    .join("");
}

// ── History with Tabs ──
function renderHistory() {
  if (allDates.length < 2) return;

  const section = document.getElementById("history-section");
  section.hidden = false;

  const historyDates = allDates.slice(1); // skip today
  selectedHistoryIdx = 0;

  const tabsEl = document.getElementById("history-tabs");
  tabsEl.innerHTML = historyDates
    .map((d, i) => {
      const dt = new Date(d + "T12:00:00");
      const label = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `<button class="history-tab ${i === 0 ? "active" : ""}" data-idx="${i}">${label}</button>`;
    })
    .join("");

  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".history-tab");
    if (!btn) return;
    selectedHistoryIdx = parseInt(btn.dataset.idx);
    tabsEl.querySelectorAll(".history-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderHistoryTable(historyDates);
  });

  renderHistoryTable(historyDates);
}

function renderHistoryTable(historyDates) {
  const date = historyDates[selectedHistoryIdx];
  const stocks = allGrouped[date] || [];
  document.getElementById("history-table").innerHTML = buildTable(stocks, selectedHistoryIdx + 1);
}

// ── Shared Table Builder ──
function buildTable(stocks, dateIdx) {
  if (!stocks || stocks.length === 0) return '<div style="padding:1rem;color:var(--text-muted);text-align:center">No data</div>';

  const sorted = [...stocks].sort((a, b) => Math.abs(b.pct_change) - Math.abs(a.pct_change));
  const maxAbs = Math.max(...sorted.map((s) => Math.abs(s.pct_change)), 0.1);
  const topByDate = allDates.map((d) => {
    const t = getTopMover(allGrouped[d]);
    return t ? t.ticker : null;
  });

  const rows = sorted
    .map((item) => {
      const pct = item.pct_change;
      const cls = pct >= 0 ? "positive" : "negative";
      const sign = pct >= 0 ? "+" : "";
      const isTop = item.is_top_mover ? "top-mover" : "";
      const badge = item.is_top_mover ? '<span class="badge">TOP MOVER</span>' : "";

      const streakCount = getStreakAt(topByDate, item.ticker, dateIdx);
      const streakBadge = item.is_top_mover && streakCount > 1
        ? `<span class="streak-badge">${streakCount}d streak</span>` : "";

      const barPct = (Math.abs(pct) / maxAbs) * 100;
      const barColor = pct >= 0 ? "var(--green)" : "var(--red)";

      return `<tr class="${isTop}" data-ticker="${item.ticker}" data-pct="${pct}" data-open="${item.open_price}" data-close="${item.close_price}">
        <td class="ticker">${item.ticker}${badge}${streakBadge}</td>
        <td class="pct-bar-cell ${cls}">
          <span class="pct-bar" style="width:${barPct}%;background:${barColor}"></span>
          ${sign}${pct.toFixed(2)}%
        </td>
        <td>$${item.open_price.toFixed(2)}</td>
        <td>$${item.close_price.toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  return `<table>
    <thead><tr><th>Ticker</th><th>Change %</th><th>Open</th><th>Close</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function getStreakAt(topByDate, ticker, idx) {
  if (topByDate[idx] !== ticker) return 0;
  let count = 1;
  for (let i = idx + 1; i < topByDate.length; i++) {
    if (topByDate[i] === ticker) count++;
    else break;
  }
  return count;
}

// ── Tooltips ──
function initTooltips() {
  const tooltip = document.getElementById("tooltip");

  document.addEventListener("mouseover", (e) => {
    const row = e.target.closest("tr[data-ticker]");
    if (!row) { tooltip.classList.remove("visible"); return; }

    const ticker = row.dataset.ticker;
    const pct = parseFloat(row.dataset.pct);
    const open = parseFloat(row.dataset.open);
    const close = parseFloat(row.dataset.close);
    const diff = close - open;

    tooltip.innerHTML = `<strong>${ticker}</strong><br>` +
      `Move: ${diff >= 0 ? "+$" : "-$"}${Math.abs(diff).toFixed(2)}<br>` +
      `$${open.toFixed(2)} &rarr; $${close.toFixed(2)}`;
    tooltip.classList.add("visible");
  });

  document.addEventListener("mousemove", (e) => {
    tooltip.style.left = e.clientX + 14 + "px";
    tooltip.style.top = e.clientY - 12 + "px";
  });

  document.addEventListener("mouseout", (e) => {
    if (!e.target.closest("tr[data-ticker]")) tooltip.classList.remove("visible");
  });
}

fetchMovers();
