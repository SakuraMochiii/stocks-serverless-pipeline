# IAM role for ingestion Lambda
resource "aws_iam_role" "ingestion" {
  name = "${var.project_name}-ingestion-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = {
    Project = var.project_name
  }
}

resource "aws_iam_role_policy" "ingestion_dynamodb" {
  name = "${var.project_name}-ingestion-dynamodb"
  role = aws_iam_role.ingestion.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem", "dynamodb:BatchWriteItem"]
      Resource = var.dynamodb_arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ingestion_logs" {
  role       = aws_iam_role.ingestion.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda function
resource "aws_lambda_function" "ingestion" {
  function_name = "${var.project_name}-ingestion"
  role          = aws_iam_role.ingestion.arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.12"
  timeout       = 300
  memory_size   = 128

  filename         = "${path.module}/../../../lambdas/ingestion/ingestion.zip"
  source_code_hash = filebase64sha256("${path.module}/../../../lambdas/ingestion/ingestion.zip")

  environment {
    variables = {
      DYNAMODB_TABLE  = var.dynamodb_table
      STOCK_API_KEY = var.stock_api_key
      STOCK_TICKERS   = var.stock_tickers
    }
  }

  tags = {
    Project = var.project_name
  }
}

# EventBridge rule — daily at 10 PM UTC (after US market close)
resource "aws_cloudwatch_event_rule" "daily_ingestion" {
  name                = "${var.project_name}-daily-ingestion"
  description         = "Trigger stock ingestion Lambda daily"
  schedule_expression = "cron(0 22 * * ? *)"

  tags = {
    Project = var.project_name
  }
}

resource "aws_cloudwatch_event_target" "ingestion_target" {
  rule = aws_cloudwatch_event_rule.daily_ingestion.name
  arn  = aws_lambda_function.ingestion.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ingestion.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_ingestion.arn
}
