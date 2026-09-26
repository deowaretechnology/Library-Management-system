#!/usr/bin/env bash
# Read-only probes of the LIVE site: status codes, auth redirects, security headers,
# protection of internal endpoints, forged-session rejection, caching and response
# times. It never signs in and never writes data.
#
#   bash scripts/smoke-test.sh https://library-management-system-six-pi-17.vercel.app
set -u
BASE="${1:-https://library-management-system-six-pi-17.vercel.app}"
BASE="${BASE%/}"
HOST="${BASE#https://}"
FAILS=0
RESULTS=()

ok()   { RESULTS+=("PASS  $1"); }
warn() { RESULTS+=("WARN  $1"); echo "::warning title=Smoke test::$1"; }
bad()  { RESULTS+=("FAIL  $1"); FAILS=$((FAILS + 1)); echo "::error title=Smoke test failed::$1"; }

# req METHOD PATH [curl args...]  → sets CODE, TIME, LOC and header file $H
req() {
  local method="$1" path="$2"; shift 2
  H="$(mktemp)"; B="$(mktemp)"
  read -r CODE TIME < <(curl -s -X "$method" -o "$B" -D "$H" --max-time 40 -w '%{http_code} %{time_total}\n' "$@" "$BASE$path")
  LOC="$(grep -i '^location:' "$H" | tail -1 | cut -d' ' -f2- | tr -d '\r')"
}
hdr() { grep -i "^$1:" "$H" | tail -1 | cut -d' ' -f2- | tr -d '\r'; }
is_redirect() { [[ "$CODE" =~ ^30[1278]$ ]]; }

# 1. Homepage + security headers
req GET /
[ "$CODE" = "200" ] && ok "Homepage loads (200, ${TIME}s)" || bad "Homepage returned $CODE"
[[ "$(hdr content-security-policy)" == *"frame-ancestors 'none'"* ]] && ok "CSP frame-ancestors 'none'" || bad "CSP frame-ancestors missing: '$(hdr content-security-policy)'"
[ -n "$(hdr strict-transport-security)" ] && ok "HSTS present" || bad "HSTS header missing"
[ "$(hdr x-frame-options)" = "DENY" ] && ok "X-Frame-Options DENY" || bad "X-Frame-Options is '$(hdr x-frame-options)'"
[ "$(hdr x-content-type-options)" = "nosniff" ] && ok "X-Content-Type-Options nosniff" || bad "nosniff missing"
[[ "$(hdr permissions-policy)" == *"camera=(self)"* ]] && ok "Permissions-Policy allows camera for QR scanner" || bad "Permissions-Policy is '$(hdr permissions-policy)'"
[ -z "$(hdr x-powered-by)" ] && ok "No X-Powered-By header" || bad "X-Powered-By exposed: $(hdr x-powered-by)"
req GET /
CACHE="$(hdr x-vercel-cache)"
case "$CACHE" in HIT|STALE|PRERENDER) ok "Homepage served from cache (x-vercel-cache: $CACHE, ${TIME}s)";; *) warn "Homepage cache status '$CACHE' (${TIME}s)";; esac

# 2. Public pages
req GET /login
[ "$CODE" = "200" ] && ok "Login page (200, ${TIME}s)" || bad "Login page returned $CODE"
awk -v t="$TIME" 'BEGIN{exit !(t>3)}' && warn "Login page slow: ${TIME}s"
req GET "/change-password?first=1&id=LIB-SMOKE"
[ "$CODE" = "200" ] && ok "First-login change-password page (200)" || bad "Change-password page returned $CODE"

# 3. Protected areas redirect to login without a session
for p in /admin/dashboard /admin/reservations /student/dashboard /student/fines; do
  req GET "$p"
  if is_redirect && [[ "$LOC" == *"/login"* ]]; then ok "$p → login when signed out"; else bad "$p returned $CODE (location: $LOC)"; fi
done

# 4. Forged session cookies are rejected
b64url() { printf '%s' "$1" | base64 | tr -d '=\n' | tr '/+' '_-'; }
NONE_TOKEN="$(b64url '{"alg":"none","typ":"JWT"}').$(b64url '{"userId":"000000000000000000000000","role":"SUPER_ADMIN","name":"x","exp":4102444800}')."
req GET /admin/dashboard -H "Cookie: lms_session=$NONE_TOKEN"
if is_redirect && [[ "$LOC" == *"/login"* ]]; then ok "alg=none forged admin token rejected"; else bad "alg=none token got $CODE (location: $LOC)"; fi
HS_TOKEN="$(b64url '{"alg":"HS256","typ":"JWT"}').$(b64url '{"userId":"000000000000000000000000","role":"SUPER_ADMIN","name":"x","exp":4102444800}').$(b64url 'not-a-real-signature-at-all')"
req GET /admin/dashboard -H "Cookie: lms_session=$HS_TOKEN"
if is_redirect && [[ "$LOC" == *"/login"* ]]; then ok "Badly-signed admin token rejected"; else bad "Badly-signed token got $CODE (location: $LOC)"; fi

# 5. Internal endpoints require their secrets
req GET /api/cron/due-soon
[ "$CODE" = "401" ] && ok "Cron endpoint needs CRON_SECRET (401)" || bad "Cron endpoint returned $CODE without auth"
req GET /api/cron/due-soon -H "Authorization: Bearer wrong-secret"
[ "$CODE" = "401" ] && ok "Cron endpoint rejects a wrong secret (401)" || bad "Cron endpoint returned $CODE with a wrong secret"
req POST /api/webhooks/razorpay -H "Content-Type: application/json" -H "x-razorpay-signature: 0000" --data '{"event":"payment_link.paid"}'
[ "$CODE" = "401" ] && ok "Razorpay webhook rejects unsigned calls (401)" || bad "Razorpay webhook returned $CODE for a bad signature"

# 6. Sign-out route for revoked sessions
req GET /api/auth/signout
if is_redirect && [[ "$LOC" == *"/login?expired=1"* ]]; then ok "Revoked-session sign-out → /login?expired=1"; else bad "Sign-out route returned $CODE (location: $LOC)"; fi

# 7. Studio can't be framed by other sites
req GET /studio
[[ "$(hdr content-security-policy)" == *"frame-ancestors 'self'"* ]] && ok "/studio has frame-ancestors 'self' ($CODE)" || bad "/studio CSP is '$(hdr content-security-policy)' ($CODE)"

# 8. Unknown pages 404 (not 500); HTTP upgrades to HTTPS
req GET /definitely-not-a-real-page
[ "$CODE" = "404" ] && ok "Unknown page → 404" || bad "Unknown page returned $CODE"
read -r HCODE HLOC < <(curl -s -o /dev/null --max-time 20 -w '%{http_code} %{redirect_url}\n' "http://$HOST/")
if [[ "$HCODE" =~ ^30[1278]$ ]] && [[ "$HLOC" == https://* ]]; then ok "HTTP → HTTPS redirect ($HCODE)"; else bad "HTTP returned $HCODE (to: $HLOC)"; fi

SUMMARY="$(printf '%s\n' "${RESULTS[@]}")"
echo "$SUMMARY"
ESCAPED="$(printf '%s' "$SUMMARY" | sed ':a;N;$!ba;s/%/%25/g;s/\n/%0A/g')"
echo "::notice title=Live smoke test ($BASE) — ${FAILS} failed::$ESCAPED"
[ "$FAILS" -eq 0 ]
