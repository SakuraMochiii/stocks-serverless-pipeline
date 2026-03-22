import json
import os

from dynamodb_reader import get_movers


def lambda_handler(event, context):
    table_name = os.environ["DYNAMODB_TABLE"]

    # Parse optional limit from query string
    limit = 7
    params = event.get("queryStringParameters") or {}
    if "limit" in params:
        try:
            limit = max(1, min(int(params["limit"]), 30))
        except ValueError:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "Invalid limit parameter"}),
            }

    try:
        movers = get_movers(table_name, limit)
    except Exception as e:
        print(f"Failed to read from DynamoDB: {e}")
        return {
            "statusCode": 502,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"error": "Failed to retrieve data"}),
        }

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(movers),
    }
