import boto3
from decimal import Decimal


def _decimal_to_float(obj):
    """Convert DynamoDB Decimal types to float for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _decimal_to_float(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_decimal_to_float(i) for i in obj]
    return obj


def get_movers(table_name: str, limit: int = 7) -> list[dict]:
    """Scan DynamoDB for stock data, return most recent days."""
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)

    response = table.scan()
    items = response.get("Items", [])

    # Get unique dates sorted descending, limited
    dates = sorted(set(item["date"] for item in items), reverse=True)[:limit]

    # Return all items for those dates
    filtered = [item for item in items if item["date"] in dates]
    filtered.sort(key=lambda x: (x["date"], x["ticker"]), reverse=True)

    return [_decimal_to_float(item) for item in filtered]
