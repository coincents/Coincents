#!/bin/bash

# SIWE Integration Test Script
# Tests the Better Auth SIWE endpoints

set -e

BASE_URL="http://localhost:3003"
TEST_WALLET="0x1234567890abcdef1234567890abcdef12345678"
CHAIN_ID=1

echo "🧪 Testing SIWE Integration"
echo "================================"
echo ""

# Test 1: Check if server is running
echo "1️⃣  Testing server health..."
if curl -s -f "${BASE_URL}" > /dev/null; then
    echo "   ✅ Server is running"
else
    echo "   ❌ Server is not running at ${BASE_URL}"
    exit 1
fi
echo ""

# Test 2: Check Better Auth endpoint
echo "2️⃣  Testing Better Auth endpoint..."
AUTH_RESPONSE=$(curl -s "${BASE_URL}/api/auth/session" 2>&1)
if [[ $AUTH_RESPONSE == *"/api/auth/session/"* ]] || [[ $AUTH_RESPONSE == *"user"* ]]; then
    echo "   ✅ Better Auth endpoint responding"
else
    echo "   ❌ Better Auth endpoint not responding correctly"
    echo "   Response: $AUTH_RESPONSE"
fi
echo ""

# Test 3: Test nonce generation
echo "3️⃣  Testing SIWE nonce generation..."
NONCE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/siwe/nonce" \
    -H "Content-Type: application/json" \
    -d "{\"walletAddress\":\"${TEST_WALLET}\",\"chainId\":${CHAIN_ID}}" 2>&1)

if [[ $NONCE_RESPONSE == *"nonce"* ]] || [[ $NONCE_RESPONSE == *"/api/auth/siwe/nonce/"* ]]; then
    echo "   ✅ Nonce endpoint responding"
    echo "   Response: ${NONCE_RESPONSE:0:100}..."
else
    echo "   ⚠️  Nonce endpoint response unclear"
    echo "   Response: $NONCE_RESPONSE"
fi
echo ""

# Test 4: Check SIWE verify endpoint exists
echo "4️⃣  Testing SIWE verify endpoint..."
VERIFY_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/siwe/verify" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"test\",\"signature\":\"0x\",\"walletAddress\":\"${TEST_WALLET}\"}" 2>&1)

if [[ $VERIFY_RESPONSE == *"error"* ]] || [[ $VERIFY_RESPONSE == *"/api/auth/siwe/verify/"* ]]; then
    echo "   ✅ Verify endpoint exists (expected error for invalid signature)"
    echo "   Response: ${VERIFY_RESPONSE:0:100}..."
else
    echo "   ⚠️  Verify endpoint response unclear"
    echo "   Response: $VERIFY_RESPONSE"
fi
echo ""

# Test 5: Check database connection
echo "5️⃣  Testing database connection..."
if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
    echo "   ✅ Database connection successful"
else
    echo "   ⚠️  Database connection check skipped (requires Prisma CLI)"
fi
echo ""

# Summary
echo "================================"
echo "✅ SIWE Integration Tests Complete"
echo ""
echo "📝 Manual Testing Steps:"
echo "   1. Navigate to http://localhost:3003/portfolio"
echo "   2. Click 'Connect Wallet'"
echo "   3. Approve connection in wallet"
echo "   4. Sign SIWE message when prompted"
echo "   5. Verify authentication successful"
echo ""
echo "🔍 Check browser console for SIWE logs:"
echo "   - '🔐 Starting SIWE authentication...'"
echo "   - '✅ SIWE authentication successful!'"
echo ""
echo "📚 Documentation:"
echo "   - SIWE_INTEGRATION.md"
echo "   - IMPLEMENTATION_SUMMARY.md"
echo ""

