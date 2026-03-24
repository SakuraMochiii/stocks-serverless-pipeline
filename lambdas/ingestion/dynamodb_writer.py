import boto3
from decimal import Decimal


def write_top_mover(table_name: str, date: str, top_mover: dict) -> None:
    """Write the top mover record to DynamoDB (legacy single-record write)."""
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)

    table.put_item(
        Item={
            "date": date,
            "ticker": top_mover["ticker"],
            "pct_change": Decimal(str(top_mover["pct_change"])),
            "close_price": Decimal(str(top_mover["close"])),
            "open_price": Decimal(str(top_mover["open"])),
            "data_date": top_mover["date"],
        }
    )
    print(f"Wrote top mover: {top_mover['ticker']} ({top_mover['pct_change']}%) for {date}")


def write_all_stocks(table_name: str, date: str, results: list[dict], top_ticker: str) -> None:
    """Write all stock results for a date to DynamoDB."""
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)

    with table.batch_writer() as batch:
        for stock in results:
            batch.put_item(
                Item={
                    "date": date,
                    "ticker": stock["ticker"],
                    "pct_change": Decimal(str(stock["pct_change"])),
                    "close_price": Decimal(str(stock["close"])),
                    "open_price": Decimal(str(stock["open"])),
                    "data_date": stock["date"],
                    "is_top_mover": stock["ticker"] == top_ticker,
                }
            )
    print(f"Wrote {len(results)} stocks for {date}, top mover: {top_ticker}")
