const API_URL = "__API_URL__";

// ── State ──
let allGrouped = {};
let allDates = [];
let selectedHistoryIdx = 0;
let selectedLineTicker = null; // null = show all

// ── Consistent color per ticker ──
const TICKER_COLORS = {
  AAPL: "#5ba0f5",
  MSFT: "#34d399",
  GOOGL: "#f87171",
  AMZN: "#fbbf24",
  TSLA: "#c4a5f7",
  NVDA: "#f472b6",
};

// ── Company logos (Google favicon service) ──
const TICKER_DOMAINS = {
  AAPL: "apple.com",
  MSFT: "microsoft.com",
  GOOGL: "google.com",
  AMZN: "amazon.com",
  TSLA: "tesla.com",
  NVDA: "nvidia.com",
};

function tickerIcon(ticker, size) {
  const domain = TICKER_DOMAINS[ticker];
  if (!domain) return "";
  const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  return `<img src="${url}" alt="${ticker}" class="ticker-icon" style="width:${size}px;height:${size}px" onerror="this.style.display='none'">`;
}

let lineChartState = null;

// ── Helpers ──
function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function shortDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTopMover(stocks) {
  return stocks.find((s) => s.is_top_mover);
}

function tickerColor(ticker) {
  return TICKER_COLORS[ticker] || "#5ba0f5";
}

// ── Main ──
async function fetchMovers() {
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");

  try {
    const resp = await fetch(`${API_URL}/movers`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    loading.style.display = "none";

    if (data.length === 0) {
      error.textContent = "No data available yet. Check back after market close.";
      error.hidden = false;
      return;
    }

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
    renderLineChart();
    renderHistory();
    initLineChartHover();
    initPageTabs();
    setupScrollReveal();

    window.addEventListener("resize", () => {
      drawBarChart(1);
      drawDonutChart(1);
      drawLineChart(selectedLineTicker);
    });
  } catch (err) {
    loading.style.display = "none";
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

  const avgVol = stocks.reduce((sum, s) => sum + Math.abs(s.pct_change), 0) / (total || 1);
  const volEl = document.getElementById("volatility-value");
  volEl.textContent = `${avgVol.toFixed(2)}%`;
  volEl.className = `pulse-value ${avgVol > 2 ? "negative" : avgVol > 1 ? "positive" : ""}`;

  const streak = calcStreak();
  const streakEl = document.getElementById("streak-value");
  streakEl.textContent = streak.count > 1 ? `${streak.ticker} ${streak.count}d` : streak.ticker || "--";
  streakEl.style.color = "var(--text)";

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

// ── Hero (centered) ──
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

  const heroTickerEl = document.getElementById("hero-ticker");
  heroTickerEl.innerHTML = `${tickerIcon(top.ticker, 36)}${top.ticker}`;
  heroTickerEl.style.color = tickerColor(top.ticker);

  const pctEl = document.getElementById("hero-pct");
  pctEl.textContent = `${sign}${pct.toFixed(2)}%`;
  pctEl.className = `hero-pct ${cls}`;

  document.getElementById("hero-open").textContent = `$${top.open_price.toFixed(2)}`;
  document.getElementById("hero-close").textContent = `$${top.close_price.toFixed(2)}`;

  const moveEl = document.getElementById("hero-move");
  moveEl.textContent = `${diff >= 0 ? "+$" : "-$"}${Math.abs(diff).toFixed(2)}`;
  moveEl.className = cls;
}

// ── Bar + Donut Charts ──
let barAnimated = false;
let donutAnimated = false;
let barHoverAnimated = false;
let donutHoverAnimated = false;

function renderCharts() {
  document.getElementById("charts-row").hidden = false;
  barAnimated = false;
  donutAnimated = false;
  barHoverAnimated = false;
  donutHoverAnimated = false;
  animateBarChart();
  animateDonutChart();

  // Replay animation on hover
  document.querySelector(".chart-card-main").addEventListener("mouseenter", () => {
    animateBarChart();
  });

  document.querySelector(".chart-card-side").addEventListener("mouseenter", () => {
    animateDonutChart();
  });
}

function drawBarChart(progress) {
  const t = progress !== undefined ? progress : 1;
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
  const labelW = 62;
  const barGap = 8;
  const pad = { top: 18, bottom: 26, left: 68, right: 16 };
  const cw = w - pad.left - pad.right;
  const barAreaW = (cw - labelW * 2) / 2;
  const ch = h - pad.top - pad.bottom;
  const barH = Math.min(30, (ch - (stocks.length - 1) * 5) / stocks.length);
  const gap = 5;
  const zeroX = pad.left + cw / 2;

  // Grid
  ctx.strokeStyle = "#2a2b33";
  ctx.lineWidth = 0.5;
  for (const frac of [-0.5, 0, 0.5]) {
    const x = zeroX + frac * (barAreaW * 2);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, h - pad.bottom);
    ctx.stroke();
  }

  ctx.strokeStyle = "#35363f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(zeroX, pad.top);
  ctx.lineTo(zeroX, h - pad.bottom);
  ctx.stroke();

  ctx.fillStyle = "#7c7d88";
  ctx.font = "11px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`-${maxAbs.toFixed(1)}%`, zeroX - barAreaW, h - 6);
  ctx.fillText("0%", zeroX, h - 6);
  ctx.fillText(`+${maxAbs.toFixed(1)}%`, zeroX + barAreaW, h - 6);

  stocks.forEach((stock, i) => {
    // Stagger each bar's animation
    const barDelay = i * 0.08;
    const barT = Math.max(0, Math.min(1, (t - barDelay) / (1 - barDelay * 0.5)));
    const eased = 1 - Math.pow(1 - barT, 3); // ease-out cubic

    const y = pad.top + i * (barH + gap);
    const pct = stock.pct_change;
    const fullBarW = (Math.abs(pct) / maxAbs) * barAreaW;
    const barW = Math.max((fullBarW - barGap) * eased, eased > 0 ? 2 : 0);
    const isPos = pct >= 0;
    const color = isPos ? "#2dd4a0" : "#ef6b6b";
    const x = isPos ? zeroX + barGap : zeroX - barGap - barW;

    if (barW > 0) {
      ctx.fillStyle = color;
      ctx.globalAlpha = (stock.is_top_mover ? 1 : 0.6) * Math.min(1, eased * 1.5);
      roundRect(ctx, x, y, barW, barH, 4);
      ctx.fill();

      if (stock.is_top_mover && eased > 0.5) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12 * eased;
        roundRect(ctx, x, y, barW, barH, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    }

    // Labels fade in
    const labelAlpha = Math.min(1, eased * 2);
    ctx.globalAlpha = labelAlpha;

    ctx.fillStyle = stock.is_top_mover ? "#fff" : "#9bafc5";
    ctx.font = `${stock.is_top_mover ? "bold " : ""}12px -apple-system, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(stock.ticker, pad.left - 10, y + barH / 2 + 4);

    if (eased > 0.3) {
      const label = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
      ctx.fillStyle = stock.is_top_mover ? "#fff" : "#9bafc5";
      ctx.font = "11px -apple-system, sans-serif";
      if (isPos) {
        ctx.textAlign = "left";
        ctx.fillText(label, x + barW + 6, y + barH / 2 + 4);
      } else {
        ctx.textAlign = "right";
        ctx.fillText(label, x - 6, y + barH / 2 + 4);
      }
    }
    ctx.globalAlpha = 1;
  });
}

function animateBarChart() {
  const duration = 800;
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    drawBarChart(t);
    if (t < 1) requestAnimationFrame(frame);
    else barAnimated = true;
  }
  requestAnimationFrame(frame);
}

function drawDonutChart(progress) {
  const t = progress !== undefined ? progress : 1;
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
    { val: gainers, color: "#2dd4a0", label: "Gainers" },
    { val: losers, color: "#ef6b6b", label: "Losers" },
    { val: flat, color: "#35363f", label: "Flat" },
  ].filter((s) => s.val > 0);

  // Eased progress for the sweep
  const eased = 1 - Math.pow(1 - t, 3);
  const totalSweep = Math.PI * 2 * eased;

  let angle = -Math.PI / 2;
  let drawn = 0;
  slices.forEach((slice) => {
    const fullSweep = (slice.val / total) * Math.PI * 2;
    const sweep = Math.min(fullSweep, Math.max(0, totalSweep - drawn));
    if (sweep <= 0) return;

    ctx.beginPath();
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.arc(cx, cy, innerR, angle + sweep, angle, true);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();

    drawn += sweep;
    angle += sweep;
  });

  // Center text fades in at the end
  const textAlpha = Math.max(0, (t - 0.6) / 0.4);
  ctx.globalAlpha = textAlpha;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${gainers}/${total}`, cx, cy - 6);
  ctx.fillStyle = "#7c7d88";
  ctx.font = "11px -apple-system, sans-serif";
  ctx.fillText("gainers", cx, cy + 12);
  ctx.globalAlpha = 1;

  document.getElementById("donut-legend").innerHTML = slices
    .map((s) => `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${s.label}: ${s.val}</span>`)
    .join("");
}

function animateDonutChart() {
  const duration = 900;
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    drawDonutChart(t);
    if (t < 1) requestAnimationFrame(frame);
    else donutAnimated = true;
  }
  requestAnimationFrame(frame);
}

// ── Line Chart ──
function renderLineChart() {
  document.getElementById("line-chart-section").hidden = false;
  buildLineSelector();
  drawLineChart(selectedLineTicker);
}

function buildLineSelector() {
  const el = document.getElementById("line-selector");
  const tickers = new Set();
  allDates.forEach((d) => (allGrouped[d] || []).forEach((s) => tickers.add(s.ticker)));
  const tickerList = [...tickers].sort();

  const allBtn = `<button class="line-sel-btn-all ${selectedLineTicker === null ? "active" : ""}" data-ticker="__all__">All</button>`;
  const btns = tickerList.map((t) => {
    const c = tickerColor(t);
    const active = selectedLineTicker === t ? "active" : "";
    return `<button class="line-sel-btn ${active}" data-ticker="${t}" style="--sel-color:${c}"><span class="line-sel-dot" style="background:${c}"></span>${t}</button>`;
  }).join("");

  el.innerHTML = allBtn + btns;

  el.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ticker]");
    if (!btn) return;
    const ticker = btn.dataset.ticker;
    if (ticker === "__all__") {
      selectedLineTicker = null;
    } else {
      selectedLineTicker = selectedLineTicker === ticker ? null : ticker;
    }
    // Update button states
    el.querySelectorAll(".line-sel-btn, .line-sel-btn-all").forEach((b) => b.classList.remove("active"));
    if (selectedLineTicker === null) {
      el.querySelector(".line-sel-btn-all").classList.add("active");
    } else {
      el.querySelector(`[data-ticker="${selectedLineTicker}"]`).classList.add("active");
    }
    drawLineChart(selectedLineTicker);
  });
}

function niceInterval(range, steps) {
  const raw = range / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let nice;
  if (norm <= 1.5) nice = 1;
  else if (norm <= 3) nice = 2;
  else if (norm <= 7) nice = 5;
  else nice = 10;
  return nice * mag;
}

function drawLineChart(highlightTicker, hoverTicker) {
  const canvas = document.getElementById("line-chart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = 260 * dpr;
  canvas.style.height = "260px";
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = 260;
  ctx.clearRect(0, 0, w, h);

  const dates = [...allDates].reverse();
  if (dates.length < 2) return;

  const tickers = new Set();
  dates.forEach((d) => (allGrouped[d] || []).forEach((s) => tickers.add(s.ticker)));
  const tickerList = [...tickers].sort();

  const series = {};
  tickerList.forEach((t) => {
    series[t] = dates.map((d) => {
      const stock = (allGrouped[d] || []).find((s) => s.ticker === t);
      return stock ? stock.pct_change : null;
    });
  });

  let dataMin = 0, dataMax = 0;
  tickerList.forEach((t) => {
    series[t].forEach((v) => {
      if (v !== null) {
        dataMin = Math.min(dataMin, v);
        dataMax = Math.max(dataMax, v);
      }
    });
  });

  const interval = niceInterval(Math.max(dataMax - dataMin, 0.5), 5);
  const minVal = Math.floor(dataMin / interval) * interval - interval;
  const maxVal = Math.ceil(dataMax / interval) * interval + interval;

  const pad = { top: 20, bottom: 36, left: 52, right: 54 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  function xPos(i) { return pad.left + (i / (dates.length - 1)) * cw; }
  function yPos(v) { return pad.top + (1 - (v - minVal) / (maxVal - minVal)) * ch; }

  lineChartState = { dates, tickerList, series, pad, cw, ch, minVal, maxVal, xPos, yPos, w, h };

  // The active ticker is either the selected one or the hovered one
  const activeTicker = hoverTicker || highlightTicker;

  // Y-axis grid
  ctx.textAlign = "right";
  for (let val = minVal; val <= maxVal + 0.001; val += interval) {
    const y = yPos(val);
    ctx.fillStyle = "#5a6f8f";
    ctx.font = "10px -apple-system, sans-serif";
    ctx.fillText(`${val.toFixed(1)}%`, pad.left - 6, y + 3);
    ctx.strokeStyle = Math.abs(val) < 0.001 ? "#4a6a9a" : "#1a2847";
    ctx.lineWidth = Math.abs(val) < 0.001 ? 1 : 0.5;
    if (Math.abs(val) < 0.001) ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // X-axis labels
  ctx.fillStyle = "#5a6f8f";
  ctx.font = "10px -apple-system, sans-serif";
  ctx.textAlign = "center";
  dates.forEach((d, i) => {
    ctx.fillText(shortDate(d), xPos(i), h - pad.bottom + 16);
  });

  // Draw lines
  tickerList.forEach((ticker) => {
    const color = tickerColor(ticker);
    const data = series[ticker];
    const isActive = activeTicker === ticker;
    const isDimmed = activeTicker && activeTicker !== ticker;

    // Glow for active
    if (isActive) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 8;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      let started = false;
      data.forEach((val, i) => {
        if (val === null) return;
        if (!started) { ctx.moveTo(xPos(i), yPos(val)); started = true; }
        else ctx.lineTo(xPos(i), yPos(val));
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Main line
    ctx.strokeStyle = color;
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalAlpha = isDimmed ? 0.15 : 1;
    ctx.beginPath();
    let started = false;
    data.forEach((val, i) => {
      if (val === null) return;
      if (!started) { ctx.moveTo(xPos(i), yPos(val)); started = true; }
      else ctx.lineTo(xPos(i), yPos(val));
    });
    ctx.stroke();

    // Dots
    data.forEach((val, i) => {
      if (val === null) return;
      const x = xPos(i);
      const y = yPos(val);
      ctx.fillStyle = "#0f1a2e";
      ctx.beginPath();
      ctx.arc(x, y, isActive ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, isActive ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1;

    // Ticker label at end
    const lastVal = data.findLast((v) => v !== null);
    const lastIdx = data.lastIndexOf(lastVal);
    if (lastVal !== null) {
      ctx.fillStyle = color;
      ctx.globalAlpha = isDimmed ? 0.2 : 1;
      ctx.font = `${isActive ? "bold " : ""}11px -apple-system, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(ticker, xPos(lastIdx) + 8, yPos(lastVal) + 4);
      ctx.globalAlpha = 1;
    }
  });

  // Legend
  document.getElementById("line-legend").innerHTML = tickerList
    .map((t) => `<span class="line-legend-item"><span class="line-legend-swatch" style="background:${tickerColor(t)}"></span>${t}</span>`)
    .join("");
}

// ── Line Chart Hover ──
function initLineChartHover() {
  const canvas = document.getElementById("line-chart");
  const tooltipEl = document.getElementById("line-tooltip");

  canvas.addEventListener("mousemove", (e) => {
    if (!lineChartState) return;
    const { dates, tickerList, series, xPos, yPos } = lineChartState;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Find nearest date column
    let nearestDateIdx = 0;
    let minDist = Infinity;
    dates.forEach((d, i) => {
      const dist = Math.abs(mx - xPos(i));
      if (dist < minDist) { minDist = dist; nearestDateIdx = i; }
    });

    // If a ticker is selected, only show tooltip for that ticker
    // Otherwise find nearest ticker
    let hoverTarget = null;

    if (selectedLineTicker) {
      const val = series[selectedLineTicker][nearestDateIdx];
      if (val !== null) hoverTarget = selectedLineTicker;
    } else {
      let nearestDist = 30;
      tickerList.forEach((t) => {
        const val = series[t][nearestDateIdx];
        if (val === null) return;
        const dy = Math.abs(my - yPos(val));
        if (dy < nearestDist) {
          nearestDist = dy;
          hoverTarget = t;
        }
      });
    }

    if (hoverTarget) {
      const val = series[hoverTarget][nearestDateIdx];
      const sign = val >= 0 ? "+" : "";
      const color = tickerColor(hoverTarget);

      // When a ticker is selected, keep it highlighted; hover just shows tooltip
      // When no ticker selected, hover highlights the line
      if (selectedLineTicker) {
        drawLineChart(selectedLineTicker);
      } else {
        drawLineChart(null, hoverTarget);
      }

      tooltipEl.innerHTML = `<span style="color:${color};font-weight:700">${hoverTarget}</span> &middot; ${shortDate(dates[nearestDateIdx])}<br><span style="color:${val >= 0 ? "var(--green)" : "var(--red)"}">${sign}${val.toFixed(2)}%</span>`;
      tooltipEl.classList.add("visible");

      const cardRect = canvas.parentElement.getBoundingClientRect();
      let tx = e.clientX - cardRect.left + 16;
      let ty = e.clientY - cardRect.top - 10;
      if (tx + 140 > cardRect.width) tx = tx - 160;
      tooltipEl.style.left = tx + "px";
      tooltipEl.style.top = ty + "px";
    } else {
      drawLineChart(selectedLineTicker);
      tooltipEl.classList.remove("visible");
    }
  });

  canvas.addEventListener("mouseleave", () => {
    drawLineChart(selectedLineTicker);
    tooltipEl.classList.remove("visible");
  });
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

  const wins = {};
  const winDates = {};
  const winChanges = {};
  allDates.forEach((d) => {
    const top = getTopMover(allGrouped[d]);
    if (top) {
      wins[top.ticker] = (wins[top.ticker] || 0) + 1;
      if (!winDates[top.ticker]) winDates[top.ticker] = [];
      if (!winChanges[top.ticker]) winChanges[top.ticker] = [];
      winDates[top.ticker].push(d);
      winChanges[top.ticker].push(top.pct_change);
    }
  });

  const sorted = Object.entries(wins).sort((a, b) => b[1] - a[1]);
  const maxWins = sorted.length ? sorted[0][1] : 1;

  document.getElementById("leaderboard-content").innerHTML = sorted
    .map(([ticker, count], i) => {
      const changes = winChanges[ticker] || [];
      const dates = (winDates[ticker] || []).map((d, j) => {
        const pct = changes[j];
        const sign = pct >= 0 ? "+" : "";
        const cls = pct >= 0 ? "positive" : "negative";
        return `${shortDate(d)} <span class="${cls}">${sign}${pct.toFixed(2)}%</span>`;
      }).join(", ");
      const color = tickerColor(ticker);
      return `
        <div class="lb-row ${i === 0 ? "lb-leader" : ""}">
          <div class="lb-rank">#${i + 1}</div>
          <div class="lb-ticker">${tickerIcon(ticker, 22)}${ticker}</div>
          <div class="lb-info">
            <div class="lb-wins">${count} win${count !== 1 ? "s" : ""} out of ${allDates.length} days</div>
            <div class="lb-dates">${dates}</div>
          </div>
          <div class="lb-bar-track"><div class="lb-bar-fill" style="width:${(count / maxWins) * 100}%"></div></div>
        </div>`;
    })
    .join("");
}

// ── History with Tabs ──
function renderHistory() {
  if (allDates.length < 2) return;

  const section = document.getElementById("history-section");
  section.hidden = false;

  const historyDates = allDates.slice(1);
  selectedHistoryIdx = 0;

  const tabsEl = document.getElementById("history-tabs");
  tabsEl.innerHTML = historyDates
    .map((d, i) => `<button class="history-tab ${i === 0 ? "active" : ""}" data-idx="${i}">${shortDate(d)}</button>`)
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
  const el = document.getElementById("history-table");
  el.innerHTML = buildTable(allGrouped[date] || [], selectedHistoryIdx + 1);
  el.classList.remove("table-animate");
  void el.offsetWidth;
  el.classList.add("table-animate");
}

// ── Shared Table Builder ──
function buildTable(stocks, dateIdx) {
  if (!stocks || stocks.length === 0)
    return '<div style="padding:1rem;color:var(--text-muted);text-align:center">No data</div>';

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
      const badge = item.is_top_mover ? '<span class="badge">TOP</span>' : "";

      const streakCount = getStreakAt(topByDate, item.ticker, dateIdx);
      const streakBadge = item.is_top_mover && streakCount > 1
        ? `<span class="streak-badge">${streakCount}d</span>` : "";

      const barPct = Math.min((Math.abs(pct) / maxAbs) * 100, 100);
      const barColor = pct >= 0 ? "var(--green)" : "var(--red)";

      return `<tr class="${isTop}" data-ticker="${item.ticker}" data-pct="${pct}" data-open="${item.open_price}" data-close="${item.close_price}">
        <td class="ticker">${item.ticker}${badge}${streakBadge}</td>
        <td class="pct-bar-cell ${cls}">
          <span class="pct-bar-wrap"><span class="pct-bar" style="width:${barPct}%;background:${barColor}"></span></span>
          <span class="pct-text">${sign}${pct.toFixed(2)}%</span>
        </td>
        <td>$${item.open_price.toFixed(2)}</td>
        <td>$${item.close_price.toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  return `<table>
    <colgroup><col class="col-ticker"><col class="col-change"><col class="col-open"><col class="col-close"></colgroup>
    <thead><tr><th>Ticker</th><th>Change</th><th>Open</th><th>Close</th></tr></thead>
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

// ── Canvas Helpers ──
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

// ── Page Tabs ──
let currentTab = "overview";

function initPageTabs() {
  const tabBar = document.getElementById("page-tabs");
  tabBar.hidden = false;

  tabBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".page-tab");
    if (!btn) return;

    const tab = btn.dataset.tab;
    if (tab === currentTab) return;

    const goingRight = tab === "history";
    const prevTab = currentTab;
    currentTab = tab;

    tabBar.querySelectorAll(".page-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // Hide old tab
    const oldEl = document.getElementById(`tab-${prevTab}`);
    oldEl.style.display = "none";

    // Show new tab with directional animation
    const newEl = document.getElementById(`tab-${tab}`);
    newEl.style.display = "";
    newEl.classList.remove("enter-left", "enter-right", "animate");

    // Force reflow to restart animation
    void newEl.offsetWidth;

    newEl.classList.add(goingRight ? "enter-right" : "enter-left", "animate");

    // Re-animate charts on tab switch and reveal hidden cards
    setTimeout(() => {
      if (tab === "overview") {
        animateBarChart();
        animateDonutChart();
      } else {
        drawLineChart(selectedLineTicker);
      }
      // Animate cards in the new tab with stagger
      newEl.querySelectorAll(".card:not(.visible)").forEach((c, i) => {
        c.classList.add("scroll-reveal");
        setTimeout(() => c.classList.add("visible"), i * 200);
      });
    }, 10);
  });
}

// ── Scroll Reveal ──
function setupScrollReveal() {
  const els = document.querySelectorAll("#tab-overview .card, .hero-card, #market-pulse");

  // Cards already in viewport on load: leave them visible (no animation)
  // Cards below the fold: hide them, animate in when scrolled to
  els.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight) {
      el.classList.add("scroll-reveal");
    }
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll(".scroll-reveal").forEach((el) => observer.observe(el));
}

fetchMovers();
