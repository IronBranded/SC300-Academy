/* ======================================================================
   03-03  App registrations
   ====================================================================== */
MODULES.push({
  id: '03-03', domain: '03', title: 'App Registrations: Authentication, API Permissions and App Roles', short: 'App Registrations',
  group: 'Plan and implement app registrations',
  objectives: [
    'Plan for app registrations',
    'Create app registrations',
    'Configure app authentication',
    'Configure API permissions',
    'Create app roles'
  ],
  status: 'GA', verified: '',
  cost: { level: 'none', label: '$0', est: '$0. Directory objects only.', meter: 'none' },
  portal: 'Entra admin center &gt; Entra ID &gt; App registrations · User settings (Users can register applications)',
  ms: [{ t: "Implement app registration", u: "https://learn.microsoft.com/en-us/training/modules/implement-app-registration/" }, { t: "Register apps using Microsoft Entra ID", u: "https://learn.microsoft.com/en-us/training/modules/register-apps-use-microsoft-entra-id/" }],
  sdk: '<code>Microsoft.Graph.Applications</code>',
  kql: '<code>AuditLogs</code> <code>AADServicePrincipalSignInLogs</code> <code>MicrosoftGraphActivityLogs</code>',
  prereq: ['00-01', '03-02'],
  tactical: 'Adding a credential to an application that already holds permissions is the quietest persistence in Entra: no new app, no new consent, just a new secret or certificate on something trusted. Microsoft’s January 2024 guidance on Midnight Blizzard describes the actor compromising a legacy test OAuth application that already held elevated access, creating more OAuth apps, and using the legacy app to grant itself the Exchange Online full_access_as_app role; one of the Defender for Cloud Apps detections it lists fires when an app’s EWS calls jump within days of a credential update. Alert on <em>Update application - Certificates and secrets management</em> and <em>Add service principal credentials</em>, then compare with <code>AADServicePrincipalSignInLogs</code>: a first-ever sign-in for an app from an IP it has never used, shortly after a credential was added, is the pattern.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>An <strong>app registration</strong> is the global definition of an application: its identity (<em>application ID</em>, also called client ID), who may sign in to it, its redirect URIs, its credentials, the APIs it wants and the roles and scopes it exposes. It lives in one tenant - the home tenant. A <strong>service principal</strong> is the local instance of that definition in each tenant that uses it, and it is what gets permissions, assignments and Conditional Access.</p>' +
      T('compare', ['Supported account types', '<code>signInAudience</code>', 'Use'], [
        ['This organisational directory only', '<code>AzureADMyOrg</code>', 'Internal line-of-business apps'],
        ['Any organisational directory', '<code>AzureADMultipleOrgs</code>', 'SaaS for businesses'],
        ['Any organisational directory and personal Microsoft accounts', '<code>AzureADandPersonalMicrosoftAccount</code>', 'Broad consumer and business apps'],
        ['Personal Microsoft accounts only', '<code>PersonalMicrosoftAccount</code>', 'Consumer apps']
      ]) +
      '<p><strong>Planning</strong> covers who may register apps (by default every user can; restrict with <em>Users can register applications</em> = No and grant Application Developer to the few who should), ownership (at least two owners, never a departed employee), naming, the credential type, and which permissions the app will need before anyone asks for consent.</p>') +
    S('mechanism', 'How it works under the hood',
      '<h3>Authentication configuration</h3>' +
      T('config', ['Platform', 'Redirect URI', 'Flow'], [
        ['Web', 'Server-side URL, HTTPS', 'Authorization code; confidential client with a credential'],
        ['Single-page application', 'Browser URL', 'Authorization code with PKCE, no secret'],
        ['Mobile and desktop', '<code>msal{clientId}://auth</code> or loopback', 'Public client; PKCE'],
        ['None (daemon)', '-', 'Client credentials: the app’s own identity']
      ]) +
      '<p>Leave <strong>implicit grant</strong> (ID and access token checkboxes) off unless a legacy SPA requires it, and leave <strong>Allow public client flows</strong> off unless the app genuinely needs device code or resource-owner password flows. <strong>Token configuration</strong> adds optional claims and the <code>groups</code> claim - choose <em>groups assigned to the application</em> for large tenants to avoid overage.</p>' +
      T('compare', ['Credential', 'Verdict'], [
        ['Federated credential', 'Best: no secret exists (GitHub Actions, Kubernetes, another cloud, or a managed identity as the credential)'],
        ['Certificate', 'Good: the private key can live in a Key Vault or HSM'],
        ['Client secret', 'Last resort: portal maximum 24 months, and it ends up in config files']
      ]) +
      '<h3>API permissions</h3>' +
      T('compare', ['', 'Delegated permission (scope)', 'Application permission (app role)'], [
        ['Acts as', 'The signed-in user', 'The application itself, no user'],
        ['Effective access', 'Intersection of the permission and what the user can do', 'Everything the permission allows, tenant-wide'],
        ['Consent', 'User or admin, depending on the permission and consent settings', '<strong>Always admin consent</strong>'],
        ['Token claim', '<code>scp</code>', '<code>roles</code>'],
        ['Example', '<code>Mail.Read</code>: read the signed-in user’s mail', '<code>Mail.Read</code>: read every mailbox']
      ]) +
      '<p>The app registration only <em>requests</em> permissions (<code>requiredResourceAccess</code>). Nothing is granted until consent creates delegated grants or app role assignments on the service principal - which is why <strong>Grant admin consent for &lt;tenant&gt;</strong> is a separate button.</p>' +
      '<h3>Exposing an API and app roles</h3>' +
      '<p>An app that is itself an API sets an <strong>Application ID URI</strong> (<code>api://{clientId}</code> by default), defines <strong>scopes</strong> for delegated access and can <strong>pre-authorise</strong> its own client apps to skip consent. <strong>App roles</strong> have a display name, a <code>value</code> that appears in the <code>roles</code> claim, and <strong>allowed member types</strong>: <em>Users/Groups</em> (assigned in the enterprise app, 03-02), <em>Applications</em> (they appear to other apps as application permissions), or both.</p>' +
      C('powershell', String.raw`
$graphId = '00000003-0000-0000-c000-000000000000'
$app = New-MgApplication -DisplayName 'SC300 Expenses' -SignInAudience 'AzureADMyOrg' -Web @{ RedirectUris = @('https://localhost:5001/signin-oidc') } -RequiredResourceAccess @(
    @{ ResourceAppId = $graphId; ResourceAccess = @(
        @{ Id = 'e1fe6dd8-ba31-4d61-89e7-88639da4683d'; Type = 'Scope' }     # User.Read (delegated)
        @{ Id = 'df021288-bdef-4463-88db-98f22de89214'; Type = 'Role' } ) }  # User.Read.All (application)
) -AppRoles @(
    @{ Id = (New-Guid).Guid; DisplayName = 'Approver'; Value = 'Expense.Approve'; Description = 'Approve expense reports'; AllowedMemberTypes = @('User'); IsEnabled = $true }
    @{ Id = (New-Guid).Guid; DisplayName = 'Sync job'; Value = 'Expense.Sync'; Description = 'Daemon access'; AllowedMemberTypes = @('Application'); IsEnabled = $true }
)
$sp = New-MgServicePrincipal -AppId $app.AppId           # the local instance that permissions attach to

# Lab only: a short-lived secret. Prefer a certificate or a federated credential.
Add-MgApplicationPassword -ApplicationId $app.Id -PasswordCredential @{ DisplayName = 'lab'; EndDateTime = (Get-Date).AddDays(7) }

# Admin consent for the application permission = an app role assignment on the service principal
$graph = Get-MgServicePrincipal -Filter "appId eq '$graphId'"
New-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $sp.Id -PrincipalId $sp.Id -ResourceId $graph.Id -AppRoleId 'df021288-bdef-4463-88db-98f22de89214'`)) +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Users can register applications', 'Yes', 'No, with Application Developer for named people', 'Every app is an identity someone must govern'],
        ['Owners', 'The creator', 'Two or more current staff', 'Orphaned apps keep their permissions'],
        ['Credential type', 'Secret', 'Federated credential or certificate', 'Secrets leak'],
        ['Implicit grant', 'Off', 'Off', 'Tokens in URLs'],
        ['Allow public client flows', 'No', 'No unless required', 'Enables device code and ROPC for the app'],
        ['App instance property lock', 'On for new multitenant apps', 'On', 'Stops other tenants changing credentials on your app’s service principal'],
        ['Application permissions', '-', 'The narrowest available (Sites.Selected over Sites.Read.All)', 'Application permissions are tenant-wide']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>AADSTS50011 reply URL mismatch.</strong> The redirect URI in the request does not exactly match one registered on the right platform.</p>' +
      '<p><strong>Permission added, token still lacks it.</strong> Nobody granted consent. Requesting and granting are separate.</p>' +
      '<p><strong>Roles claim empty.</strong> The user has no app role assignment, or the assignment is through a nested group.</p>' +
      '<p><strong>Daemon gets 403 from Graph.</strong> It was given a delegated permission; client credentials only carry application permissions.</p>' +
      '<p><strong>Multitenant app not visible in a customer tenant.</strong> No one there has consented, so no service principal exists yet.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"only users in your organisation can sign in"', 'Supported account type: this organisational directory only'],
        ['"a background service reads all users with no signed-in user"', 'Application permission + admin consent'],
        ['"the app acts on behalf of the signed-in user"', 'Delegated permission'],
        ['"a JavaScript SPA with no backend"', 'SPA platform, authorization code with PKCE'],
        ['"prevent users from creating app registrations"', 'Users can register applications = No; Application Developer role'],
        ['"the app must know whether the user is an Approver"', 'App role with allowed member type Users/Groups'],
        ['"another daemon app needs a permission defined by your API"', 'App role with allowed member type Applications'],
        ['"avoid storing a secret for a GitHub workflow"', 'Federated credential'],
        ['"which object holds the redirect URIs, and which holds the permissions granted"', 'App registration / service principal']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
AuditLogs
| where TimeGenerated > ago(30d)
| where OperationName has_any ("Certificates and secrets management", "Add service principal credentials", "Update application", "Add owner to application")
| extend Actor = coalesce(tostring(InitiatedBy.user.userPrincipalName), tostring(InitiatedBy.app.displayName)), App = tostring(TargetResources[0].displayName)
| project TimeGenerated, OperationName, Actor, App, Result`) +
      C('kql', String.raw`
// First sign-in of each service principal from each IP in the last 7 days
AADServicePrincipalSignInLogs
| where TimeGenerated > ago(7d)
| summarize First = min(TimeGenerated), Count = count() by ServicePrincipalName, AppId, IPAddress
| order by First desc`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('Application and service principal objects', 'https://learn.microsoft.com/entra/identity-platform/app-objects-and-service-principals') + '</li>' +
      '<li>' + L('Register an application', 'https://learn.microsoft.com/entra/identity-platform/quickstart-register-app') + '</li>' +
      '<li>' + L('Permissions and consent overview', 'https://learn.microsoft.com/entra/identity-platform/permissions-consent-overview') + '</li>' +
      '<li>' + L('Add app roles and get them from a token', 'https://learn.microsoft.com/entra/identity-platform/howto-add-app-roles-in-apps') + '</li>' +
      '<li>' + L('App instance property lock', 'https://learn.microsoft.com/entra/identity-platform/howto-configure-app-instance-property-locks') + '</li>' +
      '<li>' + L('Microsoft Threat Intelligence: Midnight Blizzard guidance for responders', 'https://www.microsoft.com/en-us/security/blog/2024/01/25/midnight-blizzard-guidance-for-responders-on-nation-state-attack/') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Register one app with both permission types and two kinds of app role, then prove each by looking at real tokens.',
    steps: [
      '<p>Set <strong>Users can register applications</strong> to No. Assign Application Developer to alex and confirm alex can still register an app.</p>',
      '<p>Run the PowerShell in the module to create <em>SC300 Expenses</em>. In the portal, compare the app registration’s blades with its enterprise application’s blades and note which settings live where.</p>',
      '<p>On <strong>API permissions</strong>, observe the <em>Not granted</em> status. Grant admin consent and watch both permissions change.</p>',
      '<p>Add a second owner. Replace the lab secret with a self-signed certificate (<code>New-SelfSignedCertificate</code>, upload the .cer) and delete the secret.</p>',
      '<p>In the enterprise app, assign a Sales user the <strong>Approver</strong> role. Sign in to <code>https://jwt.ms</code> through the app (add <code>https://jwt.ms</code> as a SPA redirect URI and use an authorize URL with <code>response_type=code</code> or the MSAL sample) and find <code>roles: ["Expense.Approve"]</code>.</p>',
      '<p>With the certificate, request a client-credentials token for <code>https://graph.microsoft.com/.default</code> (<code>Connect-MgGraph -ClientId -TenantId -CertificateThumbprint</code>) and call <code>Get-MgUser -Top 3</code>. Decode the token and find the <code>roles</code> claim with <code>User.Read.All</code>.</p>',
      '<p>Run the Validation queries and find your own credential changes.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Configuration', items: [
        'Delete the <em>SC300 Expenses</em> app registration (its service principal goes with it)',
        'Remove the certificate from your local store',
        'Remove alex’s Application Developer role; leave user registration off' ] },
      { bucket: '2', title: 'Verify', items: [
        '<strong>App registrations &gt; Deleted applications</strong> lists the app - it can be restored for 30 days, then it is gone' ] }
    ]
  },
  quiz: [
    { q: 'Only a small team should be able to create app registrations. What do you configure?', o: ['Set Users can register applications to No and assign Application Developer to the team', 'Remove the Application Administrator role from everyone', 'Enable the admin consent workflow', 'Create a restricted administrative unit'], a: 0, obj: 0,
      why: 'Turning off user registration and granting Application Developer is the least-privilege way to allow a few people to register apps.' },
    { q: 'An internal app must allow only accounts in your tenant. Which supported account type?', o: ['Accounts in any organisational directory', 'Accounts in this organisational directory only', 'Personal Microsoft accounts only', 'Any directory and personal accounts'], a: 1, obj: 1,
      why: 'AzureADMyOrg restricts sign-in to the home tenant.' },
    { q: 'Where are an application’s redirect URIs and credentials stored?', o: ['On the service principal in each tenant', 'On the app registration (application object)', 'In the enterprise app’s properties', 'In the user consent settings'], a: 1, obj: 1,
      why: 'The application object holds the global definition, including redirect URIs and credentials; permissions granted in a tenant attach to the service principal.' },
    { q: 'A single-page JavaScript app with no backend needs to sign users in. How do you configure authentication?', o: ['Web platform with a client secret', 'SPA platform using authorization code flow with PKCE', 'Enable implicit grant for access tokens', 'Allow public client flows'], a: 1, obj: 2,
      why: 'SPAs register redirect URIs on the SPA platform and use auth code with PKCE; implicit grant is legacy.' },
    { q: 'A nightly job must read every user’s profile with no signed-in user. Which permission and consent?', o: ['Delegated User.Read, user consent', 'Application User.Read.All, admin consent', 'Delegated User.Read.All, user consent', 'No permission; use the job’s owner'], a: 1, obj: 3,
      why: 'Unattended access uses application permissions, which always require admin consent.' },
    { q: 'The app shows a Mail.Read permission as "Not granted for tenant". What is true?', o: ['The app can already read mail', 'The permission is only requested; consent has not created a grant', 'The permission is deprecated', 'The app registration is disabled'], a: 1, obj: 3,
      why: 'Requesting a permission in the registration does not grant it; admin or user consent must create the grant.' },
    { q: 'Your API must let a partner daemon application call it without a user, with its own permission name. What do you create?', o: ['A scope in Expose an API', 'An app role with allowed member type Applications', 'An app role with allowed member type Users/Groups', 'An optional claim'], a: 1, obj: 4,
      why: 'App roles allowed for Applications appear to other apps as application permissions of your API.' }
  ]
});

/* ======================================================================
   03-04  Defender for Cloud Apps
   ====================================================================== */
MODULES.push({
  id: '03-04', domain: '03', title: 'Managing App Access with Microsoft Defender for Cloud Apps', short: 'Defender for Cloud Apps',
  group: 'Manage and monitor app access by using Microsoft Defender for Cloud Apps',
  objectives: [
    'Configure and analyze cloud discovery results by using Defender for Cloud Apps',
    'Configure connected apps',
    'Implement application-enforced restrictions',
    'Configure Conditional Access app control',
    'Create access and session policies in Defender for Cloud Apps',
    'Implement and manage policies for OAuth apps',
    'Manage the Cloud app catalog'
  ],
  status: 'GA', verified: '',
  cost: { level: 'none', label: '$0', est: '$0. Defender for Cloud Apps is included in the Microsoft 365 E5 trial. Cloud discovery uses a sample or exported firewall log.', meter: 'none' },
  portal: 'Microsoft Defender portal (security.microsoft.com) &gt; Cloud apps: Cloud discovery · Cloud app catalog · OAuth apps · App governance · Policies · Settings &gt; Connected apps',
  ms: [{ t: "Plan and design the integration of enterprise apps for SSO", u: "https://learn.microsoft.com/en-us/training/modules/plan-design-integration-of-enterprise-apps-for-sso/" }, { t: "Implement and monitor the integration of enterprise apps for SSO", u: "https://learn.microsoft.com/en-us/training/modules/implement-monitor-integration-of-enterprise-apps-for-sso/" }],
  sdk: '<code>ExchangeOnlineManagement</code> <code>Microsoft.Online.SharePoint.PowerShell</code>',
  kql: '<code>CloudAppEvents</code> <code>OAuthAppInfo</code> (advanced hunting)',
  prereq: ['02-02', '03-02'],
  tactical: 'Cloud discovery is an exfiltration detector as much as a shadow IT report. Ransomware operators routinely stage data with sync tools to consumer storage before encryption, and those uploads show up as a new or spiking app in discovery - by user and device when discovery comes from Defender for Endpoint. In hunting, <code>CloudAppEvents</code> gives activity inside connected apps (mail rules, sharing, downloads) and <code>OAuthAppInfo</code> gives the privilege level, verified publisher, risk score, consent and last use of every OAuth app, which is the fastest way to spot a consented app that should not exist.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>Defender for Cloud Apps is Microsoft’s cloud access security broker, now managed entirely in the Microsoft Defender portal. It answers four questions, and each objective in this group maps to one of them.</p>' +
      T('compare', ['Question', 'Capability', 'Data source'], [
        ['Which cloud apps are people using?', '<strong>Cloud discovery</strong>, scored against the <strong>cloud app catalog</strong>', 'Firewall and proxy logs, Defender for Endpoint, Global Secure Access'],
        ['What is happening inside the apps we sanction?', '<strong>Connected apps</strong> (API connectors)', 'The app’s own APIs'],
        ['Can we control a session while it happens?', '<strong>Conditional Access app control</strong>: access and session policies', 'Traffic routed through Defender for Cloud Apps'],
        ['Which OAuth apps hold access to our data?', '<strong>App governance</strong> and OAuth app policies', 'Entra consent and Graph activity']
      ])) +
    S('mechanism', 'How it works under the hood',
      '<h3>Cloud discovery and the catalog</h3>' +
      '<p><strong>Snapshot reports</strong> come from a log file you upload once; <strong>continuous reports</strong> come from a log collector (a Docker container that receives syslog or FTP from your firewall), or natively from <strong>Defender for Endpoint</strong> and Global Secure Access. Each discovered app is matched to the <strong>cloud app catalog</strong> - tens of thousands of apps, each with a <strong>risk score from 0 to 10</strong> built from general, security, compliance and legal factors. You can change how factors are weighted, request a score review, and add custom apps.</p>' +
      '<p>Tag apps <strong>Sanctioned</strong>, <strong>Unsanctioned</strong> or <strong>Monitored</strong>. With Defender for Endpoint integration and <em>Enforce app access</em> on, unsanctioned apps are blocked on managed devices through network protection indicators; for other gateways, export a block script.</p>' +
      '<h3>Connected apps</h3>' +
      '<p>An <strong>app connector</strong> uses the app’s API, authorised with an admin account or app consent, to pull activity, files, accounts and configuration - Microsoft 365, Azure, AWS, Google Cloud, Salesforce, GitHub, ServiceNow and others. For Microsoft 365 you choose components (Entra users and groups, management events, sign-ins, apps, Office 365 activities, files). Connected apps enable activity and file policies and governance actions such as suspending a user or removing a share.</p>' +
      '<h3>Application-enforced restrictions</h3>' +
      '<p>This is a Conditional Access session control (<em>Use app enforced restrictions</em>, 02-03), paired with a setting in the app itself: SharePoint and OneDrive allow limited, web-only access from unmanaged devices, and Outlook on the web goes read-only. No traffic passes through Defender for Cloud Apps; the app enforces it.</p>' +
      C('powershell', String.raw`
# The app side of application-enforced restrictions
Connect-SPOService -Url https://contoso-admin.sharepoint.com
Set-SPOTenant -ConditionalAccessPolicy AllowLimitedAccess

Connect-ExchangeOnline
Set-OwaMailboxPolicy -Identity OwaMailboxPolicy-Default -ConditionalAccessPolicy ReadOnly`) +
      '<h3>Conditional Access app control</h3>' +
      '<p>A Conditional Access policy with the session control <strong>Use Conditional Access App Control</strong> (Monitor only, Block downloads, or <em>Use custom policy</em>) hands the session to Defender for Cloud Apps. Entra-integrated apps are onboarded automatically; apps using another IdP are onboarded manually. Users of <strong>Microsoft Edge for Business</strong> get in-browser protection; other browsers are routed through a reverse proxy, visible as a <code>.mcas.ms</code> suffix on the app’s URL.</p>' +
      T('compare', ['Policy type', 'Evaluated', 'Example'], [
        ['<strong>Access policy</strong>', 'At sign-in', 'Block access to Salesforce from unmanaged devices; block native desktop clients so users cannot bypass session control'],
        ['<strong>Session policy</strong>', 'On each activity in the session', 'Block download of files labelled Confidential; block paste; protect on download with a sensitivity label; monitor only']
      ]) +
      '<h3>OAuth apps</h3>' +
      '<p><strong>App governance</strong> watches OAuth apps registered in Entra: their permissions, publisher verification, data access through Graph and usage. Its policies alert on - and can automatically <strong>disable</strong> - apps that match conditions such as <em>new app with high-privilege permissions</em>, <em>overprivileged</em> (permissions never used), <em>unused for 90 days</em> or unusual data access, and built-in threat detections flag known malicious behaviour. The <strong>OAuth apps</strong> page lets you review each app’s users and permissions and approve or ban it. App governance covers OAuth apps registered in Microsoft Entra ID, Google and Salesforce, and can take up to 10 hours to appear after you turn it on.</p>') +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Discovery source', 'None', 'Defender for Endpoint integration (continuous), plus log collector for network-only devices', 'Per user and per device, not just per IP'],
        ['Enforce app access', 'Off', 'On once unsanctioned list is reviewed', 'Tagging alone blocks nothing'],
        ['Microsoft 365 app connector', 'Off', 'On, all components', 'Activity policies and CloudAppEvents need it'],
        ['Access policy for native clients', 'None', 'Block native clients for apps under session control', 'Desktop clients bypass the proxy'],
        ['App governance policies', 'Predefined', 'Add high-privilege and unused-app policies with auto-disable', 'Stale high-privilege apps are the target'],
        ['Risk score factors', 'Defaults', 'Weight compliance factors your regulators care about', 'The score should reflect your risk']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>Session policy never triggers.</strong> The CA policy does not use Conditional Access App Control, or the user signed in through a native client.</p>' +
      '<p><strong>Session controls never start, or sign-in loops.</strong> A Conditional Access policy blocks the <em>Microsoft Defender for Cloud Apps - Session Controls</em> enterprise app that Conditional Access app control relies on; allow it.</p>' +
      '<p><strong>Discovery shows IPs, not users.</strong> The firewall log has no user field; use Defender for Endpoint or GSA as the source.</p>' +
      '<p><strong>Unsanctioned app still reachable.</strong> Enforce app access is off, the device is not onboarded to Defender for Endpoint, or you checked too soon: Microsoft documents up to three hours from marking an app unsanctioned to the block reaching devices.</p>' +
      '<p><strong>SharePoint limited access not applied.</strong> The SharePoint tenant setting was changed but the CA policy with app enforced restrictions was not created (or vice versa) - both halves are required.</p>' +
      '<p><strong>Looking for ID Protection alerts here.</strong> They moved to Defender XDR.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"identify which cloud apps users access from the firewall logs"', 'Cloud discovery (snapshot or log collector)'],
        ['"block apps with a risk score below 5 on managed devices"', 'Unsanctioned tag + Defender for Endpoint integration'],
        ['"monitor file sharing and admin activity in Salesforce via API"', 'Connected app (app connector)'],
        ['"unmanaged devices: SharePoint in the browser, no download"', 'Application-enforced restrictions'],
        ['"block download of confidential files from any cloud app on unmanaged devices"', 'Conditional Access app control + session policy'],
        ['"block access to an app from unmanaged devices at sign-in"', 'Access policy'],
        ['"detect OAuth apps with high privileges that are not used"', 'App governance policy'],
        ['"view the risk score and compliance details of an app"', 'Cloud app catalog']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
// Advanced hunting (Defender portal). The table refreshes hourly with a full snapshot twice a month,
// so take the latest record per app. Needs app governance turned on.
OAuthAppInfo
| summarize arg_max(Timestamp, *) by OAuthAppId
| where PrivilegeLevel == "High"
| project AppName, OAuthAppId, AppOrigin, Publisher = tostring(VerifiedPublisher.DisplayName), IsAdminConsented, ConsentedUsersCount, RiskScore, LastUsedTime, AppStatus
| order by RiskScore desc`) +
      C('kql', String.raw`
// File downloads in the last day, by user and app (needs the Microsoft 365 connector)
CloudAppEvents
| where Timestamp > ago(1d)
| where ActionType == "FileDownloaded"
| project Timestamp, AccountDisplayName, Application, ObjectName, IPAddress, DeviceType`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('Set up cloud discovery', 'https://learn.microsoft.com/defender-cloud-apps/set-up-cloud-discovery') + '</li>' +
      '<li>' + L('Connect apps to get visibility and control', 'https://learn.microsoft.com/defender-cloud-apps/connector-platform') + '</li>' +
      '<li>' + L('Conditional Access app control', 'https://learn.microsoft.com/defender-cloud-apps/proxy-intro-aad') + '</li>' +
      '<li>' + L('Create access policies', 'https://learn.microsoft.com/defender-cloud-apps/access-policy-aad') + '</li>' +
      '<li>' + L('Create session policies', 'https://learn.microsoft.com/defender-cloud-apps/session-policy-aad') + '</li>' +
      '<li>' + L('App governance', 'https://learn.microsoft.com/defender-cloud-apps/app-governance-manage-app-governance') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Discover apps from a sample log, sanction and unsanction some, connect Microsoft 365, then block downloads of labelled files from unmanaged devices with a session policy.',
    steps: [
      '<p>In the Defender portal, open <strong>Cloud apps &gt; Cloud discovery</strong>, create a snapshot report and upload the sample log offered for your firewall type. Review the top apps by risk score.</p>',
      '<p>Open three discovered apps in the <strong>Cloud app catalog</strong>. Read the risk factors, tag one Sanctioned and one Unsanctioned, and look at the generated block script.</p>',
      '<p>In <strong>Settings &gt; Cloud apps &gt; Connected apps &gt; App connectors</strong>, confirm Microsoft 365 is connected with all components selected.</p>',
      '<p>Implement application-enforced restrictions: run the SharePoint cmdlet from the module and enable the CA policy CA010 from 02-03 if it is not already on.</p>',
      '<p>Create a CA policy for <code>DYN-Sales</code> targeting Office 365 with session control <strong>Use Conditional Access App Control &gt; Use custom policy</strong> (report-only off, but scoped to Sales only).</p>',
      '<p>In Defender for Cloud Apps, create a <strong>session policy</strong>: control file download, filter on unmanaged devices, action <em>Block</em>. Create an <strong>access policy</strong> blocking native clients for the same users.</p>',
      '<p>As a Sales user on an unmanaged browser, open OneDrive and try to download a file. Note the URL suffix or Edge lock icon, and the block page.</p>',
      '<p>Open <strong>App governance &gt; Policies</strong>, create a policy for apps with high-privilege permissions and no use in 30 days, action alert only. Then run the <code>OAuthAppInfo</code> hunting query.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Configuration', items: [
        'Disable the session and access policies and the CA App Control policy, or Sales users stay proxied',
        'Revert SharePoint with <code>Set-SPOTenant -ConditionalAccessPolicy AllowFullAccess</code> if you do not want the restriction' ] },
      { bucket: '2', title: 'Verify', items: [
        'A Sales user can download from OneDrive again, and no <code>.mcas.ms</code> suffix appears' ] }
    ]
  },
  quiz: [
    { q: 'You must continuously discover cloud apps used on managed Windows devices, attributed to users and devices, without deploying a log collector. What do you use?', o: ['Snapshot reports', 'Defender for Endpoint integration', 'An app connector', 'Conditional Access app control'], a: 1, obj: 0,
      why: 'Defender for Endpoint feeds cloud discovery continuously with user and device context.' },
    { q: 'Administrators need activity logs and file sharing details from Salesforce through its API. What do you configure?', o: ['Cloud discovery', 'An app connector (connected app)', 'A session policy', 'App governance'], a: 1, obj: 1,
      why: 'Connected apps use the vendor’s API for activities, files and governance actions.' },
    { q: 'Unmanaged devices must get browser-only, no-download access to SharePoint Online, enforced by SharePoint itself. What do you implement?', o: ['Conditional Access app control', 'Application-enforced restrictions', 'An access policy', 'Unsanctioning SharePoint'], a: 1, obj: 2,
      why: 'App enforced restrictions tell SharePoint to apply its limited-access experience; no proxy is involved.' },
    { q: 'Which Conditional Access session control sends a user’s session through Defender for Cloud Apps?', o: ['Use app enforced restrictions', 'Use Conditional Access App Control', 'Sign-in frequency', 'Customize continuous access evaluation'], a: 1, obj: 3,
      why: 'Use Conditional Access App Control routes the session to Defender for Cloud Apps for access and session policies.' },
    { q: 'Downloads of files labelled Confidential must be blocked from any cloud app on unmanaged devices, while viewing is allowed. What do you create?', o: ['An access policy', 'A session policy', 'A file policy', 'An activity policy'], a: 1, obj: 4,
      why: 'Session policies act on activities within a session, such as downloads; access policies decide at sign-in.' },
    { q: 'Users bypass session policies by using desktop clients. What do you add?', o: ['A session policy blocking uploads', 'An access policy blocking native clients', 'A new app connector', 'A higher risk score'], a: 1, obj: 4,
      why: 'Native clients cannot be proxied; an access policy blocks them so only browser sessions, which can be controlled, are allowed.' },
    { q: 'You want alerts, and automatic disabling, for OAuth apps with high-privilege Graph permissions that have not been used for 90 days. What do you configure?', o: ['An access review', 'An app governance policy', 'A cloud discovery policy', 'An activity policy on the Microsoft 365 connector'], a: 1, obj: 5,
      why: 'App governance policies evaluate OAuth apps by permissions, usage and behaviour and can disable them.' },
    { q: 'Where do you review an app’s risk score and the security, compliance and legal factors behind it?', o: ['OAuth apps page', 'Cloud app catalog', 'Entra enterprise applications', 'Identity Secure Score'], a: 1, obj: 6,
      why: 'The cloud app catalog holds the risk assessment for each app and lets you tag and customise it.' }
  ]
});
