#!/bin/bash
# Verify CliniFunnel deploy is working
URL="https://clinifunnel.koaai.com.br"
ERRORS=""

# Wait for deploy to finish (GitHub Actions takes ~2min)
sleep 10

# 1. Check site accessible
STATUS=$(curl -sk -o /dev/null -w "%{http_code}" "$URL/login" 2>/dev/null)
if [ "$STATUS" != "200" ]; then
  ERRORS="$ERRORS\n- Login page returned HTTP $STATUS (expected 200)"
fi

# 2. Check API responds
API_STATUS=$(curl -sk -o /dev/null -w "%{http_code}" "$URL/api/auth/session" 2>/dev/null)
if [ "$API_STATUS" != "200" ]; then
  ERRORS="$ERRORS\n- API session returned HTTP $API_STATUS (expected 200)"
fi

# 3. Check version endpoint or homepage HTML contains CliniFunnel
BODY=$(curl -sk "$URL/login" 2>/dev/null)
if ! echo "$BODY" | grep -q "CliniFunnel"; then
  ERRORS="$ERRORS\n- Login page does not contain 'CliniFunnel' text"
fi

if [ -n "$ERRORS" ]; then
  echo "{\"continue\": true, \"hookSpecificOutput\": {\"hookEventName\": \"PostToolUse\", \"additionalContext\": \"DEPLOY VERIFICATION FAILED:$ERRORS\"}}"
else
  echo "{\"continue\": true, \"hookSpecificOutput\": {\"hookEventName\": \"PostToolUse\", \"additionalContext\": \"DEPLOY VERIFIED OK: site acessivel (HTTP 200), API respondendo, HTML correto.\"}}"
fi
