#!/usr/bin/env python3
import subprocess, json, urllib.request, sys

# Get access token
result = subprocess.run(
    ['sf', 'org', 'display', '--target-org', 'ABC-Production', '--json'],
    capture_output=True, text=True
)
org = json.loads(result.stdout)['result']
token = org['accessToken']
instance = org['instanceUrl']

WEBSTORE = '0ZEam000004dJDNGA2'
BUYER = '001Wj000015wumZIAQ'

def api_get(path, params=''):
    url = f"{instance}/services/data/v66.0/{path}"
    if params:
        url += '?' + params
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

# Test 1: Get wishlists with includeDisplayedList
print("=== Test: wishlists?includeDisplayedList=true ===")
r = api_get(f"commerce/webstores/{WEBSTORE}/wishlists", 
            f"effectiveAccountId={BUYER}&includeDisplayedList=true")
print(json.dumps(r, indent=2))

# Test 2: Get wishlists without extra params
print("\n=== Test: wishlists (basic) ===")
r = api_get(f"commerce/webstores/{WEBSTORE}/wishlists",
            f"effectiveAccountId={BUYER}")
print(json.dumps(r, indent=2))
