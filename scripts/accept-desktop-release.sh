#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: accept-desktop-release.sh \
  --dmg /path/First-LLM-Studio.dmg \
  --request /path/desktop-external-acceptance-request.json \
  --organization-id acme-production \
  --operator-id release-approver \
  --private-key /secure/organization-acceptance-private-key.pem \
  [--output /path/desktop-external-acceptance-receipt.json] [--port 31011]

Run this on a separate organization-controlled Mac. The private key must not be
copied back to the release host. Return only the receipt, its .sig companion,
and the corresponding public key.
EOF
}

dmg=""
request=""
organization_id=""
operator_id=""
private_key=""
output="$PWD/desktop-external-acceptance-receipt.json"
port="31011"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dmg) dmg="$2"; shift 2 ;;
    --request) request="$2"; shift 2 ;;
    --organization-id) organization_id="$2"; shift 2 ;;
    --operator-id) operator_id="$2"; shift 2 ;;
    --private-key) private_key="$2"; shift 2 ;;
    --output) output="$2"; shift 2 ;;
    --port) port="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -f "$dmg" ]] || { printf 'DMG not found: %s\n' "$dmg" >&2; exit 3; }
[[ -f "$request" ]] || { printf 'Acceptance request not found: %s\n' "$request" >&2; exit 3; }
[[ -f "$private_key" ]] || { printf 'Organization signing key not found: %s\n' "$private_key" >&2; exit 3; }
[[ -n "$organization_id" && -n "$operator_id" ]] || { printf 'Organization and operator identities are required.\n' >&2; exit 3; }
[[ "$organization_id" != local* && "$organization_id" != test* && "$organization_id" != rehearsal* ]] || {
  printf 'Use a durable organization identity, not a local/test placeholder.\n' >&2
  exit 3
}

schema="$(/usr/bin/plutil -extract schemaVersion raw -o - "$request")"
[[ "$schema" == "desktop.external-acceptance-request.v1" ]] || { printf 'Unsupported request schema: %s\n' "$schema" >&2; exit 4; }
expected_digest="$(/usr/bin/plutil -extract package.sha256 raw -o - "$request")"
request_id="$(/usr/bin/plutil -extract requestId raw -o - "$request")"
version="$(/usr/bin/plutil -extract version raw -o - "$request")"
release_host="$(/usr/bin/plutil -extract releaseHostFingerprint raw -o - "$request")"
actual_digest="$(/usr/bin/shasum -a 256 "$dmg" | /usr/bin/awk '{print $1}')"
[[ "$actual_digest" == "$expected_digest" ]] || { printf 'DMG digest mismatch.\n' >&2; exit 5; }

temp_root="$(/usr/bin/mktemp -d -t first-llm-acceptance)"
mount_point="$temp_root/mount"
profile_home="$temp_root/profile-home"
installed_app="$profile_home/Applications/First LLM Studio.app"
data_dir="$profile_home/Library/Application Support/local-agent-lab/observability"
candidate_dmg="$temp_root/$(basename "$dmg")"
server_pid=""
mounted="0"

cleanup() {
  if [[ -n "$server_pid" ]]; then /bin/kill "$server_pid" >/dev/null 2>&1 || true; fi
  if [[ "$mounted" == "1" ]]; then /usr/bin/hdiutil detach "$mount_point" -quiet >/dev/null 2>&1 || true; fi
  /bin/rm -rf "$temp_root"
}
trap cleanup EXIT INT TERM

/bin/cp "$dmg" "$candidate_dmg"
/usr/bin/xattr -w com.apple.quarantine "0081;$(printf '%x' "$(date +%s)");FirstLLMStudioAcceptance;" "$candidate_dmg"
/usr/bin/xcrun stapler validate "$candidate_dmg" >/dev/null
/usr/sbin/spctl --assess --type open --context context:primary-signature --verbose=4 "$candidate_dmg" >/dev/null

/bin/mkdir -p "$mount_point" "$profile_home/Applications"
/usr/bin/hdiutil attach -readonly -nobrowse -mountpoint "$mount_point" "$candidate_dmg" -quiet
mounted="1"
source_app="$mount_point/First LLM Studio.app"
[[ -d "$source_app" ]] || { printf 'App bundle is missing from mounted DMG.\n' >&2; exit 6; }
/usr/bin/codesign --verify --deep --strict --verbose=4 "$source_app"
/usr/bin/xcrun stapler validate "$source_app" >/dev/null
/usr/sbin/spctl --assess --type execute --verbose=4 "$source_app" >/dev/null

/usr/bin/ditto "$source_app" "$installed_app"
HOME="$profile_home" LOCAL_AGENT_DATA_DIR="$data_dir" FIRST_LLM_STUDIO_PORT="$port" FIRST_LLM_STUDIO_NO_BROWSER=1 \
  "$installed_app/Contents/MacOS/first-llm-studio"

for _ in $(seq 1 120); do
  /usr/bin/curl -fsS --max-time 2 "http://127.0.0.1:$port/agent" >/dev/null 2>&1 && break
  /bin/sleep 0.25
done
/usr/bin/curl -fsS --max-time 5 "http://127.0.0.1:$port/agent" >/dev/null
api_json="$(/usr/bin/curl -fsS --max-time 5 "http://127.0.0.1:$port/api/desktop/onboarding-release")"
api_schema="$(printf '%s' "$api_json" | /usr/bin/plutil -extract schemaVersion raw -o - -)"
[[ "$api_schema" == "desktop.onboarding-release.v1" ]] || { printf 'Unexpected onboarding API schema: %s\n' "$api_schema" >&2; exit 7; }

pid_file="$data_dir/desktop-server.pid"
[[ -f "$pid_file" ]] || { printf 'Desktop server PID file is missing.\n' >&2; exit 8; }
server_pid="$(tr -d '[:space:]' < "$pid_file")"
/bin/kill "$server_pid"
for _ in $(seq 1 40); do
  /bin/kill -0 "$server_pid" >/dev/null 2>&1 || break
  /bin/sleep 0.25
done
/bin/kill -0 "$server_pid" >/dev/null 2>&1 && { printf 'Desktop server did not stop.\n' >&2; exit 8; }
server_pid=""

/bin/rm -rf "$installed_app"
[[ -d "$data_dir" ]] || { printf 'Uninstall did not preserve user data.\n' >&2; exit 9; }
/bin/rm -rf "$profile_home/Library/Application Support/local-agent-lab"
[[ ! -e "$data_dir" ]] || { printf 'Explicit purge did not remove user data.\n' >&2; exit 9; }
/usr/bin/hdiutil detach "$mount_point" -quiet
mounted="0"

host_source="$(/usr/sbin/ioreg -rd1 -c IOPlatformExpertDevice | /usr/bin/awk -F'"' '/IOPlatformUUID/ {print $(NF-1); exit}')"
[[ -n "$host_source" ]] || host_source="$(/bin/hostname)|$(/usr/bin/uname -m)"
host_fingerprint="$(printf '%s' "$host_source" | /usr/bin/shasum -a 256 | /usr/bin/awk '{print $1}')"
[[ "$host_fingerprint" != "$release_host" ]] || { printf 'Acceptance must run on a different physical/virtual Mac.\n' >&2; exit 10; }

request_digest="$(/usr/bin/shasum -a 256 "$request" | /usr/bin/awk '{print $1}')"
/bin/mkdir -p "$(dirname "$output")"
public_key="$output.pub.pem"
/usr/bin/openssl rsa -in "$private_key" -pubout -out "$public_key" >/dev/null 2>&1
key_id="rsa-sha256-$(/usr/bin/shasum -a 256 "$public_key" | /usr/bin/awk '{print substr($1,1,16)}')"
completed_at="$(/bin/date -u +%Y-%m-%dT%H:%M:%SZ)"

/usr/bin/plutil -create json "$output"
/usr/bin/plutil -insert schemaVersion -string "desktop.external-acceptance-receipt.v1" "$output"
/usr/bin/plutil -insert generatedAt -string "$completed_at" "$output"
/usr/bin/plutil -insert status -string "pass" "$output"
/usr/bin/plutil -insert requestId -string "$request_id" "$output"
/usr/bin/plutil -insert requestDigest -string "$request_digest" "$output"
/usr/bin/plutil -insert version -string "$version" "$output"
/usr/bin/plutil -insert package -dictionary "$output"
/usr/bin/plutil -insert package.fileName -string "$(basename "$dmg")" "$output"
/usr/bin/plutil -insert package.sha256 -string "$actual_digest" "$output"
/usr/bin/plutil -insert host -dictionary "$output"
/usr/bin/plutil -insert host.fingerprint -string "$host_fingerprint" "$output"
/usr/bin/plutil -insert host.releaseHostDifferent -bool true "$output"
/usr/bin/plutil -insert host.osVersion -string "$(/usr/bin/sw_vers -productVersion)" "$output"
/usr/bin/plutil -insert host.architecture -string "$(/usr/bin/uname -m)" "$output"
/usr/bin/plutil -insert approver -dictionary "$output"
/usr/bin/plutil -insert approver.organizationId -string "$organization_id" "$output"
/usr/bin/plutil -insert approver.operatorId -string "$operator_id" "$output"
/usr/bin/plutil -insert approver.keyId -string "$key_id" "$output"
/usr/bin/plutil -insert checks -json '{"packageDigestVerified":true,"readOnlyMount":true,"developerIdVerified":true,"notaryTicketValidated":true,"gatekeeperAccepted":true,"isolatedProfileCreated":true,"agentRouteHealthy":true,"onboardingApiHealthy":true,"processStopped":true,"imageDetached":true,"uninstallPreservedData":true,"explicitPurgeRemovedData":true}' "$output"
/usr/bin/plutil -convert json -r "$output"

signature_path="$output.sig"
/usr/bin/openssl dgst -sha256 -sign "$private_key" -out "$signature_path" "$output"
/usr/bin/openssl dgst -sha256 -verify "$public_key" -signature "$signature_path" "$output" >/dev/null

printf 'Acceptance passed. Return these files to the release owner:\n'
printf '  receipt: %s\n' "$output"
printf '  signature: %s\n' "$signature_path"
printf '  public key: %s\n' "$public_key"
printf 'Public key contents follow; store them in the organization trust configuration:\n'
/bin/cat "$public_key"
