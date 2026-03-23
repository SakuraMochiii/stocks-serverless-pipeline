terraform {
  backend "s3" {
    bucket = "stocks-pipeline-tfstate"
    key    = "terraform.tfstate"
    region = "us-west-2"
  }
}
