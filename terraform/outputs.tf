output "api_gateway_url" {
  description = "URL of the API Gateway endpoint"
  value       = module.api_lambda.api_gateway_url
}

output "frontend_url" {
  description = "URL of the S3 static website"
  value       = module.frontend.website_url
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  value       = module.dynamodb.table_name
}
