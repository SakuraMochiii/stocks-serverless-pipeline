terraform {
  backend "s3" {
    bucket = "stocks-pipeline-tfstate-v2"
    key    = "terraform.tfstate"
    region = "us-west-2"
  }
}
