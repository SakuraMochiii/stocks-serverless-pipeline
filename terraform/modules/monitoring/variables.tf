variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "ingestion_function_name" {
  description = "Name of the ingestion Lambda function"
  type        = string
}

variable "api_function_name" {
  description = "Name of the API Lambda function"
  type        = string
}

variable "api_gateway_id" {
  description = "ID of the API Gateway"
  type        = string
}

variable "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  type        = string
}
