# Stocks Serverless Pipeline

Fully automated serverless pipeline that analyzes 6 tech stocks (AAPL, MSFT, GOOGL, AMZN, TSLA, NVDA) daily, records the top mover (highest absolute % change), and displays history on a public website.

## Architecture

```
EventBridge (cron) → Ingestion Lambda → DynamoDB
                                            ↑
Frontend (S3) → API Gateway → API Lambda ───┘
```

**Components:**
- **Ingestion Lambda** — Triggered daily at 10 PM UTC. Fetches stock data from Polygon.io, finds the top mover, writes to DynamoDB.
- **API Lambda** — Serves `GET /movers` via API Gateway. Returns the last 7 days of top movers as JSON.
- **DynamoDB** — Stores top mover records with `date` as partition key. PAY_PER_REQUEST billing.
- **Frontend** — Vanilla HTML/CSS/JS SPA hosted on S3. Dark theme with green/red color coding for gains/losses.
- **Terraform** — All infrastructure defined as code with 4 modules (dynamodb, ingestion_lambda, api_lambda, frontend).

## Prerequisites

- AWS account with an IAM role configured for GitHub Actions OIDC
- [Polygon.io](https://polygon.io/) free tier API key
- Terraform >= 1.5
- AWS CLI v2
- S3 bucket for Terraform state (`stocks-pipeline-tfstate`)

## GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AWS_ROLE_ARN` | ARN of the IAM role for GitHub Actions OIDC |
| `POLYGON_API_KEY` | Polygon.io API key |

## Local Development

### Build Lambda zips
```bash
bash scripts/build_lambdas.sh ingestion
bash scripts/build_lambdas.sh api
```

### Deploy infrastructure
```bash
cd terraform
terraform init
terraform plan -var="polygon_api_key=YOUR_KEY"
terraform apply -var="polygon_api_key=YOUR_KEY"
```

### Deploy frontend
```bash
API_URL=$(cd terraform && terraform output -raw api_gateway_url)
BUCKET=$(cd terraform && terraform output -raw frontend_url | sed 's|http://||' | sed 's|.s3-website.*||')
bash scripts/deploy_frontend.sh "$API_URL" "$BUCKET"
```

### Test the API
```bash
curl "$(cd terraform && terraform output -raw api_gateway_url)/movers"
```

## CI/CD

- **Deploy** (`deploy.yml`) — Triggers on push to `main`. Builds lambdas, deploys Terraform, syncs frontend to S3.
- **Destroy** (`destroy.yml`) — Manual workflow dispatch. Tears down all infrastructure.

Both workflows use OIDC authentication — no AWS access keys stored in the repository.

## Security

- Least-privilege IAM: Ingestion Lambda can only `PutItem`, API Lambda can only `Scan`/`Query`
- API key passed via Terraform variable from CI secrets, never committed
- S3 frontend bucket allows public read only (no write/list)
- CORS configured on API Gateway to allow browser access

## Stocks Tracked

| Ticker | Company |
|--------|---------|
| AAPL | Apple |
| MSFT | Microsoft |
| GOOGL | Alphabet (Google) |
| AMZN | Amazon |
| TSLA | Tesla |
| NVDA | NVIDIA |
