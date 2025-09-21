#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:8080}"
CURL_OPTS=(--connect-timeout 5 --max-time 15 -sS)

# JSON extractor: jq if present, else python3, else sed (best-effort)
jget() {
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r ".${key}" 2>/dev/null || return 1
  elif command -v python3 >/dev/null 2>&1; then
    python3 - "$key" <<'PY'
import sys, json
key = sys.argv[1]
try:
    doc = json.load(sys.stdin)
    val = doc
    for part in key.split('.'):
        val = val[part]
    print(val)
except Exception:
    sys.exit(1)
PY
  else
    # sed fallback only for top-level string fields
    local pattern
    pattern='"'"${key}"'":"\([^"\\]*\)"'
    sed -n "s/.*${pattern}.*/\1/p" || return 1
  fi
}

wait_health() {
  echo "HEALTH CHECK -> ${BASE}/actuator/health"
  for i in {1..20}; do
    code=$(curl "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" "${BASE}/actuator/health" || true)
    echo "Attempt $i: $code"
    if [ "$code" = "200" ]; then return 0; fi
    sleep 1
  done
  echo "Server not healthy after retries" >&2
  exit 1
}

join_player() {
  local code="$1" name="$2"
  echo "JOIN ${name}" 1>&2
  local resp
  resp=$(curl "${CURL_OPTS[@]}" -X POST "${BASE}/api/rooms/${code}/join" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${name}\"}")
  echo "  Response: ${resp}" 1>&2
  local pid token isAdmin
  pid=$(echo "$resp" | jget "playerId")
  token=$(echo "$resp" | jget "sessionToken")
  isAdmin=$(echo "$resp" | jget "isAdmin")
  if [ -z "${pid:-}" ] || [ -z "${token:-}" ]; then
    echo "Join failed for ${name}" >&2
    exit 1
  fi
  echo "${pid}|${token}|${isAdmin}"
}

get_prompt() {
  local code="$1" token="$2"
  curl "${CURL_OPTS[@]}" "${BASE}/api/rooms/${code}/prompt?token=${token}"
}

echo "=== Smoke Test: Create → Join(3) → State → Start → Per-Player Prompt ==="

wait_health

echo
echo "CREATE ROOM"
ROOM=$(curl "${CURL_OPTS[@]}" -X POST "${BASE}/api/rooms")
echo "ROOM: ${ROOM}"
CODE=$(echo "$ROOM" | jget "code")
RID=$(echo "$ROOM" | jget "id")
if [ -z "${CODE:-}" ]; then
  echo "Failed to parse room code" >&2
  exit 1
fi
echo "ROOM_CODE=${CODE}"
echo "ROOM_ID=${RID}"

echo
read -r P1_ID P1_TOKEN P1_ISADMIN < <(join_player "$CODE" "Alice" | tr '|' ' ')
read -r P2_ID P2_TOKEN P2_ISADMIN < <(join_player "$CODE" "Bob"   | tr '|' ' ')
read -r P3_ID P3_TOKEN P3_ISADMIN < <(join_player "$CODE" "Charlie" | tr '|' ' ')
echo "Joined:"
echo "  Alice:   id=${P1_ID} admin=${P1_ISADMIN}"
echo "  Bob:     id=${P2_ID} admin=${P2_ISADMIN}"
echo "  Charlie: id=${P3_ID} admin=${P3_ISADMIN}"

echo
echo "GET ROOM STATE"
STATE=$(curl "${CURL_OPTS[@]}" "${BASE}/api/rooms/${CODE}")
echo "${STATE}"

echo
echo "START GAME"
START=$(curl "${CURL_OPTS[@]}" -X POST "${BASE}/api/rooms/${CODE}/start")
echo "START: ${START}"

if echo "$START" | grep -qE '"imposterId"|"promptImposter"'; then
  echo "FAIL: Start response leaks imposter fields" >&2
  exit 1
fi

COMMON=$(echo "$START" | jget "promptCommon" || true)
GAME_ID=$(echo "$START" | jget "gameId" || true)
echo "GAME_ID=${GAME_ID}"
echo "PROMPT_COMMON=${COMMON}"

echo
echo "FETCH PER-PLAYER PROMPTS"
P1_PROMPT_JSON=$(get_prompt "$CODE" "$P1_TOKEN"); P1_PROMPT=$(echo "$P1_PROMPT_JSON" | jget "prompt" || true)
P2_PROMPT_JSON=$(get_prompt "$CODE" "$P2_TOKEN"); P2_PROMPT=$(echo "$P2_PROMPT_JSON" | jget "prompt" || true)
P3_PROMPT_JSON=$(get_prompt "$CODE" "$P3_TOKEN"); P3_PROMPT=$(echo "$P3_PROMPT_JSON" | jget "prompt" || true)

echo "Alice prompt:   ${P1_PROMPT}"
echo "Bob prompt:     ${P2_PROMPT}"
echo "Charlie prompt: ${P3_PROMPT}"

# Verify exactly one differs from common
diff_count=0
[ "${P1_PROMPT}" != "${COMMON}" ] && diff_count=$((diff_count+1))
[ "${P2_PROMPT}" != "${COMMON}" ] && diff_count=$((diff_count+1))
[ "${P3_PROMPT}" != "${COMMON}" ] && diff_count=$((diff_count+1))

echo
if [ "$diff_count" -eq 1 ]; then
  echo "CHECK: OK (exactly one imposter prompt assigned)"
  exit 0
else
  echo "CHECK: FAIL (expected exactly one imposter prompt; got ${diff_count})"
  exit 1
fi


