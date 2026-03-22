variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "stocks-pipeline"
}

variable "stock_api_key" {
  description = "API key for stock data provider"
  type        = string
  sensitive   = true
}

variable "stock_tickers" {
  description = "Comma-separated list of stock tickers to track"
  type        = string
  default     = "AAPL,MSFT,GOOGL,AMZN,TSLA,NVDA"
}
