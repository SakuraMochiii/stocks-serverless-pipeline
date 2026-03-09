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
            limit = min(int(params["limit"]), 30)
        except ValueError:
            pass

    movers = get_movers(table_name, limit)

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(movers),
    }
