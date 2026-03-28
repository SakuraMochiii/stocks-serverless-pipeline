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


def get_movers(table_name: str, limit: int = 7, offset: int = 0) -> dict:
    """
    Scan DynamoDB for stock data with pagination support.

    Returns dict with items, metadata for pagination, and date range info.
    """
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)

    response = table.scan()
    items = response.get("Items", [])

    # Handle DynamoDB pagination for large tables
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))

    # Get all unique dates sorted descending
    all_dates = sorted(set(item["date"] for item in items), reverse=True)
    total_dates = len(all_dates)

    # Apply offset and limit for pagination
    paginated_dates = all_dates[offset : offset + limit]

    # Date range across ALL data
    date_range = (all_dates[-1], all_dates[0]) if all_dates else (None, None)

    # Return all items for the paginated dates
    date_set = set(paginated_dates)
    filtered = [item for item in items if item["date"] in date_set]
    filtered.sort(key=lambda x: (x["date"], x["ticker"]), reverse=True)

    return {
        "items": [_decimal_to_float(item) for item in filtered],
        "total_dates": total_dates,
        "total_records": len(items),
        "date_range": date_range,
        "dates_returned": len(paginated_dates),
        "offset": offset,
        "limit": limit,
    }
