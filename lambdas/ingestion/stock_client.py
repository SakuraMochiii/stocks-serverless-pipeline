import json
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta


def get_daily_close(ticker: str, date: str, api_key: str) -> dict | None:
    """
    Fetch daily open/close data for a ticker from the stock API.
    Retries with exponential backoff on 429 (rate limit).
    Falls back to previous trading days on 404 (weekend/holiday).
    Returns dict with ticker, close, open, pct_change or None on failure.
    """
    max_retries = 5
    current_date = date

    for day_attempt in range(5):  # Try up to 5 previous days for weekends/holidays
        url = f"https://api.polygon.io/v1/open-close/{ticker}/{current_date}?adjusted=true&apiKey={api_key}"

        for retry in range(max_retries):
            try:
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode())

                if data.get("status") == "OK" and data.get("open") and data.get("close"):
                    pct_change = ((data["close"] - data["open"]) / data["open"]) * 100
                    return {
                        "ticker": ticker,
                        "close": data["close"],
                        "open": data["open"],
                        "pct_change": round(pct_change, 4),
                        "date": current_date,
                    }
                # API returned non-OK status (e.g. NOT_AUTHORIZED for same-day data)
                # Fall back to previous day
                print(f"API status '{data.get('status')}' for {ticker} on {current_date}, trying previous day")
                dt = datetime.strptime(current_date, "%Y-%m-%d") - timedelta(days=1)
                current_date = dt.strftime("%Y-%m-%d")
                break

            except urllib.error.HTTPError as e:
                if e.code == 429:
                    wait = min(2 ** (retry + 1), 30)
                    print(f"Rate limited for {ticker}, retrying in {wait}s (attempt {retry + 1}/{max_retries})...")
                    time.sleep(wait)
                    continue
                elif e.code == 404:
                    # No data for this date — try previous day
                    dt = datetime.strptime(current_date, "%Y-%m-%d") - timedelta(days=1)
                    current_date = dt.strftime("%Y-%m-%d")
                    break
                else:
                    print(f"HTTP {e.code} for {ticker} on {current_date}: {e.reason}")
                    return None

            except Exception as e:
                print(f"Error fetching {ticker} on {current_date}: {e}")
                return None

    return None
