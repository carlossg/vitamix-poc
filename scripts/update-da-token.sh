#!/usr/bin/env bash
set -euo pipefail

# Test DA credentials and update the DA_TOKEN secret in Google Cloud Secret Manager.
#
# Flow:
#   1. Load DA_TOKEN from .env (or --token)
#   2. Test the token against da.live (create, verify, preview, publish, cleanup)
#   3. If tests pass, update the secret in GCP Secret Manager
#   4. Optionally restart the Cloud Run service
#
# Usage:
#   ./scripts/update-da-token.sh                         # test + update from .env
#   ./scripts/update-da-token.sh --env-file path/.env    # custom env file
#   ./scripts/update-da-token.sh --token "eyJ..."         # pass token directly
#   ./scripts/update-da-token.sh --test-only              # only test, don't update GCP
#   ./scripts/update-da-token.sh --skip-test              # skip test, update directly
#   ./scripts/update-da-token.sh --restart                # restart Cloud Run after update

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Defaults ---
ENV_FILE=""
DIRECT_TOKEN=""
SKIP_CLEANUP=false
TEST_ONLY=false
SKIP_TEST=false
RESTART=false
VERBOSE=false
PROJECT_ID=""
SERVICE_NAME="vitamix-recommender"
REGION="us-central1"

DA_ADMIN_URL="https://admin.da.live"
AEM_ADMIN_URL="https://admin.hlx.page"
IMS_TOKEN_ENDPOINT="https://ims-na1.adobelogin.com/ims/token/v3"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# --- Helpers ---
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()    { echo -e "${RED}[FAIL]${NC}  $*"; }
fail_exit() { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }
step()    { echo -e "\n${CYAN}── $* ──${NC}"; }
debug()   { $VERBOSE && echo -e "${BLUE}[DEBUG]${NC} $*" || true; }

usage() {
	cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Test DA credentials and update DA_TOKEN in Google Cloud Secret Manager.

Options:
  --env-file <path>      Load environment from file (default: .env in project root)
  --token <token>        Use a direct bearer token (skip reading from .env)
  --test-only            Only test credentials, don't update Secret Manager
  --skip-test            Skip credential test, update Secret Manager directly
  --skip-cleanup         Don't delete the test page after creation
  --project <id>         GCP project ID (default: current gcloud config)
  --service <name>       Cloud Run service name (default: vitamix-recommender)
  --region <region>      Cloud Run region (default: us-central1)
  --restart              Restart the Cloud Run service after updating
  --verbose              Show detailed request/response info
  -h, --help             Show this help

Environment Variables (set directly or via .env):
  DA_ORG                 DA organization (e.g. carlossg)
  DA_REPO                DA repository (e.g. vitamix-poc)
  DA_TOKEN               Static bearer token
  DA_CLIENT_ID           Adobe IMS client ID (S2S)
  DA_CLIENT_SECRET       Adobe IMS client secret (S2S)
  DA_SERVICE_TOKEN       Adobe IMS service token (S2S)

Examples:
  # Test token from .env, then update GCP secret
  ./scripts/update-da-token.sh

  # Only test credentials (no GCP update)
  ./scripts/update-da-token.sh --test-only

  # Skip test and just push to GCP
  ./scripts/update-da-token.sh --skip-test

  # Update and restart Cloud Run
  ./scripts/update-da-token.sh --restart

  # Test with explicit token
  ./scripts/update-da-token.sh --token eyJ... --test-only --verbose
EOF
	exit 0
}

# --- Parse Args ---
while [[ $# -gt 0 ]]; do
	case "$1" in
		--env-file)      ENV_FILE="$2"; shift 2 ;;
		--token)         DIRECT_TOKEN="$2"; shift 2 ;;
		--test-only)     TEST_ONLY=true; shift ;;
		--skip-test)     SKIP_TEST=true; shift ;;
		--skip-cleanup)  SKIP_CLEANUP=true; shift ;;
		--project)       PROJECT_ID="$2"; shift 2 ;;
		--service)       SERVICE_NAME="$2"; shift 2 ;;
		--region)        REGION="$2"; shift 2 ;;
		--restart)       RESTART=true; shift ;;
		--verbose)       VERBOSE=true; shift ;;
		-h|--help)       usage ;;
		*) echo "Unknown option: $1"; usage ;;
	esac
done

if $TEST_ONLY && $SKIP_TEST; then
	fail_exit "--test-only and --skip-test are mutually exclusive"
fi

# --- Load .env ---
load_env_file() {
	local file="$1"
	if [[ ! -f "$file" ]]; then
		warn "Env file not found: $file"
		return 1
	fi
	info "Loading env from: $file"
	while IFS='=' read -r key value; do
		key=$(echo "$key" | xargs)
		[[ -z "$key" || "$key" == \#* ]] && continue
		value=$(echo "$value" | xargs | sed -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//')
		if [[ -z "${!key:-}" ]]; then
			export "$key=$value"
			debug "Set $key from env file"
		else
			debug "Skipping $key (already set in environment)"
		fi
	done < "$file"
}

if [[ -n "$ENV_FILE" ]]; then
	load_env_file "$ENV_FILE" || exit 1
elif [[ -f "$PROJECT_ROOT/.env" ]]; then
	load_env_file "$PROJECT_ROOT/.env" || true
fi

# --- Validate Config ---
step "Checking configuration"

DA_ORG="${DA_ORG:-}"
DA_REPO="${DA_REPO:-}"
DA_CLIENT_ID="${DA_CLIENT_ID:-}"
DA_CLIENT_SECRET="${DA_CLIENT_SECRET:-}"
DA_SERVICE_TOKEN="${DA_SERVICE_TOKEN:-}"
DA_TOKEN="${DA_TOKEN:-}"

HAS_S2S=false
HAS_LEGACY=false
HAS_DIRECT=false

if [[ -n "$DIRECT_TOKEN" ]]; then
	HAS_DIRECT=true
	ok "Direct token provided (${#DIRECT_TOKEN} chars)"
fi

if [[ -n "$DA_CLIENT_ID" && -n "$DA_CLIENT_SECRET" && -n "$DA_SERVICE_TOKEN" ]]; then
	HAS_S2S=true
	ok "S2S credentials found (client_id: ${DA_CLIENT_ID:0:8}...)"
fi

if [[ -n "$DA_TOKEN" ]]; then
	HAS_LEGACY=true
	ok "DA_TOKEN found (${#DA_TOKEN} chars)"
fi

if ! $HAS_DIRECT && ! $HAS_S2S && ! $HAS_LEGACY; then
	fail "No credentials found. Provide one of:"
	echo "  - --token <bearer_token>"
	echo "  - DA_CLIENT_ID + DA_CLIENT_SECRET + DA_SERVICE_TOKEN (S2S)"
	echo "  - DA_TOKEN (static token)"
	exit 1
fi

if [[ -z "$DA_ORG" || -z "$DA_REPO" ]]; then
	fail "DA_ORG and DA_REPO are required"
	echo "  Current: DA_ORG='${DA_ORG}' DA_REPO='${DA_REPO}'"
	exit 1
fi

ok "Target: ${DA_ORG}/${DA_REPO}"

# --- Token Exchange ---
ACCESS_TOKEN=""

exchange_ims_token() {
	step "Exchanging IMS credentials for access token"
	info "Endpoint: $IMS_TOKEN_ENDPOINT"
	info "Client ID: ${DA_CLIENT_ID:0:8}..."

	local response http_code body
	response=$(curl -sS -w "\n%{http_code}" \
		-X POST "$IMS_TOKEN_ENDPOINT" \
		-H "Content-Type: application/x-www-form-urlencoded" \
		-d "grant_type=authorization_code&client_id=${DA_CLIENT_ID}&client_secret=${DA_CLIENT_SECRET}&code=${DA_SERVICE_TOKEN}")

	body=$(echo "$response" | sed '$d')
	http_code=$(echo "$response" | tail -1)

	debug "Response code: $http_code"
	$VERBOSE && debug "Response body: ${body:0:200}..."

	if [[ "$http_code" != "200" ]]; then
		fail "IMS token exchange failed (HTTP $http_code)"
		echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
		return 1
	fi

	ACCESS_TOKEN=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
	local expires_in
	expires_in=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('expires_in','unknown'))" 2>/dev/null)

	if [[ -z "$ACCESS_TOKEN" ]]; then
		fail "No access_token in IMS response"
		echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
		return 1
	fi

	ok "Access token obtained (${#ACCESS_TOKEN} chars, expires_in: ${expires_in}s)"
}

resolve_token() {
	if $HAS_DIRECT; then
		ACCESS_TOKEN="$DIRECT_TOKEN"
		info "Using direct token"
	elif $HAS_S2S; then
		exchange_ims_token || exit 1
	elif $HAS_LEGACY; then
		ACCESS_TOKEN="$DA_TOKEN"
		info "Using DA_TOKEN from env"
	fi
}

resolve_token

# =============================================
# PHASE 1: Test credentials
# =============================================

if ! $SKIP_TEST; then

	TEST_SLUG="credential-test-$(date +%s)"
	TEST_PATH="/test/${TEST_SLUG}"
	TEST_HTML='<!DOCTYPE html>
<html>
<head>
  <title>DA Credential Test</title>
  <meta name="description" content="Automated credential test page">
</head>
<body>
  <header></header>
  <main>
    <div>
      <h1>DA Credential Test</h1>
      <p>This page was created by update-da-token.sh to verify DA API access.</p>
      <p>Created: '"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'</p>
    </div>
  </main>
  <footer></footer>
</body>
</html>'

	RESULTS=()
	record() {
		local name="$1" status="$2"
		RESULTS+=("$name:$status")
	}

	# Test 1: Create page
	step "Test: Creating page"
	info "PUT ${DA_ADMIN_URL}/source/${DA_ORG}/${DA_REPO}${TEST_PATH}.html"

	BOUNDARY="----FormBoundary$(date +%s)"
	FORM_BODY=$(printf '%s\r\n' \
		"--${BOUNDARY}" \
		'Content-Disposition: form-data; name="data"; filename="index.html"' \
		'Content-Type: text/html' \
		'' \
		"${TEST_HTML}" \
		"--${BOUNDARY}--")

	CREATE_RESPONSE=$(curl -sS -w "\n%{http_code}" \
		-X PUT "${DA_ADMIN_URL}/source/${DA_ORG}/${DA_REPO}${TEST_PATH}.html" \
		-H "Authorization: Bearer ${ACCESS_TOKEN}" \
		-H "Content-Type: multipart/form-data; boundary=${BOUNDARY}" \
		--data-binary "$FORM_BODY")

	CREATE_BODY=$(echo "$CREATE_RESPONSE" | sed '$d')
	CREATE_CODE=$(echo "$CREATE_RESPONSE" | tail -1)
	debug "Response: $CREATE_CODE - ${CREATE_BODY:0:200}"

	if [[ "$CREATE_CODE" == "200" || "$CREATE_CODE" == "201" || "$CREATE_CODE" == "204" ]]; then
		ok "Page created (HTTP $CREATE_CODE)"
		record "create-page" "pass"
	elif [[ "$CREATE_CODE" == "401" ]]; then
		fail "Authentication failed (HTTP 401) — token is invalid or expired"
		record "create-page" "fail:auth"
	elif [[ "$CREATE_CODE" == "403" ]]; then
		fail "Authorization failed (HTTP 403) — token lacks write permission for ${DA_ORG}/${DA_REPO}"
		record "create-page" "fail:authz"
	else
		fail "Page creation failed (HTTP $CREATE_CODE)"
		echo "$CREATE_BODY"
		record "create-page" "fail:$CREATE_CODE"
	fi

	# Test 2: Verify page exists
	step "Test: Verifying page exists"
	info "HEAD ${DA_ADMIN_URL}/source/${DA_ORG}/${DA_REPO}${TEST_PATH}.html"

	HEAD_CODE=$(curl -sS -o /dev/null -w "%{http_code}" \
		-X HEAD "${DA_ADMIN_URL}/source/${DA_ORG}/${DA_REPO}${TEST_PATH}.html" \
		-H "Authorization: Bearer ${ACCESS_TOKEN}")

	if [[ "$HEAD_CODE" == "200" || "$HEAD_CODE" == "204" ]]; then
		ok "Page verified (HTTP $HEAD_CODE)"
		record "verify-page" "pass"
	else
		fail "Page not found (HTTP $HEAD_CODE)"
		record "verify-page" "fail:$HEAD_CODE"
	fi

	# Test 3: Trigger preview
	step "Test: Triggering AEM preview"
	PREVIEW_ENDPOINT="/preview/${DA_ORG}/${DA_REPO}/main${TEST_PATH}"
	info "POST ${AEM_ADMIN_URL}${PREVIEW_ENDPOINT}"

	PREVIEW_RESPONSE=$(curl -sS -w "\n%{http_code}" \
		-X POST "${AEM_ADMIN_URL}${PREVIEW_ENDPOINT}" \
		-H "Authorization: Bearer ${ACCESS_TOKEN}")

	PREVIEW_BODY=$(echo "$PREVIEW_RESPONSE" | sed '$d')
	PREVIEW_CODE=$(echo "$PREVIEW_RESPONSE" | tail -1)
	debug "Response: $PREVIEW_CODE - ${PREVIEW_BODY:0:200}"

	if [[ "$PREVIEW_CODE" == "200" || "$PREVIEW_CODE" == "204" ]]; then
		ok "Preview triggered (HTTP $PREVIEW_CODE)"
		info "Preview URL: https://main--${DA_REPO}--${DA_ORG}.aem.page${TEST_PATH}"
		record "preview" "pass"
	elif [[ "$PREVIEW_CODE" == "401" ]]; then
		fail "Preview auth failed (HTTP 401)"
		record "preview" "fail:auth"
	else
		warn "Preview returned HTTP $PREVIEW_CODE (may be expected for test paths)"
		echo "$PREVIEW_BODY"
		record "preview" "warn:$PREVIEW_CODE"
	fi

	# Test 4: Trigger publish
	step "Test: Triggering AEM publish"
	PUBLISH_ENDPOINT="/live/${DA_ORG}/${DA_REPO}/main${TEST_PATH}"
	info "POST ${AEM_ADMIN_URL}${PUBLISH_ENDPOINT}"

	PUBLISH_RESPONSE=$(curl -sS -w "\n%{http_code}" \
		-X POST "${AEM_ADMIN_URL}${PUBLISH_ENDPOINT}" \
		-H "Authorization: Bearer ${ACCESS_TOKEN}")

	PUBLISH_BODY=$(echo "$PUBLISH_RESPONSE" | sed '$d')
	PUBLISH_CODE=$(echo "$PUBLISH_RESPONSE" | tail -1)
	debug "Response: $PUBLISH_CODE - ${PUBLISH_BODY:0:200}"

	if [[ "$PUBLISH_CODE" == "200" || "$PUBLISH_CODE" == "204" ]]; then
		ok "Publish triggered (HTTP $PUBLISH_CODE)"
		info "Live URL: https://main--${DA_REPO}--${DA_ORG}.aem.live${TEST_PATH}"
		record "publish" "pass"
	elif [[ "$PUBLISH_CODE" == "401" ]]; then
		fail "Publish auth failed (HTTP 401)"
		record "publish" "fail:auth"
	else
		warn "Publish returned HTTP $PUBLISH_CODE (may be expected for test paths)"
		echo "$PUBLISH_BODY"
		record "publish" "warn:$PUBLISH_CODE"
	fi

	# Cleanup test page
	if $SKIP_CLEANUP; then
		step "Skipping cleanup (--skip-cleanup)"
		info "Test page at: ${DA_ADMIN_URL}/source/${DA_ORG}/${DA_REPO}${TEST_PATH}.html"
	else
		step "Cleaning up test page"
		info "DELETE ${DA_ADMIN_URL}/source/${DA_ORG}/${DA_REPO}${TEST_PATH}.html"

		DELETE_CODE=$(curl -sS -o /dev/null -w "%{http_code}" \
			-X DELETE "${DA_ADMIN_URL}/source/${DA_ORG}/${DA_REPO}${TEST_PATH}.html" \
			-H "Authorization: Bearer ${ACCESS_TOKEN}")

		if [[ "$DELETE_CODE" == "200" || "$DELETE_CODE" == "204" || "$DELETE_CODE" == "404" ]]; then
			ok "Test page cleaned up (HTTP $DELETE_CODE)"
			record "cleanup" "pass"
		else
			warn "Cleanup returned HTTP $DELETE_CODE"
			record "cleanup" "warn:$DELETE_CODE"
		fi
	fi

	# --- Test Summary ---
	step "Test Results"
	echo ""

	PASS=0
	FAIL=0
	WARN=0

	for result in "${RESULTS[@]}"; do
		name="${result%%:*}"
		status="${result#*:}"
		case "$status" in
			pass)
				echo -e "  ${GREEN}✓${NC} $name"
				((PASS++))
				;;
			fail*)
				echo -e "  ${RED}✗${NC} $name (${status#fail:})"
				((FAIL++))
				;;
			warn*)
				echo -e "  ${YELLOW}!${NC} $name (${status#warn:})"
				((WARN++))
				;;
		esac
	done

	echo ""
	echo -e "  Pass: ${GREEN}${PASS}${NC}  Fail: ${RED}${FAIL}${NC}  Warn: ${YELLOW}${WARN}${NC}"

	if [[ $FAIL -gt 0 ]]; then
		echo ""
		fail "Credential test FAILED — aborting Secret Manager update"
		echo ""
		echo "Troubleshooting:"
		echo "  - 401: Token expired or invalid. Refresh from https://da.live"
		echo "  - 403: Token valid but lacks permissions for ${DA_ORG}/${DA_REPO}"
		echo "  - Network: Check connectivity to admin.da.live and admin.hlx.page"
		echo ""
		exit 1
	fi

	ok "All credential tests passed"

fi # end !SKIP_TEST

# =============================================
# PHASE 2: Update GCP Secret Manager
# =============================================

if $TEST_ONLY; then
	echo ""
	info "Test-only mode — skipping Secret Manager update"
	exit 0
fi

step "Updating GCP Secret Manager"

# Resolve GCP project
if [[ -z "$PROJECT_ID" ]]; then
	PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
fi
if [[ -z "$PROJECT_ID" ]]; then
	fail_exit "No GCP project set. Use --project <id> or run: gcloud config set project <id>"
fi
info "Project: $PROJECT_ID"

# Sanity check
if [[ ${#ACCESS_TOKEN} -lt 100 ]]; then
	warn "Token looks unusually short (${#ACCESS_TOKEN} chars) — are you sure it's correct?"
fi

info "Updating DA_TOKEN secret..."

if gcloud secrets describe DA_TOKEN --project="$PROJECT_ID" &>/dev/null; then
	echo -n "$ACCESS_TOKEN" | gcloud secrets versions add DA_TOKEN \
		--data-file=- \
		--project="$PROJECT_ID"
	ok "New version of DA_TOKEN secret created"
else
	warn "DA_TOKEN secret doesn't exist yet, creating it..."
	echo -n "$ACCESS_TOKEN" | gcloud secrets create DA_TOKEN \
		--data-file=- \
		--labels=app=vitamix \
		--project="$PROJECT_ID"
	ok "DA_TOKEN secret created"
fi

LATEST=$(gcloud secrets versions list DA_TOKEN \
	--project="$PROJECT_ID" \
	--limit=1 \
	--format="value(name)" 2>/dev/null)
info "Latest version: $LATEST"

# --- Restart Cloud Run (optional) ---
if $RESTART; then
	step "Restarting Cloud Run"
	info "Service: $SERVICE_NAME (region: $REGION)"
	if gcloud run services describe "$SERVICE_NAME" \
		--region="$REGION" \
		--project="$PROJECT_ID" &>/dev/null; then

		gcloud run services update "$SERVICE_NAME" \
			--region="$REGION" \
			--project="$PROJECT_ID" \
			--update-env-vars="_RESTART_TIMESTAMP=$(date +%s)" \
			--quiet
		ok "Service $SERVICE_NAME restarted"
	else
		warn "Service $SERVICE_NAME not found in $REGION — skipping restart"
	fi
else
	echo ""
	info "Cloud Run picks up the new secret on next cold start."
	info "To force a restart now, re-run with --restart"
fi

echo ""
ok "Done. Token tested and updated in Secret Manager."
echo -e "   View: ${BLUE}https://console.cloud.google.com/security/secret-manager/secret/DA_TOKEN?project=$PROJECT_ID${NC}"
