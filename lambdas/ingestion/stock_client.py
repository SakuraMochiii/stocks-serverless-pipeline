import json
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta


def get_daily_close(ticker: str, date: str, api_key: str, fallback: bool = True) -> dict | None:
    """
    Fetch daily open/close data for a ticker from the stock API.
    Retries with exponential backoff on 429 (rate limit).
    If fallback=True, tries previous days on 404 or non-OK responses.
    Returns dict with ticker, close, open, pct_change or None on failure.
    """
    max_retries = 5
    current_date = date
    max_days = 5 if fallback else 1

    for day_attempt in range(max_days):
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

                if not fallback:
                    print(f"API status '{data.get('status')}' for {ticker} on {current_date}")
                    return None

                # Non-OK status — try previous day
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
                elif e.code == 404 and fallback:
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
