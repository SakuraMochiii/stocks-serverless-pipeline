# Stocks Serverless Pipeline

Fully automated serverless pipeline that analyzes 6 tech stocks (AAPL, MSFT, GOOGL, AMZN, TSLA, NVDA) daily, records the top mover (highest absolute % change), and displays history on a public website.

## Architecture

```
EventBridge (cron) → Ingestion Lambda → DynamoDB
                                            ↑
Frontend (S3) → API Gateway → API Lambda ───┘
```

**Components:**
- **Ingestion Lambda** — Triggered daily at 10 PM UTC. Fetches stock data from a free stock API, finds the top mover, writes to DynamoDB.
- **API Lambda** — Serves `GET /movers` via API Gateway. Returns the last 7 days of top movers as JSON.
- **DynamoDB** — Stores top mover records with `date` as partition key. PAY_PER_REQUEST billing.
- **Frontend** — Vanilla HTML/CSS/JS SPA hosted on S3. Dark theme with green/red color coding for gains/losses.
- **Terraform** — All infrastructure defined as code with 5 modules (dynamodb, ingestion_lambda, api_lambda, frontend, monitoring).

## How It Works

### Data Flow

1. Every night at 10 PM UTC, an **EventBridge** cron rule triggers the **Ingestion Lambda**.
2. The Lambda fetches the daily open/close prices for each stock in the watchlist from a free stock API.
3. For each stock, it calculates the percentage change: `((Close - Open) / Open) × 100`.
4. The stock with the highest **absolute** % change (biggest move up or down) is selected as the day's top mover.
5. The winner is written to **DynamoDB** with the date, ticker symbol, percent change, open price, and close price.
6. When a user visits the frontend, the browser calls `GET /movers` on **API Gateway**.
7. API Gateway invokes the **API Lambda**, which scans DynamoDB for the last 7 days of top movers and returns them as JSON.
8. The **frontend** renders the results in a table with green/red color coding for gains/losses.

### Project Structure

```
├── .github/workflows/       # CI/CD pipelines (deploy + destroy)
├── frontend/                 # S3-hosted SPA (HTML/CSS/JS)
│   ├── index.html            # Page structure with chart + dashboard layout
│   ├── style.css             # Dark theme, green/red color coding, animations
│   └── app.js                # Fetches API, renders charts, tables, and market pulse
├── lambdas/
│   ├── ingestion/            # Daily cron Lambda
│   │   ├── handler.py        # Entry point — loops tickers, picks winner, writes to DB
│   │   ├── stock_client.py   # Fetches open/close data with retry + backoff
│   │   └── dynamodb_writer.py# Writes top mover record to DynamoDB
│   └── api/                  # REST API Lambda
│       ├── handler.py        # Entry point — caching, pagination, custom headers
│       └── dynamodb_reader.py# Scans DynamoDB, sorts by date, returns paginated records
├── scripts/
│   ├── build_lambdas.sh      # Packages Lambda code into zip files
│   └── deploy_frontend.sh    # Injects API URL into app.js and syncs to S3
└── terraform/                # Infrastructure as Code
    ├── main.tf               # Root module wiring
    ├── variables.tf          # Input variables (API key, project name)
    ├── outputs.tf            # Exported values (API URL, frontend URL, SNS ARN)
    ├── providers.tf          # AWS provider config
    ├── backend.tf            # S3 remote state
    └── modules/
        ├── dynamodb/         # DynamoDB table (PAY_PER_REQUEST)
        ├── ingestion_lambda/ # Lambda + EventBridge cron + IAM (PutItem only)
        ├── api_lambda/       # Lambda + API Gateway + access logging + IAM
        ├── frontend/         # S3 bucket with static website hosting
        └── monitoring/       # CloudWatch log groups, metric alarms, SNS alerts
```

## Prerequisites

- AWS account with an IAM role configured for GitHub Actions OIDC
- Free stock API key (stored in `.env` locally, GitHub Secrets for CI/CD)
- Terraform >= 1.5
- AWS CLI v2
- S3 bucket for Terraform state (`stocks-pipeline-tfstate`)

## GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AWS_ROLE_ARN` | ARN of the IAM role for GitHub Actions OIDC |
| `STOCK_API_KEY` | Stock data API key |

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
terraform plan -var="stock_api_key=YOUR_KEY"
terraform apply -var="stock_api_key=YOUR_KEY"
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

## API Features

The `GET /movers` endpoint supports:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `limit` | 7 | Number of trading days to return (1-30) |
| `offset` | 0 | Skip N most recent days (for pagination) |

**Response headers:**

| Header | Description |
|--------|-------------|
| `Cache-Control` | 5-minute public cache with stale-while-revalidate |
| `ETag` | Content hash for conditional requests (If-None-Match) |
| `X-Total-Count` | Total records in the database |
| `X-Total-Dates` | Total unique trading dates available |
| `X-Date-Range` | Oldest/newest date in the dataset |
| `X-Response-Time` | Server-side processing time |

Supports **304 Not Modified** responses when the client sends a matching `If-None-Match` header.

## Monitoring & Alerts

The monitoring module provides:

- **CloudWatch Log Groups** with 14-day retention for both Lambdas and API Gateway access logs
- **CloudWatch Metric Alarms**:
  - Ingestion Lambda errors (any error triggers alarm)
  - Ingestion Lambda duration (alert if approaching 300s timeout)
  - API Lambda errors (> 5 errors in 5 minutes)
  - API Lambda throttles (any throttle triggers alarm)
  - API Gateway 5xx errors (> 5 in 5 minutes)
  - DynamoDB throttled requests
- **SNS Topic** for alert notifications (subscribe an email to receive alerts)

## Frontend Features

- **Market Pulse Dashboard** — Real-time sentiment (bulls vs bears), average volatility, and top mover streak tracking
- **Interactive Bar Chart** — Canvas-rendered daily performance chart with navigation between dates, glow effects on the top mover
- **Inline Sparkline Bars** — Each table row shows a proportional bar indicating relative move magnitude
- **Hover Tooltips** — Mouse over any stock row to see dollar-amount move and price range
- **Streak Badges** — Highlights when a stock has been the top mover for consecutive days
- **Staggered Animations** — Day cards fade in with staggered timing for a polished feel

## Trade-offs & Notes

- **Rate limiting**: The free stock API tier has request limits. The ingestion Lambda adds a 13-second delay between ticker fetches to stay within bounds, with exponential backoff retries on 429 responses.
- **Weekend/holiday handling**: If no trading data exists for the current date, the ingestion function falls back to the most recent trading day (up to 5 days back).
- **DynamoDB scan**: The API Lambda uses a `Scan` operation which is fine at this scale (7-30 records). For larger datasets, a `Query` with a GSI on date would be more efficient.
- **Lambda timeout**: Ingestion Lambda has a 300-second timeout to accommodate rate-limiting delays across 6 tickers.
- **Caching strategy**: API responses are cached for 5 minutes with `stale-while-revalidate`, balancing freshness with performance. ETag support enables conditional requests to reduce bandwidth.
