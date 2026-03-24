resource "aws_dynamodb_table" "top_movers" {
  name         = "${var.project_name}-top-movers"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "date"
  range_key    = "ticker"

  attribute {
    name = "date"
    type = "S"
  }

  attribute {
    name = "ticker"
    type = "S"
  }

  tags = {
    Project = var.project_name
  }
}
