#!/usr/bin/env bash
set -euo pipefail

# Usage: bash scripts/deploy_frontend.sh <api_url> <s3_bucket>

API_URL="${1:?Usage: deploy_frontend.sh <api_url> <s3_bucket>}"
S3_BUCKET="${2:?Usage: deploy_frontend.sh <api_url> <s3_bucket>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")/frontend"

echo "Deploying frontend to s3://${S3_BUCKET}..."

# Inject API URL into app.js
sed "s|__API_URL__|${API_URL}|g" "${FRONTEND_DIR}/app.js" > "${FRONTEND_DIR}/app.deploy.js"

# Sync to S3
aws s3 sync "$FRONTEND_DIR" "s3://${S3_BUCKET}" \
  --exclude "app.js" \
  --exclude "app.deploy.js" \
  --delete

# Upload the injected app.js
aws s3 cp "${FRONTEND_DIR}/app.deploy.js" "s3://${S3_BUCKET}/app.js" \
  --content-type "application/javascript"

# Cleanup
rm -f "${FRONTEND_DIR}/app.deploy.js"

echo "Frontend deployed to: http://${S3_BUCKET}.s3-website-us-west-2.amazonaws.com"
