import os, sys, json, glob, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
DOCS = os.environ.get('ENTRA_DOCS', os.path.join(ROOT, '.cache', 'entra-docs', 'docs'))
import re, glob, json
root = DOCS
L = [
 ('Sign-in and audit logs retained 7 days (Free) and 30 days (P1/P2)', '00-01, 04-04', 'identity/monitoring-health/reference-reports-data-retention.md', r'Audit logs \| Seven days \| 30 days'),
 ('Deleted users restorable for 30 days', '01-02', 'fundamentals/how-to-create-delete-users.md', r'Deleted users\*\* page for the next 30 days'),
 ('Deleted Microsoft 365 groups restorable for 30 days; not customizable', '01-02', 'identity/users/groups-lifecycle.md', r"30-day group restoration period isn't cus"),
 ('Group expiration lifetime: preset or custom, 30 days or more', '01-02', 'identity/users/groups-lifecycle.md', r'custom value\. It should be 30 days or more'),
 ('Max devices per user: default 50, up to 100 or unlimited', '01-01', 'identity/devices/manage-device-identities.md', r'The default value is \*\*50\*\*'),
 ('Connect Sync default LocalDB (SQL Express, 10 GB, ~100,000 objects)', '01-04', 'identity/hybrid/connect/how-to-connect-install-prerequisites.md', r'100,000'),
 ('Connect Sync cycle every 30 minutes by default', '01-04', 'identity/hybrid/connect/how-to-connect-sync-feature-scheduler.md', r'By default every 30 minutes'),
 ('Password hash sync every 2 minutes', '01-04', 'identity/hybrid/connect/how-to-connect-password-hash-synchronization.md', r'(2|two) minutes'),
 ('Cloud Sync job schedule interval 2 minutes (PT2M)', '01-04', 'identity/hybrid/cloud-sync/concept-attributes.md', r'"interval": "PT2M"'),
 ('Roll over the Seamless SSO key at least every 30 days', '01-04', 'identity/hybrid/connect/how-to-connect-sso-how-it-works.md', r'at least every 30 days'),
 ('TAP lifetime 10 to 43,200 minutes (30 days)', '02-01', 'identity/authentication/howto-authentication-temporary-access-pass.md', r'10 – 43,200 Minutes \(30 days\)'),
 ('OATH TOTP codes refresh every 30 or 60 seconds', '02-01', 'identity/authentication/concept-authentication-oath-tokens.md', r'every 30 or 60 seconds'),
 ('Smart lockout: 10 failed attempts (Azure Public), 60-second default duration', '02-01', 'identity/authentication/howto-password-smart-lockout.md', r'10 failed attempts in Azure Public'),
 ('Smart lockout default duration 60 seconds', '02-01', 'identity/authentication/howto-password-smart-lockout.md', r'The default is 60 seconds'),
 ('Default sign-in frequency: rolling 90-day window', '02-03', 'identity/conditional-access/concept-session-lifetime.md', r'rolling window of 90 days'),
 ('CAE sessions: tokens long-lived up to 28 hours', '02-03', 'identity/conditional-access/concept-continuous-access-evaluation.md', r'up to 28 hours'),
 ('MFA registration policy: 14 days to register', '02-04', 'id-protection/howto-identity-protection-configure-mfa-policy.md', r'14 days to complete registration'),
 ('Access tokens: random 60-90 minutes by default (75 average)', 'L2', 'identity-platform/access-tokens.md', r'between 60-90 minutes \(75 minutes on average\)'),
 ('Client secrets limited to 24 months', '03-03', 'identity-platform/howto-call-a-web-api-with-rest-client.md', r'two years \(24 months\)'),
 ('Provisioning incremental cycles typically every 20-40 minutes', '03-02', 'identity/app-provisioning/check-status-user-account-provisioning.md', r'every 20-40 minutes'),
 ('SAML signing certificate valid three years', '03-02', 'identity/enterprise-apps/tutorial-manage-certificates-for-federated-single-sign-on.md', r'valid for three years'),
 ('Admin consent: Privileged Role Administrator grants any permission for any API', '03-02', 'identity/enterprise-apps/grant-admin-consent.md', r'Privileged Role Administrator, for granting consent for apps requesting any permission, for any API'),
 ('Admin consent: Cloud Application/Application/AI Administrator cannot grant Graph app roles', '03-02', 'identity/enterprise-apps/grant-admin-consent.md', r'\*except\* Microsoft Graph app roles'),
 ('Admin consent workflow: only Global Administrators approve Graph app role requests', '03-02', 'identity/enterprise-apps/configure-admin-consent-workflow.md', r'only Global Administrators can approve admin consent requests for apps requesting for Microsoft Graph app roles'),
 ('Deleted enterprise applications restorable within 30 days', '03-03', 'identity/enterprise-apps/restore-application.md', r'within the first 30 days'),
 ('Access review inactivity: no sign-in in last 30 days', '04-02', 'id-governance/review-recommendations-access-reviews.md', r'within the last 30 days'),
 ('Denied guests: block sign-in 30 days, then remove from tenant', '04-02', 'id-governance/create-access-review.md', r'Block user from signing-in for 30 days, then remove user from the tenant'),
 ('PIM activation maximum 1 to 24 hours', '04-03', 'id-governance/privileged-identity-management/pim-how-to-change-default-settings.md', r'from one to 24 hours'),
 ('PIM 10-minute reauthentication window across roles, resources and groups', '04-03', 'id-governance/privileged-identity-management/pim-how-to-change-default-settings.md', r'10-minute window applies'),
 ('PIM ticket information is information-only', '04-03', 'id-governance/privileged-identity-management/pim-how-to-change-default-settings.md', r'information-only field'),
 ('PIM approvers need no role; select at least two', '04-03', 'id-governance/privileged-identity-management/pim-how-to-change-default-settings.md', r"approver doesn't have to have any roles"),
 ('PIM for Groups membership provisioned in 2-10 minutes', '04-03', 'id-governance/privileged-identity-management/concept-pim-for-groups.md', r'provisioned in 2 – 10 minutes'),
 ('Identity Secure Score recalculated every 24 hours', '04-04', 'identity/monitoring-health/concept-identity-secure-score.md', r'Every 24 hours'),
]
out = []; fails = []
for claim, where, path, pat in L:
    txt = open(f'{root}/{path}', encoding='utf-8', errors='ignore').read().split('\n')
    hit = next(((i, l) for i, l in enumerate(txt, 1) if re.search(pat, l)), None)
    if hit: out.append((claim, where, f'{path}:{hit[0]}', re.sub(r'\s+', ' ', hit[1]).strip()[:200]))
    else: fails.append(claim)
print(len(out), 'grounded;', 'failed:', fails)
sys.exit(1 if fails else 0)
json.dump(out, open(os.path.join(OUT, 'facts.json'), 'w'), indent=1)
