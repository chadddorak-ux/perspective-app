#!/usr/bin/env bash
# Static privacy guards for LittleThings.ai. Fails if forbidden APIs or SDKs appear in
# product code. Run locally or in CI: ./scripts/privacy-guards.sh
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
check() {
  local description="$1" pattern="$2"; shift 2
  local hits status=0
  hits=$(grep -rnE "$pattern" "$@" --include='*.swift') || status=$?
  if [ "$status" -gt 1 ]; then echo "ERROR: grep failed for: $description"; exit 2; fi
  hits=$(printf '%s' "$hits" | grep -v 'privacy-guards: allow' || true)
  if [ -n "$hits" ]; then
    echo "FAIL: $description"
    echo "$hits"
    fail=1
  else
    echo "ok:   $description"
  fi
}

# No cloud model fallback, including Apple's server-side Private Cloud Compute model.
check "no Private Cloud Compute / remote model APIs" 'PrivateCloudCompute|api\.openai|anthropic\.com|generativelanguage' Sources App
# No analytics, crash reporting or advertising SDKs.
check "no analytics/crash/ads SDKs" 'import (Firebase|FirebaseAnalytics|Crashlytics|Sentry|Mixpanel|Amplitude|Segment|AppCenter|Bugsnag|GoogleMobileAds|FBSDK)' Sources App
# The core vault and inference require no network.
check "no networking in core modules" 'URLSession|URLRequest|NWConnection|CFNetwork' Sources
# No logging that could leak record contents.
check "no print/NSLog/os_log in product code" '(^|[^A-Za-z_.])(print|NSLog|debugPrint|os_log)\(' Sources App/LittleThings App/ShareExtension
# Keychain items must be device-only and never synchronized.
check "no weak or synchronized Keychain items" 'kSecAttrAccessibleAlways|kSecAttrAccessibleAfterFirstUnlock[^T]|kSecAttrSynchronizable as String: true' App Sources
# No raw card or CVV fields.
check "no raw card number or CVV handling" '[Cc]ardNumber|[Cc][Vv][Vv]|[Cc][Vv][Cc]2?\b|securityCode' Sources App

exit $fail
