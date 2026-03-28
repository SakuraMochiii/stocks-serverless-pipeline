output "sns_topic_arn" {
  description = "ARN of the SNS alerts topic"
  value       = aws_sns_topic.alerts.arn
}

output "ingestion_log_group" {
  description = "Name of the ingestion Lambda log group"
  value       = aws_cloudwatch_log_group.ingestion.name
}

output "api_log_group" {
  description = "Name of the API Lambda log group"
  value       = aws_cloudwatch_log_group.api.name
}
