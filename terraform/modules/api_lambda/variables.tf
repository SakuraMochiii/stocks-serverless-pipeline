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
