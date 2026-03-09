#!/usr/bin/env bash
set -euo pipefail

# Usage: bash scripts/build_lambdas.sh <ingestion|api>

LAMBDA_NAME="${1:?Usage: build_lambdas.sh <ingestion|api>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LAMBDA_DIR="${PROJECT_ROOT}/lambdas/${LAMBDA_NAME}"
ZIP_FILE="${LAMBDA_DIR}/${LAMBDA_NAME}.zip"

if [ ! -d "$LAMBDA_DIR" ]; then
  echo "Error: Lambda directory not found: $LAMBDA_DIR"
  exit 1
fi

echo "Building ${LAMBDA_NAME} Lambda..."

# Clean previous build
rm -rf "${LAMBDA_DIR}/package" "$ZIP_FILE"

# Install dependencies if requirements.txt exists
if [ -f "${LAMBDA_DIR}/requirements.txt" ]; then
  echo "Installing dependencies..."
  pip install -q -t "${LAMBDA_DIR}/package" -r "${LAMBDA_DIR}/requirements.txt"
  cd "${LAMBDA_DIR}/package"
  zip -q -r "$ZIP_FILE" .
  cd "$LAMBDA_DIR"
  zip -q -g "$ZIP_FILE" *.py
else
  cd "$LAMBDA_DIR"
  zip -q "$ZIP_FILE" *.py
fi

echo "Built: ${ZIP_FILE} ($(du -h "$ZIP_FILE" | cut -f1))"
