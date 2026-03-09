const API_URL = "__API_URL__";

async function fetchMovers() {
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const table = document.getElementById("movers-table");
  const tbody = document.getElementById("movers-body");

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

    tbody.innerHTML = data
      .map((item) => {
        const pct = item.pct_change;
        const cls = pct >= 0 ? "positive" : "negative";
        const sign = pct >= 0 ? "+" : "";
        return `<tr>
          <td>${item.date}</td>
          <td class="ticker">${item.ticker}</td>
          <td class="${cls}">${sign}${pct.toFixed(2)}%</td>
          <td>$${item.open_price.toFixed(2)}</td>
          <td>$${item.close_price.toFixed(2)}</td>
        </tr>`;
      })
      .join("");

    table.hidden = false;
  } catch (err) {
    loading.hidden = true;
    error.textContent = `Failed to load data: ${err.message}`;
    error.hidden = false;
  }
}

fetchMovers();
