resource "aws_dynamodb_table" "top_movers" {
  name         = "${var.project_name}-top-movers"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "date"

  attribute {
    name = "date"
    type = "S"
  }

  tags = {
    Project = var.project_name
  }
}
