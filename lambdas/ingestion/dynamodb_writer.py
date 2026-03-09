import boto3
from decimal import Decimal


def write_top_mover(table_name: str, date: str, top_mover: dict) -> None:
    """Write the top mover record to DynamoDB."""
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
