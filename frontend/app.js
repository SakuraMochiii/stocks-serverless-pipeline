const API_URL = "__API_URL__";

// ── State ──
let allGrouped = {};
let allDates = [];
let chartIndex = 0;

// ── Main ──
async function fetchMovers() {
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const container = document.getElementById("days-container");

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

    renderMarketPulse(data, allGrouped, allDates);
    initChart();
    renderDayCards(container, allGrouped, allDates);
    initTooltips();
  } catch (err) {
    loading.hidden = true;
    error.textContent = `Failed to load data: ${err.message}`;
    error.hidden = false;
  }
}

// ── Market Pulse ──
function renderMarketPulse(data, grouped, dates) {
  const pulse = document.getElementById("market-pulse");
  pulse.hidden = false;

  // Sentiment: % of stocks that gained today
  const latestStocks = grouped[dates[0]] || [];
  const gainers = latestStocks.filter((s) => s.pct_change > 0).length;
  const total = latestStocks.length;
  const sentimentPct = total ? Math.round((gainers / total) * 100) : 0;

  const sentimentEl = document.getElementById("sentiment-value");
  sentimentEl.textContent = `${gainers}/${total} Up`;
  sentimentEl.className = `pulse-value ${sentimentPct >= 50 ? "positive" : "negative"}`;

  const fill = document.querySelector(".sentiment-fill");
  fill.style.width = `${sentimentPct}%`;
  fill.style.background = sentimentPct >= 50 ? "#3fb950" : "#f85149";

  // Avg volatility (mean absolute % change across latest day)
  const avgVol =
    latestStocks.reduce((sum, s) => sum + Math.abs(s.pct_change), 0) /
    (total || 1);
  const volEl = document.getElementById("volatility-value");
  volEl.textContent = `${avgVol.toFixed(2)}%`;
  volEl.className = `pulse-value ${avgVol > 2 ? "negative" : avgVol > 1 ? "positive" : ""}`;

  // Top mover streak
  const streak = calcStreak(grouped, dates);
  const streakEl = document.getElementById("streak-value");
  streakEl.textContent = streak.count > 1
    ? `${streak.ticker} ${streak.count}d`
    : streak.ticker || "--";
  streakEl.className = "pulse-value";
  streakEl.style.color = "#d2a8ff";

  // Date range
  const rangeEl = document.getElementById("range-value");
  rangeEl.textContent = dates.length
    ? `${dates[dates.length - 1]} to ${dates[0]}`
    : "--";
}

function calcStreak(grouped, dates) {
  if (dates.length === 0) return { ticker: null, count: 0 };

  // Find current top mover
  const getTopMover = (stocks) => stocks.find((s) => s.is_top_mover);

  const firstTop = getTopMover(grouped[dates[0]]);
  if (!firstTop) return { ticker: null, count: 0 };

  let count = 1;
  for (let i = 1; i < dates.length; i++) {
    const top = getTopMover(grouped[dates[i]]);
    if (top && top.ticker === firstTop.ticker) {
      count++;
    } else {
      break;
    }
  }
  return { ticker: firstTop.ticker, count };
}

// ── Bar Chart ──
function initChart() {
  const section = document.getElementById("chart-section");
  section.hidden = false;
  chartIndex = 0;

  document.getElementById("chart-prev").addEventListener("click", () => {
    if (chartIndex < allDates.length - 1) { chartIndex++; drawChart(); }
  });
  document.getElementById("chart-next").addEventListener("click", () => {
    if (chartIndex > 0) { chartIndex--; drawChart(); }
  });

  drawChart();
}

function drawChart() {
  const canvas = document.getElementById("bar-chart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  // Responsive sizing
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 220 * dpr;
  canvas.style.height = "220px";
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = 220;
  ctx.clearRect(0, 0, w, h);

  const date = allDates[chartIndex];
  document.getElementById("chart-date").textContent = date;
  document.getElementById("chart-prev").disabled = chartIndex >= allDates.length - 1;
  document.getElementById("chart-next").disabled = chartIndex <= 0;

  const stocks = [...(allGrouped[date] || [])];
  stocks.sort((a, b) => b.pct_change - a.pct_change);

  if (stocks.length === 0) return;

  const maxAbs = Math.max(...stocks.map((s) => Math.abs(s.pct_change)), 0.5);
  const padding = { top: 15, bottom: 25, left: 65, right: 20 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const barH = Math.min(28, (chartH - (stocks.length - 1) * 4) / stocks.length);
  const gap = 4;
  const zeroX = padding.left + chartW / 2;

  // Zero line
  ctx.strokeStyle = "#30363d";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(zeroX, padding.top);
  ctx.lineTo(zeroX, h - padding.bottom);
  ctx.stroke();

  // Scale labels
  ctx.fillStyle = "#484f58";
  ctx.font = "11px -apple-system, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`-${maxAbs.toFixed(1)}%`, padding.left, h - 8);
  ctx.fillText("0%", zeroX, h - 8);
  ctx.fillText(`+${maxAbs.toFixed(1)}%`, w - padding.right, h - 8);

  // Bars with animation
  stocks.forEach((stock, i) => {
    const y = padding.top + i * (barH + gap);
    const pct = stock.pct_change;
    const barW = (Math.abs(pct) / maxAbs) * (chartW / 2);
    const isPositive = pct >= 0;
    const color = isPositive ? "#3fb950" : "#f85149";
    const x = isPositive ? zeroX : zeroX - barW;

    // Bar
    ctx.fillStyle = color;
    ctx.globalAlpha = stock.is_top_mover ? 1 : 0.7;
    roundRect(ctx, x, y, barW, barH, 3);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Top mover glow
    if (stock.is_top_mover) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      roundRect(ctx, x, y, barW, barH, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Ticker label
    ctx.fillStyle = "#e6edf3";
    ctx.font = `${stock.is_top_mover ? "bold " : ""}12px -apple-system, monospace`;
    ctx.textAlign = "right";
    ctx.fillText(stock.ticker, padding.left - 8, y + barH / 2 + 4);

    // Value label
    ctx.fillStyle = color;
    ctx.font = "11px -apple-system, monospace";
    ctx.textAlign = isPositive ? "left" : "right";
    const labelX = isPositive ? zeroX + barW + 5 : zeroX - barW - 5;
    ctx.fillText(`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`, labelX, y + barH / 2 + 4);
  });
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

// ── Day Cards with inline sparklines ──
function renderDayCards(container, grouped, dates) {
  // Compute streaks per ticker across all dates
  const streaks = computeAllStreaks(grouped, dates);

  container.innerHTML = dates
    .map((date, idx) => {
      const stocks = grouped[date];
      stocks.sort((a, b) => Math.abs(b.pct_change) - Math.abs(a.pct_change));

      const gainers = stocks.filter((s) => s.pct_change > 0).length;
      const losers = stocks.length - gainers;
      const maxAbs = Math.max(...stocks.map((s) => Math.abs(s.pct_change)), 0.1);

      const rows = stocks
        .map((item) => {
          const pct = item.pct_change;
          const cls = pct >= 0 ? "positive" : "negative";
          const sign = pct >= 0 ? "+" : "";
          const isTop = item.is_top_mover ? "top-mover" : "";
          const badge = item.is_top_mover
            ? '<span class="badge">TOP MOVER</span>'
            : "";

          // Show streak badge if this ticker has been top mover 2+ days in a row ending on this date
          const streakCount = getStreakAt(streaks, item.ticker, dates, idx);
          const streakBadge =
            item.is_top_mover && streakCount > 1
              ? `<span class="streak-badge">${streakCount}d streak</span>`
              : "";

          // Inline bar width
          const barPct = (Math.abs(pct) / maxAbs) * 100;
          const barColor = pct >= 0 ? "#3fb950" : "#f85149";

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

      return `
        <div class="day-card" style="animation-delay:${idx * 0.06}s">
          <div class="day-header">
            ${date}
            <span class="day-sentiment">${gainers} up / ${losers} down</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Change %</th>
                <th>Open</th>
                <th>Close</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .join("");
}

function computeAllStreaks(grouped, dates) {
  // For each date, record who was top mover
  const topByDate = dates.map((d) => {
    const top = (grouped[d] || []).find((s) => s.is_top_mover);
    return top ? top.ticker : null;
  });
  return topByDate;
}

function getStreakAt(topByDate, ticker, dates, idx) {
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
  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  document.body.appendChild(tooltip);

  document.addEventListener("mouseover", (e) => {
    const row = e.target.closest("tr[data-ticker]");
    if (!row) { tooltip.classList.remove("visible"); return; }

    const ticker = row.dataset.ticker;
    const pct = parseFloat(row.dataset.pct);
    const open = parseFloat(row.dataset.open);
    const close = parseFloat(row.dataset.close);
    const diff = close - open;

    tooltip.innerHTML = `<strong>${ticker}</strong><br>` +
      `Move: $${diff >= 0 ? "+" : ""}${diff.toFixed(2)}<br>` +
      `Range: $${open.toFixed(2)} &rarr; $${close.toFixed(2)}`;
    tooltip.classList.add("visible");
  });

  document.addEventListener("mousemove", (e) => {
    tooltip.style.left = e.clientX + 12 + "px";
    tooltip.style.top = e.clientY - 10 + "px";
  });

  document.addEventListener("mouseout", (e) => {
    if (!e.target.closest("tr[data-ticker]")) {
      tooltip.classList.remove("visible");
    }
  });
}

// ── Resize handler for chart ──
window.addEventListener("resize", () => {
  if (allDates.length > 0) drawChart();
});

fetchMovers();
