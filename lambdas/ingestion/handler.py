import os
from datetime import datetime

from stock_client import get_daily_close
from dynamodb_writer import write_top_mover


def lambda_handler(event, context):
    table_name = os.environ["DYNAMODB_TABLE"]
    api_key = os.environ["POLYGON_API_KEY"]
    tickers = os.environ["STOCK_TICKERS"].split(",")
    today = datetime.utcnow().strftime("%Y-%m-%d")

    print(f"Fetching stock data for {today}: {tickers}")

    results = []
    for ticker in tickers:
        data = get_daily_close(ticker.strip(), today, api_key)
        if data:
            results.append(data)
            print(f"  {data['ticker']}: {data['pct_change']}%")
        else:
            print(f"  {ticker}: no data")

    if not results:
        msg = f"No stock data available for {today}"
        print(msg)
        return {"statusCode": 200, "body": msg}

    # Find top mover by highest absolute % change
    top_mover = max(results, key=lambda x: abs(x["pct_change"]))
    print(f"Top mover: {top_mover['ticker']} ({top_mover['pct_change']}%)")

    write_top_mover(table_name, today, top_mover)

    return {
        "statusCode": 200,
        "body": f"Top mover: {top_mover['ticker']} ({top_mover['pct_change']}%)",
    }
