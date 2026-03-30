#!/bin/bash

# Deployment script for process-transcript Edge Function
# This script handles the deployment to Supabase production environment

set -e

echo "🚀 Starting deployment of process-transcript Edge Function..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first."
    echo "Visit: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please run: supabase login"
    exit 1
fi

# Configuration
FUNCTION_NAME="process-transcript"
PROJECT_ID="${SUPABASE_PROJECT_ID}"

if [ -z "$PROJECT_ID" ]; then
    echo "❌ SUPABASE_PROJECT_ID environment variable is not set"
    echo "Please set it in your .env file or export it"
    exit 1
fi

echo "📦 Validating function structure..."

# Check if function directory exists
if [ ! -d "supabase/functions/$FUNCTION_NAME" ]; then
    echo "❌ Function directory not found: supabase/functions/$FUNCTION_NAME"
    exit 1
fi

# Check for required files
REQUIRED_FILES=(
    "index.ts"
    "openai-client.ts"
    "document-generator.ts"
    "database-service.ts"
    "monitoring-logger.ts"
    "performance-optimizer.ts"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "supabase/functions/$FUNCTION_NAME/$file" ]; then
        echo "❌ Required file not found: $file"
        exit 1
    fi
done

echo "✅ Function structure validated"

# Set environment variables
echo "🔐 Setting environment variables..."

# These should be set in Supabase dashboard for production
REQUIRED_SECRETS=(
    "OPENAI_API_KEY"
    "OPENAI_ORGANIZATION_ID"
)

echo "⚠️  Please ensure the following secrets are set in Supabase dashboard:"
for secret in "${REQUIRED_SECRETS[@]}"; do
    echo "   - $secret"
done

# Deploy the function
echo "🚢 Deploying function to Supabase..."

supabase functions deploy $FUNCTION_NAME \
    --project-ref $PROJECT_ID \
    --no-verify-jwt

if [ $? -eq 0 ]; then
    echo "✅ Function deployed successfully!"
else
    echo "❌ Deployment failed"
    exit 1
fi

# Get function URL
FUNCTION_URL="https://$PROJECT_ID.supabase.co/functions/v1/$FUNCTION_NAME"
echo ""
echo "🎉 Deployment complete!"
echo "📍 Function URL: $FUNCTION_URL"
echo ""
echo "📝 Next steps:"
echo "1. Test the function with the test script: ./test-deployment.sh"
echo "2. Monitor logs: supabase functions logs $FUNCTION_NAME --project-ref $PROJECT_ID"
echo "3. Update frontend environment variables with the function URL"
echo ""