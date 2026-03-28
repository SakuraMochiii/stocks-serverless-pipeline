import hashlib
import json
import os
import time

from dynamodb_reader import get_movers


def lambda_handler(event, context):
    table_name = os.environ["DYNAMODB_TABLE"]
    request_start = time.time()

    # Parse query string parameters
    params = event.get("queryStringParameters") or {}

    limit = 7
    if "limit" in params:
        try:
            limit = max(1, min(int(params["limit"]), 30))
        except ValueError:
            return _error_response(400, "Invalid limit parameter")

    offset = 0
    if "offset" in params:
        try:
            offset = max(0, int(params["offset"]))
        except ValueError:
            return _error_response(400, "Invalid offset parameter")

    try:
        result = get_movers(table_name, limit, offset)
    except Exception as e:
        print(f"Failed to read from DynamoDB: {e}")
        return _error_response(502, "Failed to retrieve data")

    body = json.dumps(result["items"])

    # Generate ETag from response content for client-side caching
    etag = hashlib.md5(body.encode()).hexdigest()

    # Check If-None-Match for conditional requests
    request_headers = event.get("headers") or {}
    if_none_match = request_headers.get("if-none-match", "")
    if if_none_match == etag:
        return {
            "statusCode": 304,
            "headers": _build_headers(result, etag, request_start),
            "body": "",
        }

    return {
        "statusCode": 200,
        "headers": _build_headers(result, etag, request_start),
        "body": body,
    }


def _build_headers(result, etag, request_start):
    """Build response headers with caching, pagination, and diagnostics."""
    oldest, newest = result["date_range"]
    elapsed_ms = int((time.time() - request_start) * 1000)

    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
        "ETag": etag,
        "X-Total-Count": str(result["total_records"]),
        "X-Total-Dates": str(result["total_dates"]),
        "X-Dates-Returned": str(result["dates_returned"]),
        "X-Offset": str(result["offset"]),
        "X-Limit": str(result["limit"]),
        "X-Response-Time": f"{elapsed_ms}ms",
    }

    if oldest and newest:
        headers["X-Date-Range"] = f"{oldest}/{newest}"

    return headers


def _error_response(status_code, message):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
        },
        "body": json.dumps({"error": message}),
    }
