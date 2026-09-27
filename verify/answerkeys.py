import os, sys, json, glob, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
DOCS = os.environ.get('ENTRA_DOCS', os.path.join(ROOT, '.cache', 'entra-docs', 'docs'))
import re, glob, json, urllib.request
root = DOCS
P = [ # claim, questions, file (entra-docs relative), regex that must match the cited line
 ('Organizations implementing Conditional Access must disable security defaults', '00-01.q1', 'fundamentals/security-defaults.md', r'must disable security defaults'),
 ('Privileged Authentication Administrator can manage methods for any user, admin or not', '01-01.q1', 'identity/role-based-access-control/permissions-reference.md', r'Privileged Authentication Administrator\]\(#privileged-authentication-administrator\) \| Can access to view, set and reset authentication method information for any user \(admin or non-admin\)'),
 ('Restricted management AUs keep tenant-scoped admins from modifying members', '01-01.q4', 'identity/role-based-access-control/admin-units-restricted-management.md', r"don't want to allow your tenant-scoped administrators"),
 ('Adding a group to an AU does not add its members', '01-01.q5, x01', 'identity/role-based-access-control/admin-units-faq-troubleshoot.yml', r"doesn't result in all the group's members being added"),
 ('Role-assignable groups must be created with isAssignableToRole = true', '01-02.q2, x02', 'identity/role-based-access-control/groups-concept.md', r'must create a new security or Microsoft 365 group with the `isAssignableToRole` property set to `true`'),
 ('Restrict access to the admin portal is not a security measure', '01-01.q9, x03', 'fundamentals/users-default-permissions.md', r'not a security measure'),
 ('Global Administrator has no custom security attribute permissions by default', '01-02.q3, x05', 'includes/security-attributes-roles.md', r'do not have permissions to read, define, or assign custom security attributes'),
 ('Restricted guest access: guests see only their own profiles', '01-03.q1, x07', 'external-id/external-collaboration-settings-configure.md', r'guests can access only their own profiles'),
 ('Allow list or block list, not both', 'x07', 'external-id/allow-deny-list.md', r"You can't set up both types of lists"),
 ('Reset redemption status: reinvite without deleting the account', '01-03.q3, x10', 'external-id/reset-redemption-status.md', r'without deleting their account'),
 ('Inbound trust lets Conditional Access trust MFA claims from external tenants', '01-03.q4, x08', 'external-id/cross-tenant-access-settings-b2b-collaboration.yml', r'Trust multifactor authentication from Microsoft Entra tenants'),
 ('Cross-tenant sync: target must allow user synchronization into the tenant', '01-03.q6, x09, c02', 'identity/multi-tenant-organizations/cross-tenant-synchronization-configure.md', r'Allow user synchronization into this tenant'),
 ('Cross-tenant sync creates users as Member by default', '01-03.q5, c02', 'identity/multi-tenant-organizations/cross-tenant-synchronization-configure.md', r'\*\*Member\*\* \| Default\. Users will be created as external member'),
 ('SAML/WS-Fed IdP federation works with verified or unverified partner domains', '01-03.q7, c05, x65', 'external-id/direct-federation-overview.md', r"partner's domain can be either Microsoft Entra verified or unverified"),
 ('For Entra-verified domains, Entra ID remains the primary IdP for invitation redemption', 'x65', 'external-id/direct-federation-overview.md', r'Microsoft Entra ID remains the primary IdP'),
 ('Existing B2B users keep their userType unless the mapping applies Always', 'x65', 'identity/multi-tenant-organizations/cross-tenant-synchronization-configure.md', r"If the B2B user already exists in the target tenant"),
 ('Staging mode imports and syncs but does not export; standby server', '01-04.q1, x13', 'identity/hybrid/connect/how-to-connect-sync-staging-server.md', r"doesn't run any exports"),
 ('Cloud Sync natively handles disconnected forests', '01-04.q2, c03', 'identity/hybrid/cloud-sync/what-is-cloud-sync.md', r'Disconnected forest synchronization'),
 ('Leaked credentials detection requires password hash sync for hybrid users', '01-04.q3, 02-04.q6, x12, c01', 'id-protection/id-protection-faq.yml', r'leaked credentials detection requires \[password hash synchronization\]'),
 ('Seamless SSO creates the AZUREADSSOACC computer account', '01-04.q5, 01-04.q6', 'identity/hybrid/connect/how-to-connect-sso-how-it-works.md', r'A computer account \(`AZUREADSSOACC`\) is created'),
 ('Staged rollout tests cloud authentication while domains stay federated', '01-04.q7, c01', 'identity/hybrid/connect/how-to-connect-staged-rollout.md', r'test cloud authentication with a group of users before'),
 ('AD FS application activity data comes from Connect and Connect Health agents for AD FS', '01-04.q8', 'identity/enterprise-apps/migrate-ad-fs-application-overview.md', r'Connect Health agents for AD FS reads'),
 ("PTA doesn't fail over to PHS; configure it for high availability", 'x12, c01', 'identity/hybrid/connect/how-to-connect-pta-faq.yml', r"doesn't\* automatically failover to password hash synchronization"),
 ('TAP is a time-limited passcode to onboard passwordless methods', '02-01.q2, x15', 'identity/authentication/howto-authentication-temporary-access-pass.md', r'time-limited passcode'),
 ('Passkey profiles (Default profile carries existing settings)', '02-01.q3, x15', 'identity/authentication/how-to-authentication-passkeys-fido2.md', r'Enable passkey profiles'),
 ('Reporting an MFA prompt as suspicious sets High User Risk', '02-01.q4', 'identity/authentication/howto-mfa-mfasettings.md', r'set to \*\*High User Risk\*\*'),
 ('Legacy MFA/SSPR method management ended September 30, 2025', 'x15', 'identity/authentication/concept-authentication-methods-manage.md', r'Beginning September 30, 2025'),
 ('Administrators get a stronger two-gate SSPR policy by default', 'x17', 'identity/authentication/concept-sspr-policy.md', r'two-gate'),
 ('On-premises password policy enforced where the DC Agent is installed', '02-01.q8, x18', 'identity/authentication/concept-password-ban-bad-on-premises.md', r'Domain Controller Agent \(DC Agent\) is installed'),
 ('Exclude overrides include in Conditional Access', '02-02.q2', 'identity/conditional-access/concept-conditional-access-users-groups.md', r'exclude action overrides the include action'),
 ('Block legacy authentication with the Other clients condition', '02-02.q3, x21', 'identity/conditional-access/concept-conditional-access-conditions.md', r'block legacy authentication using the \*\*Other clients\*\*'),
 ('Register security information is a Conditional Access user action', '02-02.q4', 'identity/conditional-access/concept-conditional-access-cloud-apps.md', r'Register security information'),
 ('All applicable policies must be satisfied (so any applicable block blocks)', '02-02.q5, x20', 'identity/conditional-access/concept-conditional-access-policies.md', r'all applicable policies must be satisfied'),
 ("Report-only policies are evaluated but not enforced", '02-02.q7, x22', 'identity/conditional-access/concept-conditional-access-report-only.md', r"doesn't enforce them"),
 ('Templates exclude only the user creating the policy', '02-02.q9', 'identity/conditional-access/concept-conditional-access-policy-common.md', r'exclude only the user creating the policy'),
 ('Template policies are created in report-only mode by default', 'x23', 'identity/conditional-access/concept-conditional-access-policy-common.md', r'By default, each policy is created in \[report-only mode\]'),
 ('Authentication flows condition covers device code flow', 'x24', 'identity/conditional-access/concept-authentication-flows.md', r'^## Device code flow'),
 ('Use app enforced restrictions is a session control', '02-03.q1, c04, 03-04.q3', 'identity/conditional-access/concept-conditional-access-policies.md', r'Use app enforced restrictions'),
 ('Filter for devices can target extensionAttribute values', '02-03.q3, x28', 'identity/conditional-access/concept-condition-filters-for-devices.md', r'device\.extensionAttribute1 equals SAW'),
 ('Require approved client app retired June 30, 2026', '02-03.q4', 'identity/conditional-access/migrate-approved-client-app.md', r'June 30, 2026'),
 ('Strict location enforcement stops access when the resource sees a different IP', '02-03.q6, x25', 'identity/conditional-access/concept-continuous-access-evaluation-strict-enforcement.md', r'immediately stopping access if the IP address'),
 ('Protected actions use a Conditional Access authentication context', '02-03.q8, x27', 'identity/role-based-access-control/protected-actions-add.md', r'Protected actions use a Conditional Access authentication context'),
 ('Admin confirmed user compromised is a user risk detection', '02-04.q5, x30', 'id-protection/concept-identity-protection-risks.md', r'selected \*\*Confirm user compromised\*\*'),
 ('Registration campaign has snooze settings', '02-04.q4, x31', 'identity/authentication/how-to-mfa-registration-campaign.md', r'snooze settings'),
 ('CA for service principals needs Workload Identities Premium', 'x32, 02-04.q7', 'identity/conditional-access/workload-identity.md', r'Workload Identities Premium licenses are required'),
 ('Internet Access for Microsoft services is included in Entra ID P1/P2', 'x34', 'global-secure-access/overview-what-is-global-secure-access.md', r'included in a Microsoft Entra ID P1 or Microsoft Entra ID P2 license'),
 ('Baseline profile applies tenant-wide at lowest priority', 'x36, 02-05.q4', 'global-secure-access/how-to-configure-web-content-filtering.md', r'baseline security profile to apply tenant-wide'),
 ('Compliant network check with Conditional Access', '02-05.q5', 'global-secure-access/how-to-compliant-network.md', r'Compliant Network'),
 ('Source IP restoration addresses SSE hiding the original source IP', '02-05.q6, x34', 'global-secure-access/how-to-source-ip-restoration.md', r'abstract the original source IP'),
 ('Private Access defines FQDNs or IP addresses of private resources', 'x33, 02-05.q2', 'global-secure-access/how-to-configure-quick-access.md', r'fully qualified domain names \(FQDNs\) or IP addresses'),
 ('Private network connectors create outbound connections', '02-05.q3, x40', 'global-secure-access/concept-connectors.md', r'create outbound connections'),
 ('Two managed identity types; system-assigned linked to one resource', '03-01.q3, 03-01.q4, x39', 'identity/managed-identities-azure-resources/overview-for-developers.md', r'System-assigned identities are directly linked to a single Azure resource'),
 ('VM token request goes to 169.254.169.254 with Metadata: true', '03-01.q6, x38', 'identity/managed-identities-azure-resources/how-to-use-vm-token.md', r'169\.254\.169\.254.*Metadata: true'),
 ('Workload identity federation for GitHub Actions', 'x37, 03-01.q1', 'workload-id/workload-identity-federation.md', r'GitHub Actions'),
 ('Cloud Application Administrator: everything except App Proxy', '03-02.q2, x42', 'identity/role-based-access-control/permissions-reference.md', r'enterprise apps except App Proxy'),
 ('Application proxy brings Conditional Access and MFA to on-premises apps', '03-02.q3, x40', 'identity/app-proxy/overview-what-is-app-proxy.md', r'can use Microsoft Entra Conditional Access and multifactor authentication'),
 ("Group assignment doesn't cascade to nested groups", 'x44', 'identity/enterprise-apps/assign-user-or-group-access-portal.md', r"doesn't cascade to nested groups"),
 ('Permissions can be classified Low impact', '03-02.q6, x41', 'identity/enterprise-apps/configure-permission-classifications.md', r'Low impact'),
 ('Collections organise My Apps into groups with separate tabs', '03-02.q8', 'identity/enterprise-apps/access-panel-collections.md', r'separate tabs'),
 ('Application Developer registers apps regardless of the user setting', '03-03.q1', 'identity/role-based-access-control/permissions-reference.md', r"independent of the 'Users can register applications' setting"),
 ('Application permissions: generally only an admin or API owner can consent', '03-03.q5, x45', 'identity-platform/permissions-consent-overview.md', r'only an administrator or owner'),
 ('Use authorization code with PKCE, not implicit grant', '03-03.q4, x47', 'identity-platform/msal-authentication-flows.md', r'use authorization code with PKCE instead'),
 ('App roles for applications appear as application permissions', '03-03.q7, x46', 'identity-platform/howto-add-app-roles-in-apps.md', r'app roles appear as application permissions'),
 ('Catalog owners can delegate catalog management', '04-01.q2', 'id-governance/entitlement-management-delegate.md', r'catalog owners'),
 ('Failed or partially delivered requests can be reprocessed', '04-01.q4', 'id-governance/entitlement-management-access-package-requests.md', r'reprocess functionality'),
 ('Connected organisations by domain for non-Microsoft directories', '04-01.q7', 'id-governance/entitlement-management-organization.md', r'same domain name in common'),
 ('Connected organisation state: Configured or Proposed', '04-01.q8', 'id-governance/entitlement-management-organization.md', r'\*\*Configured\*\* when you create'),
 ('Catalogs must be Enabled for external users', 'x51', 'id-governance/entitlement-management-catalog-create.md', r'\*\*Enabled for external users\*\* to \*\*Yes\*\*'),
 ('Terms of use: require consent on every device', '04-01.q5, x53', 'identity/conditional-access/terms-of-use.md', r'Require users to consent on every device'),
 ('Fallback reviewers when no manager or group owner', '04-02.q2', 'id-governance/create-access-review.md', r'Fallback reviewers are asked to do a review'),
 ('Auto apply results removes denied access after the review', 'x54, 04-02.q1, 04-02.q5', 'id-governance/create-access-review.md', r'Auto apply results to resource'),
 ('Results page offers Stop, Reset and Download', '04-02.q6, x55', 'id-governance/complete-access-review.md', r'ability to Stop, Reset, and Download'),
 ('Downloadable access review history reports', '04-02.q4, x56', 'id-governance/access-reviews-downloadable-review-history.md', r'downloadable access review history'),
 ('PIM alert: roles assigned outside of PIM', '04-03.q7', 'id-governance/privileged-identity-management/pim-how-to-configure-security-alerts.md', r'Roles are being assigned outside of Privileged Identity Management'),
 ('Emergency access accounts: two or more, cloud-only, onmicrosoft.com', '04-03.q8, x59', 'identity/role-based-access-control/security-emergency-access.md', r'Create two or more emergency access accounts'),
 ('Sign-in details include a correlation ID', '04-04.q1', 'identity/monitoring-health/concept-sign-in-log-activity-details.md', r'\*\*Correlation ID:\*\*'),
 ('Stream to a non-Microsoft SIEM through Event Hubs', '04-04.q4, c07', 'identity/monitoring-health/concept-log-monitoring-integration-options-considerations.md', r'Event Hubs namespace'),
 ('Non-interactive sign-ins are done on behalf of a user', '04-04.q6', 'identity/monitoring-health/concept-noninteractive-sign-ins.md', r'on behalf of a\* user'),
 ('Conditional Access insights and reporting workbook', '04-04.q7', 'identity/conditional-access/howto-conditional-access-insights-reporting.md', r'Conditional Access insights and reporting workbook'),
 ('Persistent browser session keeps users signed in after closing the browser', 'c04', 'identity/conditional-access/concept-session-lifetime.md', r'persistent browser session lets users stay signed in'),
 ('Hybrid join: keep default device attributes in Connect Sync', 'x06', 'identity/devices/how-to-hybrid-join.md', r"Don't exclude the default device attributes"),
]
P += [
 ('Emergency access accounts excluded from blocking CA policies', '00-01.q3, 02-02.q1', 'identity/role-based-access-control/security-emergency-access.md', r'excluded from any Conditional Access policy that blocks or restricts sign-in'),
 ('Entra ID P2 required for risk-based access policies', '00-01.q4', 'id-protection/concept-identity-protection-policies.md', r'P2\]\(.*\) is required to use risk-based access policies'),
 ('Custom roles use Entra permissions such as applications/credentials/update', '01-01.q2', 'identity/role-based-access-control/custom-create.md', r'microsoft\.directory/applications/credentials/update'),
 ('Administrative units restrict role permissions to a portion of the organization', '01-01.q3', 'identity/role-based-access-control/administrative-units.md', r'Administrative units restrict permissions in a role'),
 ('Custom domains verified by adding DNS information at the registrar', '01-01.q7', 'fundamentals/add-custom-domain.md', r'add the DNS information you copied'),
 ('Sign-in experience customised by browser language', '01-01.q8', 'fundamentals/how-to-customize-branding.md', r'Customize the sign-in experience by browser language'),
 ('Deleted users restorable for 30 days', '01-02.q1', 'fundamentals/how-to-create-delete-users.md', r'Deleted users\*\* page for the next 30 days'),
 ('Bulk create users from a CSV template', '01-02.q4', 'identity/users/users-bulk-add.md', r'bulk user create'),
 ('LicenseAssignmentStates shows how a user got each licence', '01-02.q7', 'identity/users/licensing-powershell-graph-examples.md', r'LicenseAssignmentStates'),
 ('Bulk invite users from a CSV file', '01-03.q2', 'external-id/tutorial-bulk-invite.md', r'Bulk invite users'),
 ('PTA agent validates the password against Active Directory', '01-04.q4', 'identity/hybrid/connect/how-to-connect-pta-how-it-works.md', r'agent validates the username and password against Active Directory'),
 ('Connect Health for sync surfaces sync alerts and errors', '01-04.q9, x14', 'identity/hybrid/connect/how-to-connect-health-sync.md', r'synchronization alerts and errors'),
 ('Authentication strengths can require phishing-resistant methods only', '02-01.q1, 02-02.q6', 'identity/authentication/concept-authentication-strengths.md', r'only phishing-resistant authentication methods'),
 ('SSPR writeback with Microsoft Entra Connect or cloud sync', '02-01.q5', 'identity/authentication/concept-sspr-writeback.md', r'using \[Microsoft Entra Connect\]\(tutorial-enable-sspr-writeback\.md\) or \[cloud sync\]'),
 ('Entra Kerberos partial TGT traded for a full TGT at a DC', '02-01.q6, 02-01.q9, x19', 'identity/authentication/howto-authentication-passwordless-security-key-on-premises.md', r'trades the partial TGT for a fully formed TGT'),
 ('Revoke access: disable in AD and in Entra for synced users', '02-01.q7, x16', 'identity/users/users-revoke-access.md', r'Disable the user in Active Directory'),
 ('53003 = BlockedByConditionalAccess', '02-02.q8', 'identity/conditional-access/troubleshoot-conditional-access.md', r'53003 \| BlockedByConditionalAccess'),
 ('CAE critical event: account deleted or disabled', '02-03.q5', 'identity/conditional-access/concept-continuous-access-evaluation.md', r'User Account is deleted or disabled'),
 ('Authentication context secures data and actions, including SharePoint', '02-03.q7, x26', 'identity/conditional-access/concept-conditional-access-cloud-apps.md', r'Authentication context secures data and actions in applications'),
 ('Legacy ID Protection risk policies retire October 1, 2026', '02-04.q1, x29', 'id-protection/concept-identity-protection-policies.md', r'retiring on \*\*October 1, 2026\*\*'),
 ('Sign-in risk and user risk conditions in Conditional Access', '02-04.q2', 'id-protection/concept-identity-protection-policies.md', r'two user-specific risk conditions'),
 ('GSA client: device joined to or registered (preview) in the tenant', '02-05.q1, x35', 'global-secure-access/how-to-install-windows-client.md', r'joined to or registered \(preview\)'),
 ('Enabled for users to sign in = No blocks sign-in', '03-02.q1', 'identity/enterprise-apps/disable-user-sign-in-portal.md', r'Enabled for users to sign-in'),
 ('Provisioning supports SCIM for SaaS apps', '03-02.q4', 'identity/app-provisioning/user-provisioning.md', r'SCIM - SaaS'),
 ("App roles are received in the token's roles claim", '03-02.q5', 'identity-platform/howto-add-app-roles-in-apps.md', r"'roles' claim"),
 ('Admin consent workflow lets users request apps that need admin consent', '03-02.q7', 'identity/enterprise-apps/configure-admin-consent-workflow.md', r'request access to applications that require admin consent'),
 ('AzureADMyOrg = accounts in this organizational directory only', '03-03.q2', 'identity-platform/howto-modify-supported-accounts.md', r'\*\*AzureADMyOrg\*\*'),
 ('One application object in the home tenant', '03-03.q3', 'identity-platform/app-objects-and-service-principals.md', r'one and only application object'),
 ("Updating requested permissions doesn't grant access", '03-03.q6', 'identity-platform/howto-update-permissions.md', r"doesn't automatically grant or revoke"),
 ('An access package bundles the resources an identity needs', '04-01.q1, 04-01.q3', 'id-governance/entitlement-management-overview.md', r'An access package is a bundle'),
 ('External user lifecycle settings: remove or block after last assignment', '04-01.q6, x52', 'id-governance/entitlement-management-external-users.md', r'Block external user from signing in to directory'),
 ('Add resources to a catalog before packaging them', 'c06', 'id-governance/entitlement-management-catalog-create.md', r'^## Add resources to a catalog'),
 ('User-to-group affiliation recommendations need ID Governance', '04-02.q3', 'id-governance/review-recommendations-access-reviews.md', r'user-to-group affiliation.*requires a Microsoft Entra ID Governance license'),
 ('PIM can require a business justification on activation', '04-03.q1', 'id-governance/privileged-identity-management/pim-how-to-change-default-settings.md', r'business justification'),
 ('PIM activation can require a Conditional Access authentication context', '04-03.q2, x64', 'id-governance/privileged-identity-management/pim-how-to-change-default-settings.md', r'On activation, require Microsoft Entra Conditional Access'),
 ('PIM for Azure resources: users must activate eligible assignments', '04-03.q3', 'id-governance/privileged-identity-management/pim-resource-roles-assign-roles.md', r'must activate an eligible role assig'),
 ('Default approvers: active Privileged Role and Global Administrators; lockout warning', '04-03.q5, x60', 'id-governance/privileged-identity-management/pim-how-to-change-default-settings.md', r'become the default approvers'),
 ('PIM resource audit shows assignments and activations', '04-03.q6', 'id-governance/privileged-identity-management/pim-how-to-use-audit-log.md', r'role activations'),
 ('Identity Secure Score shows alignment with Microsoft recommendations', '04-04.q8, x63', 'identity/monitoring-health/concept-identity-secure-score.md', r"aligned you are with Microsoft's recommendations"),
 ('Staged rollout tests groups with cloud authentication during migration', 'x11', 'identity/hybrid/connect/migrate-from-federation-to-cloud-authentication.md', r'Staged rollout is a great way'),
 ('Risky IP report for AD FS', 'x14', 'identity/hybrid/connect/how-to-connect-health-adfs-risky-ip-workbook.md', r'Risky IP report'),
 ('SAML signing certificate valid three years', 'x43', 'identity/enterprise-apps/tutorial-manage-certificates-for-federated-single-sign-on.md', r'valid for three years'),
]
EXTP = [
 ('gMSA extends managed account functionality over multiple servers', '03-01.q2', 'https://raw.githubusercontent.com/MicrosoftDocs/windowsserverdocs/main/WindowsServerDocs/identity/ad-ds/manage/group-managed-service-accounts/group-managed-service-accounts/group-managed-service-accounts-overview.md', r'extends that functionality over multiple servers', 'windowsserverdocs group-managed-service-accounts-overview.md'),
 ('Owner/Contributor manage a storage account but give no blob data access', '03-01.q5', 'https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/storage/blobs/authorize-access-azure-active-directory.md', r'Only roles explicitly defined for data access', 'azure-docs storage/blobs/authorize-access-azure-active-directory.md'),
]
LIVE = [
 ('Access policies block native client access; session policies block downloads to unmanaged devices', '03-04.q5, 03-04.q6, x48', 'https://learn.microsoft.com/defender-cloud-apps/proxy-intro-aad', 'To prevent bypassing this protection, admins should configure access policies to block native client access and allow only browser-based sessions.'),
 ('Users are routed to Defender for Cloud Apps for access and session controls', '03-04.q4', 'https://learn.microsoft.com/defender-cloud-apps/proxy-intro-aad', 'route your users first to Defender for Cloud Apps, where you can apply the access and session controls'),
 ('App connectors use provider APIs for visibility and control', '03-04.q2', 'https://learn.microsoft.com/defender-cloud-apps/connector-platform', 'App connectors use the APIs of app providers to enable greater visibility and control'),
 ('Defender for Endpoint integration extends cloud discovery with user and device information', '03-04.q1, x49', 'https://learn.microsoft.com/defender-cloud-apps/best-practices', 'Integrating Defender for Cloud Apps with Microsoft Defender for Endpoint gives you the ability to use cloud discovery beyond your corporate network'),
 ('Catalog of 31,000+ apps scored on 90+ risk factors', '03-04.q8', 'https://learn.microsoft.com/security/zero-trust/create-policies', 'catalog of over 31,000 cloud apps. The apps are ranked and scored based on more than 90 risk factors'),
]
out, fail = [], []
for claim, qs, path, pat in P:
    lines = open(f'{root}/{path}', encoding='utf-8', errors='ignore').read().split('\n')
    hit = next(((i, l) for i, l in enumerate(lines, 1) if re.search(pat, l, re.I)), None)
    (out if hit else fail).append((claim, qs, f'{path}:{hit[0]}' if hit else path, re.sub(r'\s+', ' ', hit[1]).strip()[:210] if hit else ''))
# group-based licensing nesting lives in the Microsoft 365 docs repo
m365 = urllib.request.urlopen('https://raw.githubusercontent.com/MicrosoftDocs/microsoft-365-docs/public/microsoft-365/admin/manage/manage-group-licenses.md').read().decode().split('\n')
h = next(((i, l) for i, l in enumerate(m365, 1) if "doesn't currently support nested groups" in l), None)
(out if h else fail).append(('Group-based licensing does not support nested groups', '01-02.q6', f'microsoft-365-docs admin/manage/manage-group-licenses.md:{h[0]}' if h else 'm365', h[1].strip()[:210] if h else ''))
for claim, qs_, url, pat, label in EXTP:
    body = urllib.request.urlopen(url).read().decode('utf-8', 'ignore').split('\n')
    h = next(((i, l) for i, l in enumerate(body, 1) if re.search(pat, l)), None)
    (out if h else fail).append((claim, qs_, f'{label}:{h[0]}' if h else label, h[1].strip()[:210] if h else ''))
for claim, qs_, url, quote in LIVE:
    out.append((claim, qs_, url + ' (live page, 25 Sep 2026)', quote))
qs = set()
for c in out:
    for q in c[1].split(', '): qs.add(q)
json.dump({'pins': out, 'fail': fail, 'questions': sorted(qs)}, open(os.path.join(OUT, 'answerkeys.json'), 'w'), indent=1)
print(len(out), 'pins,', len(fail), 'failed', [f[0] for f in fail]); print(len(qs), 'questions covered')
sys.exit(1 if fail else 0)
