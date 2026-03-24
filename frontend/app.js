const API_URL = "__API_URL__";

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
    const grouped = {};
    data.forEach((item) => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    });

    // Sort dates descending
    const dates = Object.keys(grouped).sort().reverse();

    container.innerHTML = dates
      .map((date) => {
        const stocks = grouped[date];
        // Sort by absolute pct_change descending
        stocks.sort((a, b) => Math.abs(b.pct_change) - Math.abs(a.pct_change));

        const rows = stocks
          .map((item) => {
            const pct = item.pct_change;
            const cls = pct >= 0 ? "positive" : "negative";
            const sign = pct >= 0 ? "+" : "";
            const isTop = item.is_top_mover ? "top-mover" : "";
            const badge = item.is_top_mover
              ? '<span class="badge">TOP MOVER</span>'
              : "";
            return `<tr class="${isTop}">
              <td class="ticker">${item.ticker}${badge}</td>
              <td class="${cls}">${sign}${pct.toFixed(2)}%</td>
              <td>$${item.open_price.toFixed(2)}</td>
              <td>$${item.close_price.toFixed(2)}</td>
            </tr>`;
          })
          .join("");

        return `
          <div class="day-card">
            <div class="day-header">${date}</div>
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
  } catch (err) {
    loading.hidden = true;
    error.textContent = `Failed to load data: ${err.message}`;
    error.hidden = false;
  }
}

fetchMovers();
