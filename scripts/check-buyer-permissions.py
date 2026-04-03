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

def api_get(path):
    url = f"{instance}/services/data/v66.0/{path}"
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

# Get buyer user ID
users = api_get("query?q=SELECT+Id,Name+FROM+User+WHERE+IsPortalEnabled=true+LIMIT+1")
if not users.get('records'):
    print("No portal users found")
    sys.exit(1)

user = users['records'][0]
user_id = user['Id']
print(f"Buyer user: {user['Name']} ({user_id})")

# Get permission set assignments for this buyer
psa = api_get(f"query?q=SELECT+PermissionSet.Name,PermissionSetGroupId,PermissionSet.IsOwnedByProfile+FROM+PermissionSetAssignment+WHERE+AssigneeId='{user_id}'")
print(f"\nPermission Sets assigned ({psa.get('totalSize',0)} total):")
for r in psa.get('records', []):
    ps = r.get('PermissionSet', {})
    group_id = r.get('PermissionSetGroupId', 'none')
    print(f"  - {ps.get('Name','?')} (IsProfile={ps.get('IsOwnedByProfile','?')}) GroupId={group_id}")

# Check if buyer profile has Wishlist permissions
# Profile PS id
profile_ps = api_get("query?q=SELECT+Id+FROM+PermissionSet+WHERE+ProfileId='00eam00000A7N5OAAV'")
profile_ps_id = profile_ps['records'][0]['Id'] if profile_ps.get('records') else None
print(f"\nProfile PermissionSet Id: {profile_ps_id}")

if profile_ps_id:
    obj_perms = api_get(f"query?q=SELECT+SobjectType,PermissionsRead,PermissionsCreate+FROM+ObjectPermissions+WHERE+ParentId='{profile_ps_id}'+AND+SobjectType+IN+('Wishlist','WishlistItem')")
    print("Profile Wishlist permissions:", obj_perms.get('totalSize', 0), "records")
    for r in obj_perms.get('records', []):
        print(f"  {r['SobjectType']}: Read={r['PermissionsRead']} Create={r['PermissionsCreate']}")
