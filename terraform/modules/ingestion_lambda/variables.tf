variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "dynamodb_table" {
  description = "Name of the DynamoDB table"
  type        = string
}

variable "dynamodb_arn" {
  description = "ARN of the DynamoDB table"
  type        = string
}

variable "polygon_api_key" {
  description = "Polygon.io API key"
  type        = string
  sensitive   = true
}

variable "stock_tickers" {
  description = "Comma-separated list of stock tickers"
  type        = string
}
