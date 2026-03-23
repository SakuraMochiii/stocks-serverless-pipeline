import os
import time
from datetime import datetime, timedelta

from stock_client import get_daily_close
from dynamodb_writer import write_top_mover


def find_last_trading_date(api_key):
    """Find the most recent trading date by testing AAPL."""
    date = datetime.utcnow() - timedelta(days=1)
    for _ in range(5):
        date_str = date.strftime("%Y-%m-%d")
        data = get_daily_close("AAPL", date_str, api_key, fallback=False)
        if data:
            return date_str, data
        date -= timedelta(days=1)
        time.sleep(13)
    return None, None


def lambda_handler(event, context):
    table_name = os.environ["DYNAMODB_TABLE"]
    api_key = os.environ["STOCK_API_KEY"]
    tickers = os.environ["STOCK_TICKERS"].split(",")

    # Find the last trading date using AAPL as a probe
    trading_date, aapl_data = find_last_trading_date(api_key)
    if not trading_date:
        msg = "Could not find recent trading data"
        print(msg)
        return {"statusCode": 200, "body": msg}

    print(f"Trading date: {trading_date}, fetching data for: {tickers}")

    results = []
    for i, ticker in enumerate(tickers):
        ticker = ticker.strip()

        # We already have AAPL data from the probe
        if ticker == "AAPL" and aapl_data:
            results.append(aapl_data)
            print(f"  {aapl_data['ticker']}: {aapl_data['pct_change']}%")
            continue

        # Delay between requests to respect free tier rate limit (5 req/min)
        time.sleep(13)

        try:
            data = get_daily_close(ticker, trading_date, api_key, fallback=False)
            if data:
                results.append(data)
                print(f"  {data['ticker']}: {data['pct_change']}%")
            else:
                print(f"  {ticker}: no data")
        except Exception as e:
            print(f"  {ticker}: error - {e}")

    if not results:
        msg = f"No stock data available for {trading_date}"
        print(msg)
        return {"statusCode": 200, "body": msg}

    # Find top mover by highest absolute % change
    top_mover = max(results, key=lambda x: abs(x["pct_change"]))
    print(f"Top mover: {top_mover['ticker']} ({top_mover['pct_change']}%)")

    try:
        write_top_mover(table_name, trading_date, top_mover)
    except Exception as e:
        print(f"Failed to write to DynamoDB: {e}")
        return {
            "statusCode": 500,
            "body": f"Failed to store top mover: {e}",
        }

    return {
        "statusCode": 200,
        "body": f"Top mover: {top_mover['ticker']} ({top_mover['pct_change']}%)",
    }
