terraform {
  backend "s3" {
    bucket = "stocks-pipeline-tfstate"
    key    = "terraform.tfstate"
    region = "us-east-1"
  }
}
