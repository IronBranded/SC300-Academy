/* ======================================================================
   03-01  Identities for applications and Azure workloads
   ====================================================================== */
MODULES.push({
  id: '03-01', domain: '03', title: 'Choosing Workload Identities and Using Managed Identities', short: 'Managed Identities',
  group: 'Plan and implement identities for applications and Azure workloads',
  objectives: [
    'Select appropriate identities for applications and Azure workloads, including managed identities, service principals, user accounts, and managed service accounts',
    'Create managed identities',
    'Assign a managed identity to an Azure resource',
    'Use a managed identity assigned to an Azure resource to access other Azure resources'
  ],
  status: 'GA', verified: '',
  cost: { level: 'low', label: 'Low', est: 'Pennies: one storage account and a few transactions. Reuses sync01 from 01-04 as the compute, or a B1s Linux VM at about US$0.01 an hour.', meter: 'storage · transactions' },
  portal: 'Azure portal &gt; Managed Identities · resource &gt; Identity · resource &gt; Access control (IAM) · Entra admin center &gt; Entra ID &gt; Enterprise apps (application type: Managed Identities)',
  ms: [{ t: "Implement access management for Azure resources", u: "https://learn.microsoft.com/en-us/training/modules/implement-access-management-for-azure-resources/" }],
  sdk: '<code>Az.ManagedServiceIdentity</code> <code>Az.Resources</code> <code>az identity</code>',
  kql: '<code>AADManagedIdentitySignInLogs</code> <code>AADServicePrincipalSignInLogs</code> <code>AzureActivity</code>',
  prereq: ['00-01', '01-04'],
  tactical: 'A managed identity’s token is available to anything that can run code on the resource: one HTTP call to the instance metadata endpoint. An attacker with Virtual Machine Contributor can use Run Command or an extension to execute that call and walk away with a token for whatever the identity can reach - the pivot security researchers describe as the standard Azure lateral movement. In an investigation, <code>AADManagedIdentitySignInLogs</code> shows which resource each identity requested tokens for; <code>AzureActivity</code> shows who ran commands on the host. Keep managed identity role assignments as narrow as any admin’s.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>Code needs an identity to call APIs. The question is always which kind, and the answer turns on <strong>where the code runs</strong> and <strong>who manages the credential</strong>.</p>' +
      T('compare', ['Identity', 'Use when', 'Credential', 'Avoid when'], [
        ['<strong>Managed identity</strong>', 'Code runs on an Azure resource that supports it (VM, App Service, Functions, Logic Apps, AKS, Automation...)', 'None you can see: Azure rotates it', 'Code runs outside Azure'],
        ['<strong>Service principal</strong> (app registration)', 'Code runs outside Azure, in CI/CD, on-premises, or is a multitenant app', 'Certificate or <strong>federated credential</strong>; secret only if nothing else works', 'A managed identity would do'],
        ['<strong>User account</strong>', 'A human acting interactively', 'Password, MFA', 'Automation: it breaks on MFA and leaves with the employee'],
        ['<strong>gMSA / dMSA / sMSA</strong>', 'Windows services and scheduled tasks on-premises', 'AD manages and rotates the password', 'Anything cloud-hosted']
      ]) +
      '<p><strong>Workload identity federation</strong> closes the gap for code outside Azure: a GitHub Actions workflow, a Kubernetes pod or another cloud presents its own OIDC token, and Entra exchanges it for an access token for your app registration or user-assigned managed identity. No secret exists to leak.</p>' +
      Q('note', '<strong>On-premises managed service accounts.</strong> A <strong>gMSA</strong> works across several servers; an <strong>sMSA</strong> is tied to one; a <strong>dMSA</strong> (Windows Server 2025) replaces an existing service account and disables its old password. All three have passwords AD generates and rotates, so no human knows them.')) +
    S('mechanism', 'How it works under the hood',
      T('compare', ['', 'System-assigned', 'User-assigned'], [
        ['Lifecycle', 'Created with the resource, deleted with it', 'A standalone Azure resource with its own lifecycle'],
        ['Sharing', 'One resource only', 'Many resources can share one identity'],
        ['Pre-authorisation', 'Role assignments only after the resource exists', 'Assign roles before deploying the resource'],
        ['Good for', 'A single resource that needs its own identity', 'Scale sets, blue/green deployments, federated credentials']
      ]) +
      '<p>Either way the identity is a <strong>service principal</strong> of type <em>ManagedIdentity</em> in Entra. You cannot sign in as it, add credentials to it or grant it consent in the portal. It gets Azure access through <strong>Azure RBAC role assignments</strong> and Entra or Graph access through <strong>app role assignments</strong> made with PowerShell or Graph - there is no portal button for that.</p>' +
      C('bash', String.raw`
RG=rg-sc300-mi
az group create -n $RG -l canadacentral

# User-assigned identity (a resource in its own right)
az identity create -g $RG -n id-sc300-reader

# System-assigned identity on an existing VM, and attaching the user-assigned one
az vm identity assign -g rg-sc300-hybrid -n sync01
az vm identity assign -g rg-sc300-hybrid -n sync01 --identities $(az identity show -g $RG -n id-sc300-reader --query id -o tsv)

# Let the system-assigned identity read blobs in one storage account
SA=stsc300mi$RANDOM
az storage account create -g $RG -n $SA --sku Standard_LRS --allow-shared-key-access false
PRINCIPAL=$(az vm show -g rg-sc300-hybrid -n sync01 --query identity.principalId -o tsv)
az role assignment create --assignee-object-id $PRINCIPAL --assignee-principal-type ServicePrincipal \
    --role "Storage Blob Data Reader" --scope $(az storage account show -g $RG -n $SA --query id -o tsv)`) +
      '<p>Inside the resource, code asks the local endpoint for a token. On a VM that is the <strong>Instance Metadata Service</strong> at <code>169.254.169.254</code>, which answers only requests carrying the <code>Metadata: true</code> header; App Service and Functions expose <code>IDENTITY_ENDPOINT</code> and <code>IDENTITY_HEADER</code> instead. SDKs hide all of this behind <code>DefaultAzureCredential</code> or <code>ManagedIdentityCredential</code>.</p>' +
      C('powershell', String.raw`
# On sync01: get a token for Azure Storage from IMDS, then list blobs with it
$t = Invoke-RestMethod -Headers @{ Metadata = 'true' } -Uri 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://storage.azure.com/'
$h = @{ Authorization = "Bearer $($t.access_token)"; 'x-ms-version' = '2021-08-06' }
Invoke-RestMethod -Headers $h -Uri "https://$sa.blob.core.windows.net/lab?restype=container&comp=list"

# For the user-assigned identity, add &client_id=<its client ID> to the IMDS URI`) +
      C('powershell', String.raw`
# Grant a managed identity a Microsoft Graph application permission (no portal UI exists for this)
$graph = Get-MgServicePrincipal -Filter "appId eq '00000003-0000-0000-c000-000000000000'"
$role  = $graph.AppRoles | Where-Object Value -eq 'User.Read.All'
$mi    = Get-MgServicePrincipal -Filter "displayName eq 'id-sc300-reader'"
New-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $mi.Id -PrincipalId $mi.Id -ResourceId $graph.Id -AppRoleId $role.Id`)) +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Identity type', '-', 'System-assigned for one resource; user-assigned when shared or pre-authorised', 'Lifecycle should match the workload'],
        ['Role assignment scope', 'Whatever was clicked', 'The single resource, never the subscription', 'Anyone with code execution inherits it'],
        ['Data-plane roles', '-', 'Storage Blob Data Reader, Key Vault Secrets User...', 'Contributor does not read data; Owner is far too much'],
        ['Storage shared key access', 'Enabled', 'Disabled', 'Forces Entra auth, so the identity is the only way in'],
        ['Service principal credentials', 'Secret, up to 24 months in the portal', 'Certificate or federated credential', 'Secrets are copied and leaked'],
        ['Service accounts on-premises', 'User accounts with fixed passwords', 'gMSA, or dMSA on Windows Server 2025', 'Kerberoasting targets human-set passwords']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>403 from storage although the identity is Owner.</strong> Owner and Contributor are control-plane roles. Reading blobs needs a data-plane role such as Storage Blob Data Reader.</p>' +
      '<p><strong>New role assignment not working yet.</strong> Assignments can take several minutes to propagate, and the token cached before the change does not carry it. Request a new token.</p>' +
      '<p><strong>Code picks the wrong identity.</strong> A resource with both system- and user-assigned identities needs the client ID in the token request for the user-assigned one.</p>' +
      '<p><strong>Access lost after redeploying.</strong> The system-assigned identity was deleted with the old resource and a new one, with a new principal ID and no roles, came with the new resource.</p>' +
      '<p><strong>Graph permissions on a managed identity not visible in the portal.</strong> They exist; they were granted with PowerShell. Look under the service principal’s <em>Permissions</em>.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"an Azure Function must read Key Vault without storing credentials"', 'Managed identity + Key Vault data-plane role'],
        ['"several VMs in a scale set share one identity", "assign access before deployment"', 'User-assigned managed identity'],
        ['"identity must be deleted when the resource is deleted"', 'System-assigned managed identity'],
        ['"a GitHub Actions workflow deploys to Azure without secrets"', 'Workload identity federation (federated credential)'],
        ['"an on-premises app calls Microsoft Graph"', 'App registration / service principal with a certificate'],
        ['"a Windows service on several servers needs a domain account with an automatic password"', 'Group managed service account'],
        ['"minimise administrative effort for credential rotation"', 'Managed identity'],
        ['"grant a managed identity Microsoft Graph application permissions"', 'New-MgServicePrincipalAppRoleAssignment (no portal UI)']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
AADManagedIdentitySignInLogs
| where TimeGenerated > ago(1d)
| project TimeGenerated, ServicePrincipalName, ResourceDisplayName, IPAddress, ResultType
| order by TimeGenerated desc`) +
      C('kql', String.raw`
// Who ran code on a VM that holds a managed identity
AzureActivity
| where TimeGenerated > ago(7d)
| where OperationNameValue in~ ("MICROSOFT.COMPUTE/VIRTUALMACHINES/RUNCOMMAND/ACTION", "MICROSOFT.COMPUTE/VIRTUALMACHINES/EXTENSIONS/WRITE")
| project TimeGenerated, Caller, CallerIpAddress, _ResourceId, ActivityStatusValue`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('What are managed identities for Azure resources?', 'https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview') + '</li>' +
      '<li>' + L('Managed identity best practice recommendations', 'https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/managed-identity-best-practice-recommendations') + '</li>' +
      '<li>' + L('Workload identity federation', 'https://learn.microsoft.com/entra/workload-id/workload-identity-federation') + '</li>' +
      '<li>' + L('Group Managed Service Accounts overview', 'https://learn.microsoft.com/windows-server/identity/ad-ds/manage/group-managed-service-accounts/group-managed-service-accounts/group-managed-service-accounts-overview') + '</li>' +
      '<li>' + L('Delegated Managed Service Accounts overview in Windows Server 2025', 'https://learn.microsoft.com/windows-server/identity/ad-ds/manage/delegated-managed-service-accounts/delegated-managed-service-accounts-overview') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Give sync01 a system-assigned identity, read a blob with it without any credential on disk, then attach a user-assigned identity and grant it a Graph permission the portal cannot grant.',
    steps: [
      '<p>Start sync01. Create the storage account from the module with <strong>shared key access disabled</strong>, a container named <code>lab</code> and one text blob.</p>',
      '<p>Enable the <strong>system-assigned</strong> identity on sync01 (portal: VM &gt; Identity, or <code>az vm identity assign</code>). Find the new service principal in <strong>Entra ID &gt; Enterprise apps</strong> with the application type filter <em>Managed Identities</em>.</p>',
      '<p>From sync01, request an IMDS token and list the container. Expect <strong>403</strong>: the identity has no role yet.</p>',
      '<p>Assign <strong>Storage Blob Data Reader</strong> on the storage account only. Wait a few minutes, request a <em>new</em> token, and list again.</p>',
      '<p>Create the user-assigned identity <code>id-sc300-reader</code>, attach it to sync01, and grant it <code>User.Read.All</code> on Microsoft Graph with the PowerShell in the module. Request a Graph token from IMDS with its <code>client_id</code> and call <code>https://graph.microsoft.com/v1.0/users?$top=3</code>.</p>',
      '<p>Find both identities’ token requests in <strong>Sign-in logs &gt; Managed identity sign-ins</strong>.</p>',
      '<p>Write down, for each of four scenarios, which identity you would choose and why: a Logic App calling Graph; a Jenkins server on-premises deploying to Azure; a GitHub Actions workflow deploying to Azure; an IIS app pool on three on-premises servers.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Resources', items: [
        'Delete the resource group: <code>az group delete -n rg-sc300-mi --yes</code> (removes the storage account and the user-assigned identity)',
        'Remove the Graph app role assignment first if you keep the identity' ] },
      { bucket: '2', title: 'VMs', items: [
        'Disable the system-assigned identity on sync01, then deallocate sync01' ] },
      { bucket: '3', title: 'Verify', items: [
        'No service principal named id-sc300-reader remains in Enterprise applications' ] }
    ]
  },
  quiz: [
    { q: 'A build pipeline running on an on-premises Jenkins server must deploy to Azure. Which identity is most appropriate?', o: ['A system-assigned managed identity', 'A service principal with a certificate or federated credential', 'A dedicated user account with MFA excluded', 'A gMSA'], a: 1, obj: 0,
      why: 'Managed identities only exist on Azure resources. Outside Azure, use a service principal with the strongest credential available; never a user account for automation.' },
    { q: 'A Windows service runs on four on-premises servers and needs a domain account whose password nobody knows and AD rotates. What do you use?', o: ['A user account with a long password', 'A group managed service account', 'A standalone managed service account', 'A managed identity'], a: 1, obj: 0,
      why: 'A gMSA can be used on several servers; an sMSA is limited to one.' },
    { q: 'Ten VMs in a scale set must share one identity, and its access must be granted before the VMs exist. What do you create?', o: ['A system-assigned managed identity on each VM', 'A user-assigned managed identity', 'An app registration with a secret', 'A service account'], a: 1, obj: 1,
      why: 'User-assigned identities are standalone resources that can be shared and pre-authorised.' },
    { q: 'An identity must be removed automatically when its App Service app is deleted. Which do you assign?', o: ['User-assigned managed identity', 'System-assigned managed identity', 'Federated credential', 'Service principal'], a: 1, obj: 2,
      why: 'A system-assigned identity shares the lifecycle of its resource.' },
    { q: 'A VM’s managed identity is Owner of a storage account, but reading blobs with its token returns 403. Why?', o: ['IMDS is disabled', 'Owner is a control-plane role; reading blob data needs a data-plane role such as Storage Blob Data Reader', 'Managed identities cannot access storage', 'The token audience must be Microsoft Graph'], a: 1, obj: 3,
      why: 'Blob data access with Entra auth requires a Storage Blob Data role; Owner and Contributor manage the account, not its data.' },
    { q: 'How does code on a VM obtain a token for its managed identity?', o: ['From a secret in an environment variable', 'By calling the Instance Metadata Service at 169.254.169.254 with the Metadata: true header', 'By signing in with the VM name', 'From Key Vault'], a: 1, obj: 3,
      why: 'IMDS issues managed identity tokens to code on the VM; the SDKs wrap this call.' }
  ]
});

/* ======================================================================
   03-02  Enterprise applications
   ====================================================================== */
MODULES.push({
  id: '03-02', domain: '03', title: 'Enterprise Applications, Application Proxy, SaaS SSO and Consent', short: 'Enterprise Apps',
  group: 'Plan, implement, and monitor the integration of enterprise applications',
  objectives: [
    'Plan and implement settings for enterprise applications, including application-level and tenant-level settings',
    'Assign appropriate Microsoft Entra roles to users to manage enterprise applications',
    'Design and implement integration for on-premises apps by using Microsoft Entra Application Proxy',
    'Design and implement integration for software as a service (SaaS) apps',
    'Assign, classify, and manage users, groups, and app roles for enterprise applications',
    'Configure and manage user and admin consent',
    'Create and manage application collections'
  ],
  status: 'GA', verified: '',
  cost: { level: 'mid', label: 'Medium', est: 'Uses sync01 from 01-04 as the private network connector host and web server, so the VM meter runs while you work. Application Proxy itself is included with P1.', meter: 'hourly · sync01' },
  portal: 'Entra admin center &gt; Entra ID &gt; Enterprise apps · Consent and permissions · App launchers · Application proxy · Admin consent requests',
  ms: [{ t: "Plan and design the integration of enterprise apps for SSO", u: "https://learn.microsoft.com/en-us/training/modules/plan-design-integration-of-enterprise-apps-for-sso/" }, { t: "Implement and monitor the integration of enterprise apps for SSO", u: "https://learn.microsoft.com/en-us/training/modules/implement-monitor-integration-of-enterprise-apps-for-sso/" }],
  sdk: '<code>Microsoft.Graph.Applications</code> <code>Microsoft.Graph.Identity.SignIns</code>',
  kql: '<code>AuditLogs</code> <code>SigninLogs</code> <code>AADServicePrincipalSignInLogs</code>',
  prereq: ['01-04', '02-02'],
  tactical: 'Illicit consent is account takeover without a password. A user who clicks <em>Accept</em> on a malicious app hands it a refresh token for their mail and files that survives password resets and MFA; an admin who grants tenant-wide consent hands it the organisation. The audit trail is <em>Consent to application</em> (check <code>ConsentType</code> and whether it was admin consent), <em>Add delegated permission grant</em> and <em>Add app role assignment to service principal</em>. Remediation is to disable the service principal, remove the grants and app role assignments, and revoke the affected users’ sessions - in that order, or the app keeps working until its token expires.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>An <strong>enterprise application</strong> is a service principal: your tenant’s local instance of an application, whether you wrote it, bought it from the gallery, published it from on-premises or a user consented to it. Everything about <em>how that application is used in your tenant</em> - who may sign in, how SSO works, which permissions it holds, where users find it - is configured here. The application’s definition lives in its app registration (03-03), usually in someone else’s tenant.</p>' +
      T('compare', ['Level', 'Setting', 'Effect'], [
        ['Application', 'Enabled for users to sign in', 'No means nobody can get a token for it - the kill switch'],
        ['Application', 'Assignment required', 'Yes means only assigned users and groups can sign in'],
        ['Application', 'Visible to users', 'Shows or hides the tile in My Apps'],
        ['Application', 'Owners', 'Can manage SSO, provisioning and assignments for that app only'],
        ['Tenant', 'Consent and permissions: user consent settings', 'What users may consent to on their own'],
        ['Tenant', 'Admin consent requests', 'The workflow for everything they may not'],
        ['Tenant', 'Users can add gallery apps to My Apps', 'Self-service password-based SSO apps']
      ])) +
    S('mechanism', 'How it works under the hood',
      '<h3>Roles for managing applications</h3>' +
      T('compare', ['Role', 'Scope of power'], [
        ['Application Administrator', 'All app registrations and enterprise apps, <strong>including Application Proxy</strong>; can grant consent except Microsoft Graph application permissions'],
        ['Cloud Application Administrator', 'The same, <strong>without Application Proxy</strong>'],
        ['Application Developer', 'Register applications (even when user registration is off); becomes owner of what they create'],
        ['Privileged Role Administrator', 'Grants tenant-wide consent for any permission to any API, including Microsoft Graph app roles; Cloud Application, Application and AI Administrators can grant everything except Graph app roles. In the admin consent workflow, only Global Administrators approve Graph app role requests'],
        ['App owner', 'Full control of one app’s configuration and assignments'],
        ['Custom role', 'For example only <code>microsoft.directory/servicePrincipals/appRoleAssignedTo/update</code> to manage assignments']
      ]) +
      '<h3>Application Proxy</h3>' +
      '<p>Application Proxy publishes an internal <strong>web</strong> app at an external URL (<code>https://app-tenant.msappproxy.net</code> or a custom domain with your certificate). A <strong>private network connector</strong> on-premises holds an outbound connection to the service - no inbound firewall rules, no DMZ. With <strong>Microsoft Entra ID pre-authentication</strong> the user must sign in to Entra first, so Conditional Access applies before a single packet reaches your server; <strong>passthrough</strong> skips that and should be rare.</p>' +
      T('compare', ['Back-end authentication', 'SSO method'], [
        ['Windows Integrated Authentication', 'Kerberos constrained delegation: the connector’s computer account is trusted to delegate to the app’s SPN'],
        ['Header-based', 'Header-based SSO: Entra claims injected as HTTP headers'],
        ['Forms, own login page', 'Password-based SSO'],
        ['SAML on-premises', 'SAML SSO through the proxy']
      ]) +
      '<p>Use Application Proxy for browser-based web apps reached from any device without a client. Use Private Access (02-05) for anything non-HTTP (RDP, SMB, SSH) or when you want a VPN replacement. Both use the same connectors.</p>' +
      '<h3>SaaS apps</h3>' +
      '<p>Gallery apps come pre-configured for one or more SSO modes: <strong>SAML</strong>, <strong>OpenID Connect/OAuth</strong>, <strong>password-based</strong> or <strong>linked</strong>. For SAML you exchange configuration with the vendor:</p>' +
      T('config', ['Field', 'Meaning'], [
        ['Identifier (Entity ID)', 'Unique name of the SaaS app, from the vendor'],
        ['Reply URL (ACS URL)', 'Where Entra posts the SAML response'],
        ['Sign on URL', 'For SP-initiated sign-in from My Apps'],
        ['Attributes and claims', 'NameID format and source (UPN, mail, employeeid...) and extra claims'],
        ['SAML signing certificate', 'Valid three years by default; add a notification email, create the new one before expiry, upload it to the vendor, then make it active'],
        ['App Federation Metadata URL', 'Give this to the vendor instead of files where possible']
      ]) +
      '<p><strong>Automatic provisioning</strong> (SCIM) creates, updates and disables accounts in the SaaS app: you enter the tenant URL and secret token, map attributes, scope to <em>assigned users and groups</em>, and start the job; after the initial cycle, incremental cycles typically run every 20-40 minutes. <strong>Provision on demand</strong> tests one user; the <strong>provisioning logs</strong> record every action.</p>' +
      '<h3>Users, groups, app roles and classification</h3>' +
      '<p>Assign users or groups (group assignment needs P1, and <strong>nested groups are not expanded</strong>). If the app defines app roles, each assignment names a role, which arrives in the <code>roles</code> claim. To classify applications, tag them with custom security attributes and use the <em>filter for applications</em> condition in Conditional Access (02-02); to classify permissions, mark Microsoft Graph delegated permissions as <em>low impact</em> in <strong>Permission classifications</strong>, which the consent settings then use.</p>' +
      '<h3>Consent</h3>' +
      T('compare', ['User consent setting', 'Effect'], [
        ['Do not allow user consent', 'Every app needs an admin; pair with the admin consent workflow'],
        ['Allow user consent for apps from verified publishers, for selected permissions', 'Users consent only to low-impact classified permissions from verified publishers (and apps registered in your tenant)'],
        ['Let Microsoft manage your consent settings', 'Microsoft’s current recommended default, adjusted as threats change']
      ]) +
      '<p>The <strong>admin consent workflow</strong> lets users request an app they cannot consent to; designated reviewers approve or deny in <strong>Admin consent requests</strong>, and requests expire after the number of days you configure. Consent to delegated permissions creates <code>oauth2PermissionGrant</code> objects; consent to application permissions creates app role assignments.</p>' +
      C('powershell', String.raw`
# What an app can do in your tenant: delegated grants and application permissions
$sp = Get-MgServicePrincipal -Filter "displayName eq 'Suspicious Mail Helper'"
Get-MgOauth2PermissionGrant -Filter "clientId eq '$($sp.Id)'" | Select-Object ConsentType, PrincipalId, Scope
Get-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $sp.Id | Select-Object ResourceDisplayName, AppRoleId

# Contain it: disable sign-in, then remove what it was granted
Update-MgServicePrincipal -ServicePrincipalId $sp.Id -AccountEnabled:$false
Get-MgOauth2PermissionGrant -Filter "clientId eq '$($sp.Id)'" | ForEach-Object { Remove-MgOauth2PermissionGrant -OAuth2PermissionGrantId $_.Id }
Get-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $sp.Id | ForEach-Object { Remove-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $sp.Id -AppRoleAssignmentId $_.Id }`) +
      '<h3>Collections</h3>' +
      '<p>Administrators group apps into named sections of <strong>My Apps</strong> for users or groups - for example <em>HR tools</em> for all employees. They are managed in the admin center under <strong>Entra ID &gt; Enterprise apps &gt; App launchers</strong> (formerly <em>Collections</em>); users can also create personal collections in My Apps. A collection only arranges apps users already have access to - it grants nothing.</p>') +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Assignment required', 'No for most apps', 'Yes for anything sensitive', 'Otherwise every user in the tenant can get a token'],
        ['User consent', 'Microsoft managed', 'Verified publishers, low-impact permissions only, or none', 'Consent phishing'],
        ['Admin consent workflow', 'Off', 'On, with named reviewers and 30-day expiry', 'Gives users a path that is not "ask IT on Teams"'],
        ['Application Proxy pre-authentication', 'Microsoft Entra ID', 'Keep it', 'Passthrough bypasses Conditional Access'],
        ['Connectors per group', '1', '2 or more', 'Redundancy during updates'],
        ['SAML certificate notification email', 'Admin who created it', 'A shared mailbox', 'The admin who set it up three years ago has left']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>Users get AADSTS50105.</strong> Assignment is required and the user is not assigned - often because they are in a nested group.</p>' +
      '<p><strong>Application Proxy returns 500 with Kerberos SSO.</strong> The connector computer account is not trusted for delegation to the app’s SPN, or the SPN is wrong.</p>' +
      '<p><strong>Cloud Application Administrator cannot configure Application Proxy.</strong> That role deliberately excludes it; use Application Administrator.</p>' +
      '<p><strong>SAML SSO breaks on a date nobody remembered.</strong> The signing certificate expired.</p>' +
      '<p><strong>Admin approves a request but consent fails for Graph application permissions.</strong> Through the admin consent workflow, only a Global Administrator can approve requests for Microsoft Graph app roles; reviewers with other roles can view, block or deny them. Outside the workflow, a Privileged Role Administrator can grant that consent directly.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"only members of Finance may sign in to the app"', 'Assignment required = Yes, assign the Finance group'],
        ['"hide the app from My Apps but keep it working"', 'Visible to users = No'],
        ['"manage all enterprise apps except Application Proxy"', 'Cloud Application Administrator'],
        ['"publish an internal IIS app with Windows auth, no inbound firewall ports"', 'Application Proxy + KCD SSO'],
        ['"require MFA before the on-premises app is reached"', 'Application Proxy with Entra pre-authentication + CA'],
        ['"automatically create and disable accounts in the SaaS app"', 'Automatic provisioning (SCIM)'],
        ['"users see Approver or Viewer in the app"', 'App roles, assigned per user or group'],
        ['"users may consent only to low-risk permissions from verified publishers"', 'User consent setting + permission classifications'],
        ['"users request apps they cannot consent to"', 'Admin consent workflow'],
        ['"group HR apps together in My Apps for all employees"', 'Collections (App launchers)']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
AuditLogs
| where TimeGenerated > ago(30d)
| where OperationName in ("Consent to application", "Add delegated permission grant", "Add app role assignment to service principal")
| extend Actor = tostring(InitiatedBy.user.userPrincipalName), App = tostring(TargetResources[0].displayName)
| extend AdminConsent = tostring(TargetResources[0].modifiedProperties[0].newValue)
| project TimeGenerated, OperationName, Actor, App, AdminConsent, Result
| order by TimeGenerated desc`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('Properties of an enterprise application', 'https://learn.microsoft.com/entra/identity/enterprise-apps/application-properties') + '</li>' +
      '<li>' + L('Application Proxy overview', 'https://learn.microsoft.com/entra/identity/app-proxy/overview-what-is-app-proxy') + '</li>' +
      '<li>' + L('Kerberos constrained delegation for Application Proxy', 'https://learn.microsoft.com/entra/identity/app-proxy/how-to-configure-sso-with-kcd') + '</li>' +
      '<li>' + L('Configure how users consent to applications', 'https://learn.microsoft.com/entra/identity/enterprise-apps/configure-user-consent') + '</li>' +
      '<li>' + L('Configure the admin consent workflow', 'https://learn.microsoft.com/entra/identity/enterprise-apps/configure-admin-consent-workflow') + '</li>' +
      '<li>' + L('Automatic user provisioning', 'https://learn.microsoft.com/entra/identity/app-provisioning/user-provisioning') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Publish an internal web app through Application Proxy with Kerberos SSO, integrate one SaaS app with SAML, lock down consent, and group the results in My Apps.',
    steps: [
      '<p>On sync01, install IIS with Windows Authentication (<code>Install-WindowsFeature Web-Server, Web-Windows-Auth -IncludeManagementTools</code>), disable anonymous authentication on the default site, and register the SPN: <code>setspn -S HTTP/sync01.corp.lab.local CORP\\sync01$</code>.</p>',
      '<p>In the Entra admin center, confirm the private network connector from 02-05 is active on sync01 (install it now if you skipped 02-05). Publish <code>http://sync01.corp.lab.local</code> as an Application Proxy app with Entra ID pre-authentication.</p>',
      '<p>Configure <strong>Integrated Windows Authentication</strong> SSO with SPN <code>HTTP/sync01.corp.lab.local</code>. On dc01, set sync01’s computer account to trust delegation to that SPN (Kerberos only). Assign a synced user and browse to the external URL from outside the VNet.</p>',
      '<p>Add a gallery SAML app (for example <em>Microsoft Entra SAML Toolkit</em>), configure the Identifier, Reply URL and Sign on URL, assign <code>DYN-Sales</code>, and test SSO. Set the certificate notification email to a shared mailbox.</p>',
      '<p>Set <strong>Assignment required</strong> to Yes on the SAML app and sign in as a non-Sales user. Read the error.</p>',
      '<p>In <strong>Consent and permissions</strong>, allow user consent only for verified publishers and low-impact permissions, and classify <code>User.Read</code>, <code>openid</code>, <code>profile</code>, <code>email</code> and <code>offline_access</code> as low impact. Turn on the <strong>admin consent workflow</strong> with yourself as reviewer.</p>',
      '<p>As a normal user, open Graph Explorer (<code>https://aka.ms/ge</code>), sign in, and try to consent to <code>Mail.Read</code>. It is not classified low impact, so you get the <em>Approval required</em> prompt instead. Submit the request, then deny it as the reviewer in <strong>Admin consent requests</strong>.</p>',
      '<p>Assign <strong>Cloud Application Administrator</strong> to alex and confirm alex can edit the SAML app but not the Application Proxy app’s proxy settings.</p>',
      '<p>Create an app launcher (collection) named <em>Lab tools</em> with both apps and assign it to <code>DYN-Sales</code>. Check My Apps as a Sales user.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Configuration', items: [
        'Remove alex’s Cloud Application Administrator role',
        'Delete the SAML toolkit app and the Application Proxy app, or keep them for 03-04' ] },
      { bucket: '2', title: 'VMs', items: [
        'Deallocate sync01 and dc01' ] },
      { bucket: '3', title: 'Verify', items: [
        'The consent Validation KQL shows the denied request and no unexpected grants' ] }
    ]
  },
  quiz: [
    { q: 'An app must stay configured but nobody should be able to sign in to it during an investigation. Which setting?', o: ['Visible to users = No', 'Enabled for users to sign in = No', 'Assignment required = Yes', 'Remove all owners'], a: 1, obj: 0,
      why: 'Disabling sign-in stops token issuance for everyone while keeping the configuration.' },
    { q: 'A user must manage SSO for all SaaS apps but must not configure Application Proxy. Which role?', o: ['Application Administrator', 'Cloud Application Administrator', 'Application Developer', 'Global Administrator'], a: 1, obj: 1,
      why: 'Cloud Application Administrator has Application Administrator’s permissions except Application Proxy.' },
    { q: 'An internal IIS app uses Windows Integrated Authentication. It must be reachable from the internet with MFA, without inbound firewall rules. What do you implement?', o: ['A reverse proxy in the DMZ', 'Application Proxy with Entra pre-authentication and Kerberos constrained delegation', 'Private Access Quick Access only', 'Password-based SSO'], a: 1, obj: 2,
      why: 'Application Proxy’s outbound connector avoids inbound rules; pre-auth enables Conditional Access, and KCD provides SSO to Windows auth.' },
    { q: 'User accounts in a SaaS app must be created when users are assigned in Entra and disabled when they leave. What do you configure?', o: ['SAML SSO', 'Automatic provisioning with SCIM', 'Cross-tenant synchronization', 'An access review'], a: 1, obj: 3,
      why: 'SCIM provisioning creates, updates and disables accounts in the target app.' },
    { q: 'An app shows different menus to Viewers and Approvers based on the roles claim. What do you assign in the enterprise app?', o: ['Owners', 'Users and groups with app roles', 'Delegated permissions', 'A collection'], a: 1, obj: 4,
      why: 'App roles defined on the registration are assigned to users or groups in the enterprise app and appear in the roles claim.' },
    { q: 'Users may consent only to apps from verified publishers requesting permissions you consider low impact. What do you configure?', o: ['Do not allow user consent', 'User consent for verified publishers for selected permissions, plus permission classifications', 'Admin consent workflow only', 'App instance property lock'], a: 1, obj: 5,
      why: 'Permission classifications define "low impact"; the user consent setting limits consent to those permissions from verified publishers.' },
    { q: 'Users must be able to request access to apps they cannot consent to, and designated reviewers approve. What do you enable?', o: ['Admin consent workflow', 'Access packages', 'Access reviews', 'Terms of use'], a: 0, obj: 5,
      why: 'The admin consent workflow routes consent requests to reviewers.' },
    { q: 'All employees should see HR apps grouped under an HR section in My Apps. What do you create?', o: ['A dynamic group', 'A collection (app launcher) assigned to all employees', 'An administrative unit', 'An access package'], a: 1, obj: 6,
      why: 'Collections organise apps into sections in My Apps; they do not grant access.' }
  ]
});
