import os
import time
from datetime import datetime

from stock_client import get_daily_close
from dynamodb_writer import write_top_mover


def lambda_handler(event, context):
    table_name = os.environ["DYNAMODB_TABLE"]
    api_key = os.environ["STOCK_API_KEY"]
    tickers = os.environ["STOCK_TICKERS"].split(",")
    from datetime import timedelta
    # Free tier API only has previous day data; start from yesterday
    today = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")

    print(f"Fetching stock data for {today}: {tickers}")

    results = []
    for i, ticker in enumerate(tickers):
        # Delay between requests to respect free tier rate limit (5 req/min)
        if i > 0:
            time.sleep(13)

        try:
            data = get_daily_close(ticker.strip(), today, api_key)
            if data:
                results.append(data)
                print(f"  {data['ticker']}: {data['pct_change']}%")
            else:
                print(f"  {ticker}: no data")
        except Exception as e:
            print(f"  {ticker}: error - {e}")

    if not results:
        msg = f"No stock data available for {today}"
        print(msg)
        return {"statusCode": 200, "body": msg}

    # Find top mover by highest absolute % change
    top_mover = max(results, key=lambda x: abs(x["pct_change"]))
    print(f"Top mover: {top_mover['ticker']} ({top_mover['pct_change']}%)")

    try:
        write_top_mover(table_name, today, top_mover)
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
