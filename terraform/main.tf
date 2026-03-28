module "dynamodb" {
  source       = "./modules/dynamodb"
  project_name = var.project_name
}

module "ingestion_lambda" {
  source          = "./modules/ingestion_lambda"
  project_name    = var.project_name
  dynamodb_table  = module.dynamodb.table_name
  dynamodb_arn    = module.dynamodb.table_arn
  stock_api_key = var.stock_api_key
  stock_tickers   = var.stock_tickers
}

module "api_lambda" {
  source         = "./modules/api_lambda"
  project_name   = var.project_name
  dynamodb_table = module.dynamodb.table_name
  dynamodb_arn   = module.dynamodb.table_arn
}

module "frontend" {
  source       = "./modules/frontend"
  project_name = var.project_name
}

module "monitoring" {
  source                  = "./modules/monitoring"
  project_name            = var.project_name
  ingestion_function_name = module.ingestion_lambda.function_name
  api_function_name       = module.api_lambda.function_name
  api_gateway_id          = module.api_lambda.api_gateway_id
  dynamodb_table_name     = module.dynamodb.table_name
}
