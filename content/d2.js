/* ======================================================================
   02-01  User authentication
   ====================================================================== */
MODULES.push({
  id: '02-01', domain: '02', title: 'Authentication Methods, SSPR, Password Protection and Kerberos', short: 'Authentication',
  group: 'Plan, implement, and manage Microsoft Entra user authentication',
  objectives: [
    'Plan for authentication',
    'Implement and manage authentication methods, including certificate-based authentication, Temporary Access Pass, OAuth 2.0 tokens, Microsoft Authenticator, and passkeys (FIDO2)',
    'Implement and manage tenant-wide multifactor authentication (MFA) settings',
    'Configure and deploy self-service password reset (SSPR)',
    'Implement and manage Windows Hello for Business',
    'Disable accounts and revoke user sessions',
    'Implement and manage Microsoft Entra password protection',
    'Enable Microsoft Entra Kerberos authentication for hybrid identities'
  ],
  status: 'GA', verified: '',
  cost: { level: 'none', label: '$0', est: '$0. Tenant configuration. The Kerberos step reuses dc01 from 01-04; start it for that step and deallocate after.', meter: 'none' },
  portal: 'Entra admin center &gt; Entra ID &gt; Authentication methods · Password reset · Users &gt; user &gt; Authentication methods',
  ms: [{ t: "Secure Microsoft Entra users with multifactor authentication", u: "https://learn.microsoft.com/en-us/training/modules/secure-aad-users-with-mfa/" }, { t: "Manage user authentication", u: "https://learn.microsoft.com/en-us/training/modules/manage-user-authentication/" }],
  sdk: '<code>Microsoft.Graph.Identity.SignIns</code> <code>Microsoft.Graph.Users.Actions</code> <code>AzureADHybridAuthenticationManagement</code>',
  kql: '<code>AuditLogs</code> <code>SigninLogs</code>',
  prereq: ['00-01', '01-02'],
  tactical: 'The helpdesk is an authentication method. Microsoft’s 2023 write-up on Octo Tempest describes social-engineering service desks into resetting passwords and MFA, then registering the attacker’s own methods. In the logs this is <em>Admin registered security info</em>, <em>Admin deleted security info</em> or a Temporary Access Pass issued for the user, followed within minutes by <em>User registered security info</em> from a new IP. Every method change on a privileged account should page someone, and TAP issuance should be limited to a small group of Authentication Administrators whose own sign-ins are phishing-resistant.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>Planning for authentication means choosing methods by what they resist, then rolling users toward the top of the list without leaving anyone unable to sign in.</p>' +
      T('compare', ['Tier', 'Methods', 'Resists'], [
        ['Phishing-resistant', 'Passkeys (FIDO2) - device-bound or synced, Windows Hello for Business, certificate-based authentication (multifactor), macOS platform credential', 'Password spray, MFA fatigue, AiTM proxies'],
        ['Passwordless', 'Microsoft Authenticator phone sign-in', 'Password theft; not AiTM'],
        ['MFA', 'Authenticator push with number matching, OATH TOTP (software or hardware)', 'Password-only attacks'],
        ['Weakest MFA', 'SMS, voice call', 'Very little: SIM swap and interception'],
        ['Bootstrap and recovery', 'Temporary Access Pass', 'Used once, time-boxed, to register something stronger']
      ]) +
      '<p>Conditional Access expresses these tiers as <strong>authentication strengths</strong>: built-in <em>Multifactor authentication</em>, <em>Passwordless MFA</em> and <em>Phishing-resistant MFA</em>, plus custom combinations. Planning ends with a matrix: which persona, which strength, which fallback, which recovery path.</p>' +
      Q('note', '<strong>About "OAuth 2.0 tokens".</strong> In a list of authentication methods, the outline almost certainly means <strong>OATH tokens</strong> - the TOTP method, software or hardware. Know both: OATH tokens as a method, and OAuth 2.0 access and refresh tokens as what those methods produce (lifetimes, revocation and CAE, below and in 02-03).')) +
    S('mechanism', 'How it works under the hood',
      '<h3>One policy for every method</h3>' +
      '<p>The <strong>Authentication methods policy</strong> enables each method and targets it at groups. Managing methods in the legacy MFA and SSPR policies was retired on September 30, 2025, so questions that mention "per-user MFA service settings" for method choice describe the old model. <strong>System-preferred MFA</strong> prompts each user for the strongest method they have registered.</p>' +
      T('config', ['Method', 'Key settings'], [
        ['Passkey (FIDO2)', '<strong>Passkey profiles</strong> (GA March 2026) target groups with their own rules: <code>passkeyType</code> device-bound, synced or both; attestation enforcement; allowed or blocked AAGUIDs'],
        ['Microsoft Authenticator', 'Push with number matching (always on), additional context: app name and location, passwordless phone sign-in, passkeys in Authenticator'],
        ['Certificate-based authentication', 'Trusted CAs in the PKI trust store with CRLs; <strong>username binding</strong> (certificate field to user attribute); <strong>authentication binding</strong> by policy OID or issuer decides single- or multifactor; affinity binding low/high'],
        ['Temporary Access Pass', 'Lifetime (minimum 10 minutes, up to 30 days), one-time or multi-use, length; counts as strong authentication'],
        ['Software and hardware OATH tokens', 'TOTP, 30 or 60 seconds; hardware tokens are imported then activated by the user'],
        ['SMS / voice', 'Leave off for privileged roles; SMS can also be used as a sign-in method, which you rarely want']
      ]) +
      C('powershell', String.raw`
# Enable TAP: one-time use, one hour by default
Invoke-MgGraphRequest -Method PATCH -Uri 'v1.0/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/TemporaryAccessPass' -Body @{
    '@odata.type'            = '#microsoft.graph.temporaryAccessPassAuthenticationMethodConfiguration'
    state                    = 'enabled'
    defaultLifetimeInMinutes = 60
    isUsableOnce             = $true
    includeTargets           = @(@{ targetType = 'group'; id = 'all_users' })
}

# Issue one to a new hire so they can register a passkey on day one
$tap = New-MgUserAuthenticationTemporaryAccessPassMethod -UserId 'mroy@lab.contoso.ca' -LifetimeInMinutes 60 -IsUsableOnce:$true
$tap.TemporaryAccessPass     # shown once`) +
      '<h3>Tenant-wide MFA settings</h3>' +
      '<p>What remains tenant-wide sits under <strong>Authentication methods &gt; Settings</strong> and the MFA blade: <strong>Report suspicious activity</strong> (users flag an unexpected prompt; with P2 it raises their user risk), system-preferred MFA, the Authenticator registration campaign, account lockout after repeated MFA denials, phone call settings and hardware OATH tokens. The legacy <em>per-user MFA</em> states (Enabled, Enforced) and the service settings for trusted IPs and "remember MFA" still exist but are superseded: use Conditional Access with named locations and sign-in frequency, and set per-user MFA to Disabled once CA covers the user. <strong>Security defaults</strong> is the free alternative for tenants without P1.</p>' +
      '<h3>Self-service password reset</h3>' +
      '<p>Scope SSPR to <em>None</em>, <em>Selected</em> (one group) or <em>All</em>. Set the number of methods required (1 or 2) and which methods count; security questions are allowed only for SSPR and never for administrators. <strong>Administrators always have SSPR</strong> under a separate, stricter two-method policy you cannot weaken. On-premises users need <strong>password writeback</strong> through Connect Sync or Cloud Sync (P1). Combined registration means users register once for MFA and SSPR.</p>' +
      '<h3>Windows Hello for Business</h3>' +
      '<p>A PIN or biometric unlocks an asymmetric key in the TPM; nothing reusable crosses the network, which is what makes it phishing-resistant. Entra joined devices use it directly. For hybrid, <strong>cloud Kerberos trust</strong> is Microsoft’s recommended model: no certificates and no key sync, because Entra Kerberos issues the on-premises ticket (below). Key trust and certificate trust are the older models. One catch: the AzureADKerberos object follows read-only DC rules, so members of privileged built-in groups such as Domain Admins cannot use cloud Kerberos trust. Configure it tenant-wide in Intune (Windows enrollment) or per group with an Account protection policy, or by GPO.</p>' +
      '<h3>Disabling accounts and revoking sessions</h3>' +
      '<p>Blocking sign-in stops new authentication; it does not end sessions already issued. <code>Revoke-MgUserSignInSession</code> invalidates the user’s refresh tokens and session cookies. Access tokens already issued stay valid until they expire (about an hour) - except at CAE-capable resources such as Exchange Online, SharePoint Online, Teams and Graph, which reject them within minutes (02-03). For a <strong>synced</strong> user, disable the account in AD as well: the next sync cycle overwrites a cloud-only change.</p>' +
      C('powershell', String.raw`
$u = 'compromised.user@lab.contoso.ca'
Update-MgUser -UserId $u -AccountEnabled:$false        # synced user: Disable-ADAccount on-premises too
Revoke-MgUserSignInSession -UserId $u                  # refresh tokens and session cookies
Get-MgUserAuthenticationMethod -UserId $u | Select-Object Id, @{ n = 'Type'; e = { $_.AdditionalProperties.'@odata.type' } }
Get-MgUserRegisteredDevice -UserId $u | Select-Object Id`) +
      '<h3>Password protection</h3>' +
      '<p>The <strong>global banned password list</strong> is always on. A <strong>custom banned password list</strong> (P1, up to 1,000 terms) adds your brand, products and locations; Entra normalises substitutions and scores fuzzy matches, so <code>C0nt0so2026!</code> fails if <code>contoso</code> is banned. <strong>Smart lockout</strong> (threshold 10, duration 60 seconds by default) locks attackers out while familiar locations keep working. On-premises, a <strong>DC agent</strong> on every DC and a <strong>proxy service</strong> on a member server (DCs need no internet access) enforce the same lists; start in <em>Audit</em> mode, then <em>Enforce</em>.</p>' +
      '<h3>Microsoft Entra Kerberos</h3>' +
      '<p>Entra can issue a <strong>partial Kerberos TGT</strong> for your AD realm, which a DC exchanges for a full TGT. That one capability enables Windows Hello for Business cloud Kerberos trust, passkey (FIDO2) sign-in to on-premises resources, and Azure Files access with hybrid identities. You enable it by creating a Kerberos server object - a read-only DC computer object named <code>AzureADKerberos</code> - in each domain.</p>' +
      C('powershell', String.raw`
# On a domain-joined server with RSAT; Domain Admin on-premises, Global Administrator (or Hybrid Identity Administrator) in Entra
Install-Module AzureADHybridAuthenticationManagement -AllowClobber
$domain = $env:USERDNSDOMAIN
Set-AzureADKerberosServer -Domain $domain -UserPrincipalName 'admin@lab.contoso.ca'
Get-AzureADKerberosServer -Domain $domain -UserPrincipalName 'admin@lab.contoso.ca'
# Rotate its krbtgt key periodically, like any DC's
Set-AzureADKerberosServer -Domain $domain -UserPrincipalName 'admin@lab.contoso.ca' -RotateServerKey`)) +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['SMS and voice for admins', 'Allowed', 'Excluded via method targeting; require phishing-resistant strength in CA', 'SIM swap and AiTM'],
        ['Passkey profiles', 'Default profile', 'Device-bound with attestation for admins; synced allowed for users', 'Synced keys trade assurance for recoverability'],
        ['Temporary Access Pass', 'Disabled', 'Enabled, one-time, short lifetime, issued by few', 'Onboarding without a password, recovery without a helpdesk password reset'],
        ['Report suspicious activity', 'Microsoft managed', 'Enabled', 'Turns a denied prompt into risk signal'],
        ['Per-user MFA', 'Disabled', 'Disabled for everyone once CA applies', 'Enforced per-user MFA plus CA produces confusing double policy'],
        ['SSPR methods required', '1', '2', 'One method is one phish'],
        ['Custom banned passwords', 'Off', 'On, brand and local terms', 'Spray lists are built from exactly those words'],
        ['On-premises password protection', 'Not deployed', 'Audit, then Enforce', 'Most resets still happen on-premises'],
        ['Seamless SSO / Entra Kerberos object key', 'Never rotated', 'Rotate on a schedule', 'Standing secrets']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>User disabled, mailbox still syncing.</strong> The existing session was never revoked, or the client is not CAE-capable and holds an hour-long access token.</p>' +
      '<p><strong>Synced user re-enabled itself.</strong> It was disabled only in the cloud; the next sync restored <code>accountEnabled</code> from AD.</p>' +
      '<p><strong>TAP rejected at sign-in.</strong> It expired, was already used (one-time), or the TAP method is not targeted at the user.</p>' +
      '<p><strong>Passkey registration fails with a specific key model.</strong> Attestation is enforced and the AAGUID is not allowed in the user’s passkey profile.</p>' +
      '<p><strong>On-premises password protection logs events but blocks nothing.</strong> It is still in Audit mode.</p>' +
      '<p><strong>Cloud Kerberos trust users cannot reach file shares.</strong> The <code>AzureADKerberos</code> object was never created in that domain.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"new employees must register passwordless on day one without knowing a password"', 'Temporary Access Pass'],
        ['"phishing-resistant", "resist AiTM"', 'Passkeys (FIDO2), WHfB or CBA - authentication strength Phishing-resistant MFA'],
        ['"users sign in with smart cards issued by our PKI"', 'Certificate-based authentication'],
        ['"allow synced passkeys for users but only device-bound for admins"', 'Passkey profiles with passkeyType per group'],
        ['"users flag an MFA prompt they did not start"', 'Report suspicious activity'],
        ['"users reset forgotten passwords; on-premises too"', 'SSPR + password writeback'],
        ['"hybrid WHfB with no PKI"', 'Cloud Kerberos trust, which needs Entra Kerberos'],
        ['"terminate an employee immediately"', 'Disable, then revoke sessions (and disable in AD if synced)'],
        ['"block passwords containing the company name, on-premises too"', 'Custom banned list + DC agent and proxy'],
        ['"FIDO2 sign-in to on-premises file servers"', 'Microsoft Entra Kerberos server object']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
// Every change to anyone's authentication methods, and who made it
AuditLogs
| where TimeGenerated > ago(7d)
| where Category == "UserManagement" and OperationName has "security info"
    or OperationName has "Temporary Access Pass"
| extend Actor = coalesce(tostring(InitiatedBy.user.userPrincipalName), tostring(InitiatedBy.app.displayName)), Target = tostring(TargetResources[0].userPrincipalName)
| project TimeGenerated, OperationName, Actor, Target, Result`) +
      C('kql', String.raw`
// Which methods people actually use
SigninLogs
| where TimeGenerated > ago(7d) and ResultType == 0
| mv-expand AuthenticationDetails
| extend Method = tostring(AuthenticationDetails.authenticationMethod)
| where Method !in ("Previously satisfied", "")
| summarize Users = dcount(UserPrincipalName) by Method
| order by Users desc`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('Manage authentication methods', 'https://learn.microsoft.com/entra/identity/authentication/concept-authentication-methods-manage') + '</li>' +
      '<li>' + L('How to enable passkeys (FIDO2) in Microsoft Entra ID', 'https://learn.microsoft.com/entra/identity/authentication/how-to-authentication-passkeys-fido2') + '</li>' +
      '<li>' + L('Temporary Access Pass', 'https://learn.microsoft.com/entra/identity/authentication/howto-authentication-temporary-access-pass') + '</li>' +
      '<li>' + L('Certificate-based authentication', 'https://learn.microsoft.com/entra/identity/authentication/concept-certificate-based-authentication') + '</li>' +
      '<li>' + L('Revoke user access in an emergency', 'https://learn.microsoft.com/entra/identity/users/users-revoke-access') + '</li>' +
      '<li>' + L('Password protection on-premises', 'https://learn.microsoft.com/entra/identity/authentication/concept-password-ban-bad-on-premises') + '</li>' +
      '<li>' + L('Windows Hello for Business cloud Kerberos trust', 'https://learn.microsoft.com/windows/security/identity-protection/hello-for-business/deploy/hybrid-cloud-kerberos-trust') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Take a new user from nothing to passkey with a Temporary Access Pass, turn on SSPR, ban your brand from passwords, then kill a live session and watch what survives.',
    steps: [
      '<p>In <strong>Authentication methods &gt; Policies</strong>, record which methods are enabled and for whom. Enable <strong>Temporary Access Pass</strong> (one-time, 60 minutes) and <strong>Passkey (FIDO2)</strong> for all users. Open the passkey profiles and read the default profile’s passkey type and attestation settings.</p>',
      '<p>Issue a TAP to a lab user with PowerShell. In a private window, sign in with the TAP and register a passkey (security key, phone or Windows Hello). Sign out and sign back in with the passkey only.</p>',
      '<p>In <strong>Authentication methods &gt; Settings</strong>, enable <strong>Report suspicious activity</strong> and confirm system-preferred MFA is on. Check <strong>Per-user MFA</strong> and confirm every user is <em>Disabled</em>.</p>',
      '<p>Enable SSPR for <code>DYN-Sales</code> with two methods required. As a Sales user, register and then reset your password at <code>aka.ms/sspr</code>. Try it as a non-Sales user.</p>',
      '<p>Enable the custom banned password list with your lab company name and your city. As a user, try to change your password to a variation of the company name.</p>',
      '<p>Sign a test user in to Outlook on the web in one browser and to the Microsoft 365 app on a phone. Disable the user and run <code>Revoke-MgUserSignInSession</code>. Note how long each client keeps working.</p>',
      '<p>Optional, with dc01 running: create the Entra Kerberos server object and confirm <code>AzureADKerberos</code> appears in the Domain Controllers OU. If you have an Entra joined Windows device, enable WHfB in Intune (Devices &gt; Enrollment &gt; Windows Hello for Business) and provision a PIN.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Keep', items: [
        'Keep TAP and passkeys enabled - later labs use them',
        'Re-enable the test user you disabled' ] },
      { bucket: '2', title: 'VMs', items: [
        'Deallocate dc01 if you started it for step 7' ] },
      { bucket: '3', title: 'Verify', items: [
        'The Validation KQL shows your TAP issuance and the passkey registration as separate events' ] }
    ]
  },
  quiz: [
    { q: 'You are planning authentication for administrators and must resist adversary-in-the-middle phishing. Which authentication strength do you require?', o: ['Multifactor authentication', 'Passwordless MFA', 'Phishing-resistant MFA', 'Any method except SMS'], a: 2, obj: 0,
      why: 'Only phishing-resistant methods (passkeys, WHfB, CBA) bind the credential to the real sign-in origin. Authenticator phone sign-in is passwordless but can be relayed.' },
    { q: 'New hires must register a passkey on their first day without ever receiving a password. What do you use?', o: ['SSPR', 'Temporary Access Pass', 'Security defaults', 'Email one-time passcode'], a: 1, obj: 1,
      why: 'A TAP is a time-limited credential that satisfies strong authentication, used to register passwordless methods.' },
    { q: 'Administrators may use only device-bound passkeys with attestation; other users may also use synced passkeys. What do you configure?', o: ['Two Conditional Access policies', 'Passkey profiles targeted at different groups', 'Per-user MFA', 'Authentication context'], a: 1, obj: 1,
      why: 'Passkey profiles let each targeted group have its own passkeyType and attestation rules.' },
    { q: 'Users must be able to flag an MFA prompt they did not initiate, and that report should raise their risk. What do you enable?', o: ['Report suspicious activity', 'Number matching', 'Account lockout', 'Remember MFA on trusted devices'], a: 0, obj: 2,
      why: 'Report suspicious activity is a tenant-wide setting; with P2 a report marks the user high risk.' },
    { q: 'Synced users must reset forgotten passwords themselves and the new password must work on-premises. What is required besides enabling SSPR?', o: ['Seamless SSO', 'Password writeback', 'Pass-through authentication', 'Entra Kerberos'], a: 1, obj: 3,
      why: 'Password writeback, through Connect Sync or Cloud Sync, writes SSPR changes back to AD DS.' },
    { q: 'You deploy Windows Hello for Business to hybrid joined devices and want no PKI or certificate deployment. Which trust model?', o: ['Certificate trust', 'Key trust', 'Cloud Kerberos trust', 'Seamless SSO'], a: 2, obj: 4,
      why: 'Cloud Kerberos trust uses Entra Kerberos to issue partial TGTs, so no certificates are needed.' },
    { q: 'A cloud-only user was disabled five minutes ago but is still reading mail in a client. What else should you have done?', o: ['Reset the password', 'Revoke the user’s sessions', 'Remove the licence', 'Delete the user'], a: 1, obj: 5,
      why: 'Disabling blocks new sign-ins; revoking sessions invalidates refresh tokens and cookies, and CAE-aware resources then reject the access token quickly.' },
    { q: 'Passwords containing the company name must be rejected in the cloud and on-premises. What do you deploy?', o: ['Smart lockout only', 'Custom banned password list plus the password protection DC agent and proxy', 'SSPR', 'Security defaults'], a: 1, obj: 6,
      why: 'The custom banned list covers cloud changes; the DC agent and proxy apply the same lists to on-premises changes.' },
    { q: 'Users must sign in to on-premises resources with FIDO2 security keys. What must you create in each AD domain?', o: ['A Seamless SSO account', 'A Microsoft Entra Kerberos server object', 'A PTA agent', 'An Application Proxy connector'], a: 1, obj: 7,
      why: 'Entra Kerberos issues partial TGTs for the domain via the AzureADKerberos object created by Set-AzureADKerberosServer.' }
  ]
});

/* ======================================================================
   02-02  Conditional Access: design, assignments, controls, testing
   ====================================================================== */
MODULES.push({
  id: '02-02', domain: '02', title: 'Conditional Access: Planning, Assignments, Controls and Testing', short: 'Conditional Access',
  group: 'Plan, implement, and manage Microsoft Entra Conditional Access',
  objectives: [
    'Plan Conditional Access policies',
    'Implement Conditional Access policy assignments',
    'Implement Conditional Access policy controls',
    'Test and troubleshoot Conditional Access policies',
    'Create a Conditional Access policy from a template'
  ],
  status: 'GA', verified: '',
  cost: { level: 'none', label: '$0', est: '$0. P1 is enough for everything here except risk conditions (P2). Lockout is the real cost: every policy excludes the emergency access group.', meter: 'none' },
  portal: 'Entra admin center &gt; Entra ID &gt; Conditional Access · Named locations · What If · Sign-in logs &gt; Conditional Access',
  ms: [{ t: "Plan, implement, and administer Conditional Access", u: "https://learn.microsoft.com/en-us/training/modules/plan-implement-administer-conditional-access/" }],
  sdk: '<code>Microsoft.Graph.Identity.SignIns</code>',
  kql: '<code>SigninLogs</code> <code>AADNonInteractiveUserSignInLogs</code> <code>AuditLogs</code>',
  prereq: ['00-01', '01-02', '02-01'],
  tactical: 'The Conditional Access tab of a sign-in is ground truth in an investigation: which policies applied, which were not applied and why, and which grant was satisfied and how. A successful sign-in whose MFA requirement shows as <em>satisfied by claim in the token</em>, from an unfamiliar IP minutes after a phishing click, is usually a replayed session cookie from an AiTM proxy - not an attacker passing MFA. The fix is in 02-03 (token protection, compliant network, phishing-resistant strength), not another MFA policy.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>Conditional Access is Entra’s policy engine: <strong>if</strong> a sign-in matches the assignments, <strong>then</strong> require the grant controls and apply the session controls. It runs after first-factor authentication and before a token is issued, for every application that uses Entra ID.</p>' +
      '<p>Two rules decide almost every exam question. First, <strong>every policy that applies is enforced</strong>: the sign-in must satisfy the grant controls of all of them together. Second, <strong>block wins</strong>, and <strong>exclusions win over inclusions</strong>.</p>' +
      Q('warn', '<strong>Lockout is the failure mode.</strong> Create every policy in <strong>Report-only</strong>, exclude <code>CA-Exclude-EmergencyAccess</code>, and read the report-only results before switching to On. Templates start in report-only for this reason.') +
      Q('note', '<strong>Beyond the exam outline.</strong> Microsoft Learn’s Conditional Access training module now also covers AI agent identities managed through Microsoft Entra Agent ID. The April 27, 2026 skills outline does not list them, so treat this as awareness rather than a scoring target.')) +
    S('mechanism', 'How it works under the hood',
      '<h3>Assignments: who, what, where, when</h3>' +
      T('compare', ['Assignment', 'Options', 'Notes'], [
        ['Users', 'All users; users and groups; directory roles; guest or external user types (by kind and tenant); workload identities (separate licence)', 'Directory role targeting covers active assignments only'],
        ['Target resources', '<strong>All resources</strong> (formerly All cloud apps), selected apps, <strong>filter for applications</strong> (custom security attributes), user actions (<em>Register security information</em>, <em>Register or join devices</em>), authentication context', 'User actions are how you protect registration itself'],
        ['Network', 'Any network, all trusted networks, named locations (IP ranges, countries by IP or GPS), all compliant network locations (Global Secure Access)', 'Named locations marked trusted also lower sign-in risk'],
        ['Conditions', 'User risk, sign-in risk, insider risk, device platforms, client apps, filter for devices, authentication flows', 'Client apps <em>Exchange ActiveSync</em> and <em>Other clients</em> = legacy authentication; authentication flows = device code flow and authentication transfer']
      ]) +
      '<h3>Grant controls</h3>' +
      '<p><strong>Block access</strong>, or <strong>Grant access</strong> requiring one or all of: multifactor authentication, an <strong>authentication strength</strong>, device marked compliant, Microsoft Entra hybrid joined device, app protection policy, password change, terms of use. <em>Require one of the selected controls</em> is an OR; <em>require all</em> is an AND. <em>Require approved client app</em> was retired in June 2026; <em>Require app protection policy</em> replaces it.</p>' +
      '<h3>Planning a policy set</h3>' +
      '<p>Plan by persona (admins, users, guests, workload identities), name policies so their intent is readable (<code>CA010-Admins-AllApps-PhishResistant</code>), and build a baseline before exceptions:</p>' +
      T('compare', ['Baseline policy', 'Assignments', 'Grant'], [
        ['Block legacy authentication', 'All users; client apps Exchange ActiveSync and Other clients', 'Block'],
        ['Admins: phishing-resistant', 'Directory roles (privileged); All resources', 'Authentication strength: Phishing-resistant MFA'],
        ['All users: MFA', 'All users, exclude emergency and service accounts; All resources', 'Require MFA (or an MFA strength)'],
        ['Secure registration', 'All users; user action Register security information; exclude trusted locations', 'Require MFA (TAP satisfies it)'],
        ['Block device code flow', 'All users; authentication flows: device code flow', 'Block'],
        ['Risk (P2, 02-04)', 'All users; user risk High / sign-in risk Medium+', 'Require risk remediation (or password change + MFA) / MFA; sign-in frequency every time']
      ]) +
      C('powershell', String.raw`
$bg = (Get-MgGroup -Filter "displayName eq 'CA-Exclude-EmergencyAccess'").Id
$policy = @{
    displayName = 'CA001-AllUsers-BlockLegacyAuth'
    state       = 'enabledForReportingButNotEnforced'          # report-only
    conditions  = @{
        users          = @{ includeUsers = @('All'); excludeGroups = @($bg) }
        applications   = @{ includeApplications = @('All') }
        clientAppTypes = @('exchangeActiveSync', 'other')
    }
    grantControls = @{ operator = 'OR'; builtInControls = @('block') }
}
New-MgIdentityConditionalAccessPolicy -BodyParameter $policy`) +
      '<h3>Templates</h3>' +
      '<p><strong>New policy from template</strong> offers Microsoft’s recommended policies grouped as <em>Secure foundation</em>, <em>Zero Trust</em>, <em>Remote work</em>, <em>Protect administrator</em> and <em>Emerging threats</em>. A template pre-fills assignments and controls, excludes the admin creating it, and defaults to report-only. Review the exclusions before saving: a template does not know about your emergency access group.</p>' +
      '<h3>Testing and troubleshooting</h3>' +
      '<p><strong>What If</strong> evaluates a hypothetical sign-in - user, app, IP, platform, client app, risk - and lists policies that would and would not apply, with the reason. <strong>Report-only</strong> records what a policy would have done on real sign-ins (<em>Report-only: success, failure, user action required, not applied</em>). The <strong>Conditional Access</strong> tab of each sign-in log entry shows the enforced result per policy. With logs in Log Analytics, the <strong>Conditional Access insights and reporting</strong> workbook shows impact over time.</p>' +
      T('compare', ['Error', 'Meaning'], [
        ['AADSTS53003', 'Blocked by Conditional Access - the password was already correct'],
        ['AADSTS50126', 'Wrong username or password - Conditional Access never ran'],
        ['AADSTS53000', 'Device is not compliant (or not recognised)'],
        ['AADSTS53001', 'Device is not hybrid joined'],
        ['AADSTS50076 / 50079', 'MFA required / MFA registration required']
      ]) +
      Q('warn', '<strong>53003 is a confirmed password.</strong> Conditional Access evaluates only after the first factor succeeds, so spray tools such as MSOLSpray treat 53003 as a hit. A run of 53003 results from an unfamiliar IP is a list of valid credentials that a policy happened to stop - reset them.')) +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Policy state for new policies', 'Report-only (templates) / your choice', 'Report-only for at least a week', 'Real sign-ins surface the service accounts you forgot'],
        ['Emergency access exclusion', 'None', 'Group excluded from every policy', 'One audit point'],
        ['Named locations', 'None', 'Office egress IPs (trusted), blocked countries', 'Networks feed both CA and risk'],
        ['Security defaults', 'On (new tenants)', 'Off once the baseline is enforced', 'They are mutually exclusive'],
        ['Target resources', 'Selected apps', 'All resources, with exclusions', 'New apps are covered automatically'],
        ['Device code flow', 'Allowed', 'Blocked except named devices', 'A favourite phishing flow']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>A policy "does nothing".</strong> An exclusion covers the user, the app is not in scope, or the sign-in used a client app type the policy does not include. What If names the reason.</p>' +
      '<p><strong>Service account broke overnight.</strong> The policy went from report-only to On without reading report-only failures.</p>' +
      '<p><strong>Everyone is blocked.</strong> Two policies apply and their grants cannot both be satisfied - for example compliant device required on a platform Intune does not manage.</p>' +
      '<p><strong>Admin role targeting missed an admin.</strong> The admin is only eligible in PIM; role targeting applies once the role is active.</p>' +
      '<p><strong>Location condition unreliable.</strong> IPv6 egress not included in the named location, or the user is on a VPN with split tunnelling.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"two policies apply; one requires MFA, one requires a compliant device"', 'Both are required'],
        ['"one policy grants with MFA, another blocks"', 'Blocked'],
        ['"user is in an included and an excluded group"', 'Excluded'],
        ['"block POP, IMAP and SMTP basic auth"', 'Client apps: Exchange ActiveSync and Other clients, Block'],
        ['"protect MFA registration itself"', 'User action: Register security information'],
        ['"require phishing-resistant methods for admins"', 'Grant: authentication strength'],
        ['"evaluate impact before enforcement"', 'Report-only'],
        ['"why was this policy not applied to a hypothetical sign-in"', 'What If'],
        ['"quickly deploy Microsoft-recommended policies"', 'New policy from template'],
        ['"apply only to apps tagged with a custom attribute"', 'Filter for applications']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
// What each report-only policy would have done over the last week
SigninLogs
| where TimeGenerated > ago(7d)
| mv-expand CA = ConditionalAccessPolicies
| extend Policy = tostring(CA.displayName), Result = tostring(CA.result)
| where Result startswith "reportOnly"
| summarize Signins = count(), Users = dcount(UserPrincipalName) by Policy, Result
| order by Policy asc`) +
      C('kql', String.raw`
// Sign-ins blocked by Conditional Access and the policy responsible
SigninLogs
| where TimeGenerated > ago(1d) and ResultType == 53003
| mv-expand CA = ConditionalAccessPolicies
| where tostring(CA.result) == "failure"
| project TimeGenerated, UserPrincipalName, AppDisplayName, IPAddress, Policy = tostring(CA.displayName)`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('Building a Conditional Access policy', 'https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-policies') + '</li>' +
      '<li>' + L('Conditional Access templates', 'https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-policy-common') + '</li>' +
      '<li>' + L('What If tool', 'https://learn.microsoft.com/entra/identity/conditional-access/what-if-tool') + '</li>' +
      '<li>' + L('Report-only mode', 'https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-report-only') + '</li>' +
      '<li>' + L('Authentication flows condition', 'https://learn.microsoft.com/entra/identity/conditional-access/concept-authentication-flows') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Replace security defaults with a report-only baseline, read what it would have done, then enforce it one policy at a time. Use the evaluator in the module to predict each result before you test it.',
    steps: [
      '<p>Create named locations: your home or office egress IP (mark as trusted) and one blocked country.</p>',
      '<p>Create <code>CA001-AllUsers-BlockLegacyAuth</code> with the PowerShell in the module. Confirm it appears in report-only with the emergency group excluded.</p>',
      '<p>From <strong>New policy from template</strong>, create <em>Require phishing-resistant multifactor authentication for administrators</em> and <em>Securing security info registration</em>. Before saving each, add <code>CA-Exclude-EmergencyAccess</code> to the exclusions.</p>',
      '<p>Create <code>CA004-AllUsers-AllApps-MFA</code> (report-only) and <code>CA005-AllUsers-BlockDeviceCode</code> using the <em>authentication flows</em> condition.</p>',
      '<p>Turn off <strong>security defaults</strong> (Overview &gt; Properties &gt; Manage security defaults).</p>',
      '<p>Sign in as several lab users and as an admin. Open each sign-in’s <strong>Report-only</strong> tab. Then run the report-only KQL if your logs reach Log Analytics yet (04-04).</p>',
      '<p>Use <strong>What If</strong> for: a Sales user from the blocked country; an admin on iOS; a user with legacy client Other clients. Record which policies apply and why.</p>',
      '<p>Switch CA001 and CA004 to <strong>On</strong>. Sign in as bg01 to prove the exclusion works, and as a user to see the MFA prompt.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Keep', items: [
        'Keep the baseline on - the rest of the guide assumes it',
        'Leave the admin phishing-resistant policy in report-only until your own admin account has a passkey' ] },
      { bucket: '2', title: 'Verify', items: [
        'Every policy lists <code>CA-Exclude-EmergencyAccess</code> under excluded groups',
        'Both emergency accounts can still sign in' ] }
    ]
  },
  quiz: [
    { q: 'You are planning Conditional Access for a new tenant. What should be true of every policy you create?', o: ['It targets All users with no exclusions', 'It excludes the emergency access accounts and starts in report-only', 'It uses per-user MFA as a backup', 'It is created from a template'], a: 1, obj: 0,
      why: 'Excluding break-glass accounts and validating in report-only are the two guardrails against tenant-wide lockout.' },
    { q: 'A user is in Group A (included) and Group B (excluded) for the same policy. What happens?', o: ['The policy applies', 'The policy does not apply to the user', 'The more recent membership wins', 'The policy applies in report-only'], a: 1, obj: 1,
      why: 'Exclusions always take precedence over inclusions.' },
    { q: 'You must block POP3 and IMAP basic authentication for all users. Which assignment do you use?', o: ['Device platforms', 'Client apps: Exchange ActiveSync clients and Other clients', 'Authentication flows', 'Filter for devices'], a: 1, obj: 1,
      why: 'Legacy authentication protocols fall under the Other clients and Exchange ActiveSync client app types.' },
    { q: 'Registering MFA methods must require MFA unless the user is at a trusted location. What do you target?', o: ['All resources', 'User action: Register security information', 'Authentication context c1', 'The My Sign-ins app'], a: 1, obj: 1,
      why: 'The Register security information user action applies Conditional Access to method registration itself.' },
    { q: 'Policy 1 requires MFA. Policy 2 requires a compliant device. Both apply to a sign-in. What must the user satisfy?', o: ['MFA only', 'Compliant device only', 'Either one', 'Both MFA and a compliant device'], a: 3, obj: 2,
      why: 'All applicable policies are enforced together, so every grant requirement must be met.' },
    { q: 'Administrators must use FIDO2 passkeys or certificate-based authentication. Which grant control do you use?', o: ['Require multifactor authentication', 'Require authentication strength: Phishing-resistant MFA', 'Require approved client app', 'Require password change'], a: 1, obj: 2,
      why: 'Authentication strengths restrict which methods satisfy the grant. Plain MFA would also accept SMS or push.' },
    { q: 'Before enforcing a new policy, you want to see its effect on real sign-ins without affecting users. What do you use?', o: ['What If', 'Report-only mode', 'Security defaults', 'Access reviews'], a: 1, obj: 3,
      why: 'Report-only evaluates the policy on real sign-ins and logs the outcome without enforcing it. What If tests hypothetical sign-ins.' },
    { q: 'A user reports AADSTS53003. Where do you find which policy caused it?', o: ['Audit logs', 'The Conditional Access tab of the user’s sign-in log entry', 'Provisioning logs', 'Identity Secure Score'], a: 1, obj: 3,
      why: '53003 means blocked by Conditional Access; the sign-in’s Conditional Access tab lists each policy’s result.' },
    { q: 'You want to deploy Microsoft’s recommended policy for protecting administrators as quickly as possible. What do you use, and what must you check?', o: ['A template, and add your emergency access exclusions before saving', 'Security defaults, and nothing else', 'A template, which excludes emergency accounts automatically', 'PowerShell only'], a: 0, obj: 4,
      why: 'Templates pre-fill Microsoft’s recommendations and exclude the current admin, but they do not know your break-glass group.' }
  ]
});

/* ======================================================================
   02-03  Conditional Access: session, device, CAE, context, protected actions
   ====================================================================== */
MODULES.push({
  id: '02-03', domain: '02', title: 'Session Controls, Device Enforcement, CAE, Authentication Context and Protected Actions', short: 'CA Session and Context',
  group: 'Plan, implement, and manage Microsoft Entra Conditional Access',
  objectives: [
    'Implement session management',
    'Implement device-enforced restrictions',
    'Implement continuous access evaluation',
    'Configure authentication context',
    'Implement protected actions'
  ],
  status: 'GA', verified: '',
  cost: { level: 'none', label: '$0', est: '$0. Device compliance needs Intune, included in the E5 trial. A managed device is optional.', meter: 'none' },
  portal: 'Entra admin center &gt; Entra ID &gt; Conditional Access &gt; Authentication contexts · Entra ID &gt; Roles &amp; admins &gt; Protected actions · Intune admin center &gt; Compliance',
  ms: [{ t: "Plan, implement, and administer Conditional Access", u: "https://learn.microsoft.com/en-us/training/modules/plan-implement-administer-conditional-access/" }],
  sdk: '<code>Microsoft.Graph.Identity.SignIns</code>',
  kql: '<code>SigninLogs</code> <code>AADNonInteractiveUserSignInLogs</code>',
  prereq: ['02-02'],
  tactical: 'Adversary-in-the-middle phishing steals the session, not the password: the victim completes MFA through the proxy and the attacker replays the resulting cookie. Microsoft has tracked AiTM kits used at scale for business email compromise since 2022. Session controls are the answer MFA is not: token protection binds the refresh token to the device, the compliant network check refuses tokens used outside Global Secure Access, CAE ends sessions on password reset or high user risk, and short sign-in frequency on risky sign-ins forces a fresh proof. In a replay, the stolen session’s sign-ins show the same session ID from a new IP and device.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>Grant controls decide whether a token is issued. Everything in this module decides what happens <strong>after</strong>: how long the session lasts, where the token can be used, what the resource does when something changes, and which sensitive actions inside an app or the admin center demand a fresh, stronger proof.</p>' +
      vFlow([
        { t: 'Sign-in', s: 'grant controls', k: 'd2' },
        { t: 'Session', s: 'frequency, persistence, binding', k: 'd2' },
        { t: 'Resource', s: 'CAE: revoke on events and IP change', k: 'acc' },
        { t: 'Sensitive action', s: 'auth context, protected actions', k: 'warn' }
      ], 'The four moments this module controls.')) +
    S('mechanism', 'How it works under the hood',
      '<h3>Session controls</h3>' +
      T('config', ['Session control', 'What it does', 'Notes'], [
        ['Use app enforced restrictions', 'SharePoint, OneDrive and Exchange Online give a limited, browser-only experience (no download) to unmanaged devices', 'The app enforces it; also configured on the SharePoint side'],
        ['Use Conditional Access App Control', 'Routes the session through Defender for Cloud Apps for access and session policies', 'Monitor only, block downloads, or custom policy - 03-04'],
        ['Sign-in frequency', 'Forces reauthentication after N hours/days, or <strong>every time</strong>', 'Every time is for risky sign-ins, registration, sensitive apps'],
        ['Persistent browser session', 'Always or never keep the user signed in after closing the browser', 'Requires All resources as the target'],
        ['Customize continuous access evaluation', 'Disable CAE, or enable strict location enforcement', 'See CAE below'],
        ['Disable resilience defaults', 'Refuse to extend sessions during an Entra outage', 'Only for the most sensitive apps'],
        ['Require token protection for sign-in sessions', 'Binds refresh tokens to the device so a stolen token is useless elsewhere', 'Supported clients and platforms only; report-only first'],
        ['Use Global Secure Access security profile', 'Applies a GSA web filtering profile to the user’s internet traffic', '02-05']
      ]) +
      '<h3>Device-enforced restrictions</h3>' +
      '<p><strong>Require device to be marked as compliant</strong> reads Intune (or a partner MDM) compliance for the device’s Entra identity. <strong>Require Microsoft Entra hybrid joined device</strong> accepts any hybrid joined Windows device, managed or not. <strong>Filter for devices</strong> matches properties such as <code>device.trustType</code>, <code>device.isCompliant</code>, <code>device.model</code> or <code>device.extensionAttribute1</code> - the standard way to require privileged access workstations for admins or exclude kiosk devices. <strong>Require app protection policy</strong> is the mobile answer (Intune MAM), and replaced <em>Require approved client app</em>, retired in June 2026.</p>' +
      '<p>A browser must be able to present the device identity: Edge signed in with the work profile, Chrome with Windows accounts support, and so on. Otherwise a compliant device is reported as unknown. The <strong>device platforms</strong> condition is based on the user agent and can be spoofed, so use it to scope policies, never as the control.</p>' +
      C('json', String.raw`
{
  "displayName": "CA020-Admins-RequirePAW",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": { "includeRoles": ["62e90394-69f5-4237-9190-012177145e10"], "excludeGroups": ["<emergency-group-id>"] },
    "applications": { "includeApplications": ["All"] },
    "devices": { "deviceFilter": { "mode": "exclude", "rule": "device.extensionAttribute1 -eq \"PAW\" -and device.isCompliant -eq True" } }
  },
  "grantControls": { "operator": "OR", "builtInControls": ["block"] }
}`) +
      '<h3>Continuous access evaluation</h3>' +
      '<p>Normally a resource trusts an access token until it expires. With CAE, supporting resources - Exchange Online, SharePoint Online, Teams and Microsoft Graph - subscribe to <strong>critical events</strong> and evaluate <strong>IP location policies</strong> themselves, so CAE-capable clients can receive long-lived tokens (up to 28 hours) that are nonetheless revoked within minutes when needed.</p>' +
      T('compare', ['Critical event', 'Result at the resource'], [
        ['User account disabled or deleted', 'Token rejected; client must reauthenticate'],
        ['Password changed or reset', 'Token rejected'],
        ['MFA enabled for the user', 'Token rejected'],
        ['Administrator revokes all refresh tokens', 'Token rejected'],
        ['High user risk detected by ID Protection', 'Token rejected'],
        ['IP address no longer matches a location policy', 'Rejected - immediately in <strong>strict location enforcement</strong> mode']
      ]) +
      '<p>CAE is on by default. Strict location enforcement breaks users when the IP Entra sees differs from the IP the resource sees (split tunnelling, some proxies); Global Secure Access source IP restoration fixes that mismatch. CAE-evaluated sessions show <em>Continuous access evaluation: Yes</em> in sign-in details.</p>' +
      '<h3>Authentication context</h3>' +
      '<p>An authentication context is a tag (<code>c1</code> to <code>c99</code>) you create under <strong>Conditional Access &gt; Authentication contexts</strong> and publish to apps. A CA policy then targets the context instead of an app. When a resource asks for that context - a SharePoint site or sensitivity label, a Defender for Cloud Apps session policy, a PIM role activation, or your own app requesting the <code>acrs</code> claim - Entra evaluates the policies attached to it and steps the user up. It is how you protect <em>an action or a piece of content</em> rather than a whole application.</p>' +
      '<h3>Protected actions</h3>' +
      '<p>Protected actions apply an authentication context to specific <strong>Entra permissions</strong>. When an administrator tries one of them - creating, updating or deleting Conditional Access policies or named locations, changing cross-tenant access settings, hard-deleting directory objects - they must satisfy the CA policy for that context, even with an active session and the right role. Configure the context and its policy first, then assign it in <strong>Roles &amp; admins &gt; Protected actions</strong> (Conditional Access Administrator or Security Administrator).</p>' +
      C('powershell', String.raw`
# Authentication context c1, then a policy that requires phishing-resistant MFA whenever c1 is requested
New-MgIdentityConditionalAccessAuthenticationContextClassReference -Id 'c1' -DisplayName 'Sensitive administrative action' -Description 'Protected actions and PIM activation' -IsAvailable:$true

$policy = @{
    displayName   = 'CA030-AuthContext-c1-PhishResistant'
    state         = 'enabled'
    conditions    = @{ users = @{ includeUsers = @('All'); excludeGroups = @($bg) }
                       applications = @{ includeAuthenticationContextClassReferences = @('c1') } }
    grantControls = @{ operator = 'OR'; authenticationStrength = @{ id = '00000000-0000-0000-0000-000000000004' } }   # built-in Phishing-resistant MFA
    sessionControls = @{ signInFrequency = @{ isEnabled = $true; frequencyInterval = 'everyTime' } }
}
New-MgIdentityConditionalAccessPolicy -BodyParameter $policy`)) +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Sign-in frequency', 'Rolling 90-day refresh token', 'Every time for risky sign-ins and registration; hours for unmanaged devices', 'Default lifetimes suit managed devices'],
        ['Persistent browser session', 'User choice (KMSI)', 'Never persistent on unmanaged devices', 'Shared and kiosk machines'],
        ['Token protection', 'Off', 'Report-only, then On for supported Windows clients', 'Stolen refresh tokens stop working elsewhere'],
        ['CAE', 'On', 'On; strict location only where egress IPs are fully known', 'Strict mode punishes IP mismatches'],
        ['Authentication contexts', 'None', 'A small, named set (c1 admin actions, c2 sensitive content)', 'They are reused by many features'],
        ['Protected actions', 'None', 'CA policy and named location changes, cross-tenant access, hard delete', 'A stolen admin session cannot quietly weaken policy']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>Compliant device reported as unknown in the browser.</strong> The browser is not passing device identity - sign in to the Edge work profile or enable the Chrome integration.</p>' +
      '<p><strong>Persistent browser session control is greyed out.</strong> The policy does not target All resources.</p>' +
      '<p><strong>Users randomly kicked out after enabling strict location enforcement.</strong> The resource sees a different IP from Entra. Add all egress IPs, or use GSA source IP restoration.</p>' +
      '<p><strong>Authentication context never triggers.</strong> The context was not marked available, the resource was never configured to request it, or no policy targets it.</p>' +
      '<p><strong>Protected action locks admins out of CA changes.</strong> The context’s policy requires a method no admin has registered. Test the context policy in report-only first.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"unmanaged devices: view SharePoint in the browser, no downloads"', 'App enforced restrictions (or CA App Control for other apps)'],
        ['"reauthenticate every 4 hours on personal devices"', 'Sign-in frequency'],
        ['"do not stay signed in after closing the browser"', 'Persistent browser session: never'],
        ['"stolen refresh tokens must not work on another device"', 'Token protection'],
        ['"only compliant devices", "only Intune-managed"', 'Require device to be marked as compliant'],
        ['"admins only from privileged access workstations"', 'Filter for devices'],
        ['"revoke access within minutes when an account is disabled"', 'Continuous access evaluation'],
        ['"step-up MFA only for one SharePoint site"', 'Authentication context'],
        ['"require phishing-resistant MFA when activating a PIM role"', 'Authentication context in PIM role settings'],
        ['"require MFA before anyone modifies Conditional Access policies"', 'Protected actions']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
// Sessions evaluated with CAE, and token protection outcomes
SigninLogs
| where TimeGenerated > ago(1d)
| extend CAE = tostring(parse_json(tostring(AuthenticationProcessingDetails))), TP = tostring(TokenProtectionStatusDetails)
| project TimeGenerated, UserPrincipalName, AppDisplayName, IsInteractive, CAE, TP
| take 50`) +
      C('kql', String.raw`
// Step-up to an authentication context: sign-ins whose CA evaluation included c1
SigninLogs
| where TimeGenerated > ago(7d)
| mv-expand CA = ConditionalAccessPolicies
| where tostring(CA.displayName) startswith "CA030"
| summarize count() by tostring(CA.result), AppDisplayName`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('Conditional Access session controls', 'https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-session') + '</li>' +
      '<li>' + L('Filter for devices', 'https://learn.microsoft.com/entra/identity/conditional-access/concept-condition-filters-for-devices') + '</li>' +
      '<li>' + L('Continuous access evaluation', 'https://learn.microsoft.com/entra/identity/conditional-access/concept-continuous-access-evaluation') + '</li>' +
      '<li>' + L('Token protection', 'https://learn.microsoft.com/entra/identity/conditional-access/concept-token-protection') + '</li>' +
      '<li>' + L('Authentication context', 'https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-cloud-apps#authentication-context') + '</li>' +
      '<li>' + L('Protected actions', 'https://learn.microsoft.com/entra/identity/role-based-access-control/protected-actions-overview') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Add session and device controls to the 02-02 baseline, then build one authentication context and use it twice: for protected actions now, and for PIM activation in 04-03.',
    steps: [
      '<p>Create <code>CA010-Unmanaged-SPO-Limited</code>: all users, Office 365 SharePoint Online, grant access, session <strong>Use app enforced restrictions</strong>. In the SharePoint admin center set unmanaged device access to <em>Allow limited, web-only access</em>. Test from a personal browser.</p>',
      '<p>Create <code>CA011-Unmanaged-SignInFrequency</code>: all users, All resources, filter for devices excluding compliant and hybrid joined devices, sign-in frequency 4 hours and persistent browser session <em>Never persistent</em>. Report-only.</p>',
      '<p>If you have a Windows device enrolled in Intune: create a compliance policy requiring BitLocker, then a report-only policy requiring a compliant device for Exchange Online. Compare the report-only result from that device and from an unmanaged one.</p>',
      '<p>Sign a user in to Outlook on the web, then reset their password from the admin center. Time how long until Outlook forces a new sign-in. Find <em>Continuous access evaluation</em> in the sign-in’s details.</p>',
      '<p>Create authentication context <code>c1</code> and the <code>CA030</code> policy from the module (report-only first). Confirm your own admin account has a passkey, then switch it to On.</p>',
      '<p>In <strong>Roles &amp; admins &gt; Protected actions</strong>, assign <code>c1</code> to the permissions for updating and deleting Conditional Access policies. Sign out, sign in with a password and push MFA only, and try to edit a CA policy: you are asked to step up.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Keep', items: [
        'Keep c1, CA030 and the protected actions - 04-03 reuses c1 for PIM activation' ] },
      { bucket: '2', title: 'Remove or leave report-only', items: [
        'Leave CA011 in report-only unless you have managed devices, or users without one are blocked from everything every four hours' ] },
      { bucket: '3', title: 'Verify', items: [
        'bg01 can still edit Conditional Access policies with its passkey - the context policy excludes the emergency group' ] }
    ]
  },
  quiz: [
    { q: 'Users on unmanaged devices must be able to read SharePoint files in the browser but not download them. Which session control?', o: ['Sign-in frequency', 'Use app enforced restrictions', 'Persistent browser session', 'Customize continuous access evaluation'], a: 1, obj: 0,
      why: 'App enforced restrictions let SharePoint and Exchange Online provide a limited, web-only experience to unmanaged devices.' },
    { q: 'Users on personal devices must reauthenticate every four hours. Which control?', o: ['Sign-in frequency', 'Token protection', 'Authentication context', 'Terms of use'], a: 0, obj: 0,
      why: 'Sign-in frequency sets how long before reauthentication is required.' },
    { q: 'Global Administrators may sign in only from privileged access workstations tagged with extensionAttribute1 = PAW. What do you use?', o: ['Device platforms condition', 'Filter for devices', 'Named locations', 'Require hybrid joined device'], a: 1, obj: 1,
      why: 'Filter for devices matches device properties such as extension attributes. Device platform is self-reported and cannot identify specific devices.' },
    { q: 'Mobile users must access email only through apps protected by Intune MAM policies. Which grant control do you use in 2026?', o: ['Require approved client app', 'Require app protection policy', 'Require hybrid joined device', 'Require terms of use'], a: 1, obj: 1,
      why: 'Require approved client app was retired in June 2026; Require app protection policy replaces it.' },
    { q: 'A user is disabled, and Exchange Online must stop honouring their existing access token within minutes. Which feature makes this possible?', o: ['Sign-in frequency', 'Continuous access evaluation', 'Report-only mode', 'Seamless SSO'], a: 1, obj: 2,
      why: 'CAE-capable resources subscribe to critical events such as account disable and reject the token.' },
    { q: 'After enabling strict location enforcement, users on a split-tunnel VPN are repeatedly signed out. Why?', o: ['CAE is disabled', 'The IP address seen by the resource differs from the one seen by Entra ID', 'Their devices are not compliant', 'Token protection is on'], a: 1, obj: 2,
      why: 'Strict mode rejects tokens when the resource-observed IP is not an allowed location, which split tunnelling commonly causes.' },
    { q: 'Only one confidential SharePoint site should require phishing-resistant MFA; the rest of SharePoint uses normal MFA. What do you configure?', o: ['A policy targeting SharePoint Online', 'An authentication context applied to the site and a CA policy targeting it', 'Protected actions', 'A filter for applications'], a: 1, obj: 3,
      why: 'Authentication context lets a resource request step-up for specific content, which a CA policy targeting that context enforces.' },
    { q: 'Any administrator who modifies a Conditional Access policy must first complete phishing-resistant MFA, even mid-session. What do you implement?', o: ['PIM approval', 'Protected actions with an authentication context', 'Sign-in frequency every time for admins', 'A restricted management AU'], a: 1, obj: 4,
      why: 'Protected actions attach an authentication context to specific Entra permissions, forcing step-up when they are used.' }
  ]
});

/* ======================================================================
   02-04  ID Protection
   ====================================================================== */
MODULES.push({
  id: '02-04', domain: '02', title: 'Risk with Microsoft Entra ID Protection', short: 'ID Protection',
  group: 'Manage risk by using Microsoft Entra ID Protection',
  objectives: [
    'Implement and manage user risk by using Microsoft Entra ID Protection or Conditional Access policies',
    'Implement and manage sign-in risk by using Microsoft Entra ID Protection or Conditional Access policies',
    'Implement and manage multifactor authentication registration by using authentication methods and registration campaigns',
    'Monitor, investigate and remediate risky users and risky sign-ins',
    'Monitor, investigate, and remediate risky workload identities'
  ],
  status: 'GA', verified: '',
  cost: { level: 'none', label: '$0', est: '$0 with P2 from the trial. Full risky workload identity detail needs Workload Identities Premium, which the lab only reads about.', meter: 'none' },
  portal: 'Entra admin center &gt; ID Protection &gt; Risky users · Risky sign-ins · Risky workload identities · Risk detections · Authentication methods &gt; Registration campaign',
  ms: [{ t: "Manage Microsoft Entra Identity Protection", u: "https://learn.microsoft.com/en-us/training/modules/manage-azure-active-directory-identity-protection/" }],
  sdk: '<code>Microsoft.Graph.Identity.SignIns</code>',
  kql: '<code>AADRiskyUsers</code> <code>AADUserRiskEvents</code> <code>AADRiskyServicePrincipals</code> <code>AADServicePrincipalRiskEvents</code> <code>SigninLogs</code>',
  prereq: ['02-02'],
  tactical: 'Risk detections are leads, not verdicts, and the offline ones arrive late - atypical travel, token issuer anomaly and the Microsoft Entra threat intelligence detections can land hours after the sign-in. For triage, pivot from the detection to the session: same <code>SessionId</code> or correlation ID from a new IP, new device, or immediately followed by inbox rule creation or app consent. <em>Confirm compromised</em> is not only a label: it sets user risk to high, which your user-risk policy then enforces, and feeds the models. <em>Dismiss</em> without investigation trains nothing and closes the door on the timeline.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>ID Protection scores two things. <strong>Sign-in risk</strong> is the probability that a given authentication request is not from the account owner. <strong>User risk</strong> is the probability that the account itself is compromised, aggregated from detections over time. Each is Low, Medium or High, and each feeds a Conditional Access condition.</p>' +
      Q('warn', '<strong>' + DUE('2026-10-01', 'Retirement date: October 1, 2026.', 'Retired on October 1, 2026.') + '</strong> The legacy user risk and sign-in risk policies configured inside ID Protection have been read-only since mid-2025 and ' + DUE('2026-10-01', 'retire', 'were retired') + ' on <strong>October 1, 2026</strong>. Risk-based enforcement now lives in Conditional Access. The outline’s "ID Protection or Conditional Access" wording predates that; answer with Conditional Access.')) +
    S('mechanism', 'How it works under the hood',
      '<h3>Detections</h3>' +
      T('compare', ['Detection', 'Feeds', 'Timing'], [
        ['Anonymous IP address', 'Sign-in', 'Real-time'],
        ['Unfamiliar sign-in properties', 'Sign-in', 'Real-time'],
        ['Password spray', 'Sign-in', 'Real-time or offline'],
        ['Anomalous token', 'Sign-in', 'Real-time or offline'],
        ['Atypical travel', 'Sign-in', 'Offline'],
        ['Malicious IP address', 'Sign-in', 'Offline'],
        ['Token issuer anomaly', 'Sign-in', 'Offline'],
        ['Attacker in the Middle (via Defender XDR)', 'Sign-in', 'Offline'],
        ['Leaked credentials', 'User', 'Offline - needs password hash sync for synced users'],
        ['Possible attempt to access Primary Refresh Token', 'User', 'Offline'],
        ['User reported suspicious activity', 'User', 'When reported'],
        ['Microsoft Entra threat intelligence', 'Sign-in and user', 'Real-time or offline']
      ]) +
      '<h3>Enforcing with Conditional Access</h3>' +
      T('compare', ['Policy', 'Condition', 'Grant', 'Session'], [
        ['Sign-in risk', 'Sign-in risk Medium and High', 'Require MFA (or an authentication strength)', 'Sign-in frequency: every time'],
        ['User risk', 'User risk High', '<strong>Require risk remediation</strong> (auto-selects an authentication strength). Older form: password change <strong>and</strong> MFA, require all', 'Sign-in frequency: every time (mandatory)']
      ]) +
      '<p>Both exclude the emergency access group and start in report-only. When users satisfy them, they <strong>self-remediate</strong>: MFA closes the risky sign-in, and a secure password change resets user risk. A password changed on-premises can reset user risk too when <em>Allow on-premises password change to reset user risk</em> is on (which needs password hash sync). Passwordless users cannot change a password they do not use, which is why Microsoft’s current procedure uses the <em>Require risk remediation</em> grant: it revokes sessions and lets password and passwordless users remediate with the chosen authentication strength. The script below shows the older password change + MFA form, which you will still meet in exam items and existing tenants.</p>' +
      C('powershell', String.raw`
$userRisk = @{
    displayName = 'CA040-AllUsers-UserRiskHigh-PasswordChange'
    state       = 'enabledForReportingButNotEnforced'
    conditions  = @{
        users            = @{ includeUsers = @('All'); excludeGroups = @($bg) }
        applications     = @{ includeApplications = @('All') }
        userRiskLevels   = @('high')
    }
    grantControls   = @{ operator = 'AND'; builtInControls = @('mfa', 'passwordChange') }
    sessionControls = @{ signInFrequency = @{ isEnabled = $true; frequencyInterval = 'everyTime' } }
}
New-MgIdentityConditionalAccessPolicy -BodyParameter $userRisk`) +
      '<h3>Investigating and remediating</h3>' +
      T('compare', ['Action', 'Where', 'Effect'], [
        ['Confirm user compromised', 'Risky users', 'Sets user risk to High; the user-risk policy applies at next sign-in'],
        ['Confirm sign-in compromised / safe', 'Risky sign-ins', 'Raises or clears that sign-in’s risk and tunes the model'],
        ['Reset password', 'Risky users', 'Clears user risk once the admin-generated password is used (temporary password forces change)'],
        ['Dismiss user risk', 'Risky users', 'Sets risk to none; use only after investigation or for false positives'],
        ['Block user', 'Risky users', 'Stops sign-in while you investigate']
      ]) +
      C('powershell', String.raw`
Get-MgRiskyUser -Filter "riskLevel eq 'high'" | Select-Object UserPrincipalName, RiskState, RiskDetail, RiskLastUpdatedDateTime
Invoke-MgGraphRequest -Method POST -Uri 'v1.0/identityProtection/riskyUsers/confirmCompromised' -Body @{ userIds = @($id) }
Invoke-MgGraphRequest -Method POST -Uri 'v1.0/identityProtection/riskyUsers/dismiss' -Body @{ userIds = @($id) }`) +
      '<h3>MFA registration</h3>' +
      '<p>Two tools get users registered. The <strong>registration campaign</strong> (Authentication methods &gt; Registration campaign) nudges users at sign-in to register a stronger method - the Authenticator app, and passkeys in tenants on passkey profiles - with a limited number of snoozes; it can be Microsoft managed, enabled or disabled, and targeted at groups. The older <strong>MFA registration policy</strong> in ID Protection requires registration at sign-in with a 14-day grace period. Pair either with the <em>Register security information</em> CA user action from 02-02 so that registration itself is protected.</p>' +
      '<h3>Risky workload identities</h3>' +
      '<p>Service principals get their own detections - leaked credentials (secrets found in public repositories), suspicious sign-ins, malicious or suspicious application, anomalous service principal activity, and admin-confirmed compromise - in <strong>Risky workload identities</strong>. Full details and the ability to use service principal risk in Conditional Access need <strong>Workload Identities Premium</strong>, and CA for workload identities covers single-tenant service principals only, not managed identities. Remediation is ownership work: rotate or remove credentials, review recent sign-ins and permissions, disable the service principal, then confirm compromised or dismiss.</p>') +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Legacy ID Protection risk policies', 'Read-only', 'Recreate in CA, then turn off', 'Retired October 1, 2026'],
        ['Sign-in risk policy (CA)', 'None', 'Medium and High: MFA, sign-in frequency every time', 'Every time forces a fresh proof'],
        ['User risk policy (CA)', 'None', 'High: require risk remediation (older form: password change + MFA, require all)', 'Works for passwordless users too'],
        ['Allow on-premises password change to reset user risk', 'Off', 'On (with PHS)', 'Remediation for users who reset on-premises'],
        ['Registration campaign', 'Microsoft managed', 'Enabled for all users, limited snoozes', 'Nudges users off SMS and voice'],
        ['Named locations marked trusted', '-', 'Only locations you control', 'Trusted locations lower sign-in risk']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>User risk never clears after an admin reset.</strong> The admin set a password without requiring change; the user never completed a secure change. Use a temporary password or let the user self-remediate.</p>' +
      '<p><strong>Sign-in risk policy blocks unregistered users.</strong> They cannot satisfy MFA. Get them registered first - registration campaign and the registration user action.</p>' +
      '<p><strong>Leaked credentials never fire for synced users.</strong> Password hash sync is off.</p>' +
      '<p><strong>No risk data on service principals.</strong> Workload Identities Premium is missing, or the identity is a managed identity.</p>' +
      '<p><strong>Alerts expected in Defender for Cloud Apps.</strong> ID Protection alerts moved to Microsoft Defender XDR in 2025.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"force remediation when the account is likely compromised"', 'User risk condition + require risk remediation (or password change + MFA)'],
        ['"require MFA when the sign-in is unusual"', 'Sign-in risk condition + require MFA'],
        ['"users must register the Authenticator app, with a few snoozes allowed"', 'Registration campaign'],
        ['"users must register MFA at next sign-in"', 'MFA registration policy (or CA user action)'],
        ['"the investigation confirmed the account was compromised"', 'Confirm user compromised'],
        ['"false positive from the office VPN"', 'Confirm sign-in safe / dismiss; mark the VPN range trusted'],
        ['"application credentials were found in a public GitHub repository"', 'Risky workload identities: leaked credentials'],
        ['"block a service principal from signing in outside corporate IPs"', 'CA for workload identities (Workload Identities Premium)']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
AADUserRiskEvents
| where TimeGenerated > ago(30d)
| summarize Detections = count(), Users = dcount(UserPrincipalName) by RiskEventType, RiskLevel, DetectionTimingType
| order by Detections desc`) +
      C('kql', String.raw`
// Sign-ins that carried risk, and whether CA made the user prove themselves
SigninLogs
| where TimeGenerated > ago(7d) and RiskLevelDuringSignIn in ("medium", "high")
| project TimeGenerated, UserPrincipalName, IPAddress, RiskLevelDuringSignIn, RiskEventTypes_V2, ConditionalAccessStatus, AuthenticationRequirement, ResultType`) +
      C('kql', String.raw`
AADServicePrincipalRiskEvents
| where TimeGenerated > ago(30d)
| project TimeGenerated, ServicePrincipalDisplayName, RiskEventType, RiskLevel, RiskState`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('What are risk detections?', 'https://learn.microsoft.com/entra/id-protection/concept-identity-protection-risks') + '</li>' +
      '<li>' + L('Risk-based access policies (and migration to Conditional Access)', 'https://learn.microsoft.com/entra/id-protection/concept-identity-protection-policies') + '</li>' +
      '<li>' + L('Remediate risks and unblock users', 'https://learn.microsoft.com/entra/id-protection/howto-identity-protection-remediate-unblock') + '</li>' +
      '<li>' + L('Registration campaign', 'https://learn.microsoft.com/entra/identity/authentication/how-to-mfa-registration-campaign') + '</li>' +
      '<li>' + L('Securing workload identities', 'https://learn.microsoft.com/entra/id-protection/concept-workload-identity-risk') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Generate real detections with Microsoft’s documented simulations, enforce risk through Conditional Access, and remediate one user each way.',
    steps: [
      '<p>Open <strong>ID Protection &gt; Dashboard</strong>. If legacy user or sign-in risk policies show as enabled, record their settings.</p>',
      '<p>Create the sign-in risk and user risk policies in Conditional Access (report-only), both excluding the emergency group. Use the <em>Emerging threats</em> or <em>Zero Trust</em> templates or the PowerShell in the module.</p>',
      '<p>Simulate <strong>Anonymous IP address</strong>: sign in to myapps.microsoft.com as a lab user from the Tor Browser. Find the risky sign-in within minutes.</p>',
      '<p>Simulate <strong>Unfamiliar sign-in properties</strong>: sign in as a different lab user through a VPN exit in a country they have never used. Detection may take up to an hour.</p>',
      '<p>For the first user, <strong>Confirm user compromised</strong>. Switch the user risk policy to On, sign in as the user, and complete the password change. Watch the risk state become <em>Remediated</em>.</p>',
      '<p>For the second user, investigate the risky sign-in’s details and the user’s recent sign-ins, then <strong>Confirm sign-in safe</strong> and note the effect on user risk.</p>',
      '<p>In <strong>Authentication methods &gt; Registration campaign</strong>, enable the campaign for <code>DYN-Sales</code> with one snooze day. Sign in as a Sales user registered only for SMS and see the nudge.</p>',
      '<p>Open <strong>Risky workload identities</strong>. On any lab service principal, choose <strong>Confirm compromised</strong> (if available with your licence) and review what the blade shows and what it withholds without Workload Identities Premium.</p>',
      '<p>If legacy policies existed, turn them off now that the CA equivalents are enforced.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Keep', items: [
        'Keep both risk policies on - they are part of the baseline' ] },
      { bucket: '2', title: 'Clean up', items: [
        'Dismiss or remediate any remaining lab risky users so later labs are not challenged unexpectedly' ] },
      { bucket: '3', title: 'Verify', items: [
        'ID Protection &gt; Risky users shows no High users other than those you are deliberately keeping' ] }
    ]
  },
  quiz: [
    { q: 'Accounts with a high probability of compromise must change their password securely at next sign-in. In 2026, how do you implement this?', o: ['ID Protection user risk policy', 'Conditional Access policy: user risk High, require risk remediation (or password change and MFA)', 'Sign-in risk policy requiring MFA', 'SSPR with two methods'], a: 1, obj: 0,
      why: 'Legacy ID Protection risk policies have a retirement date of October 1, 2026, with no automatic migration; user risk is enforced by a Conditional Access user risk policy. Microsoft now documents Require risk remediation; password change + MFA is the older equivalent.' },
    { q: 'Sign-ins from anonymous IP addresses or with unfamiliar properties must require MFA at that moment. Which condition?', o: ['User risk', 'Sign-in risk', 'Insider risk', 'Device platforms'], a: 1, obj: 1,
      why: 'These are sign-in risk detections; a sign-in risk policy requires MFA for the risky request itself.' },
    { q: 'Why should a sign-in risk policy include sign-in frequency set to every time?', o: ['It reduces licence cost', 'It prevents a cached session from satisfying the challenge', 'It is required for report-only', 'It enables CAE'], a: 1, obj: 1,
      why: 'Every time forces a fresh authentication for the risky sign-in rather than accepting an existing session.' },
    { q: 'Users still on SMS should be prompted at sign-in to set up the Authenticator app, with a small number of snoozes. What do you configure?', o: ['Security defaults', 'The registration campaign', 'Report suspicious activity', 'Per-user MFA'], a: 1, obj: 2,
      why: 'The registration campaign nudges users to register a stronger method during sign-in, with configurable snoozes.' },
    { q: 'An investigation proves a user’s account was used by an attacker. What should you do in ID Protection?', o: ['Dismiss user risk', 'Confirm user compromised', 'Confirm sign-in safe', 'Delete the risk detection'], a: 1, obj: 3,
      why: 'Confirming compromise sets user risk to High, which triggers the user risk policy and informs the models.' },
    { q: 'Leaked credentials detections never appear for synced users. What is missing?', o: ['Pass-through authentication', 'Password hash synchronization', 'Seamless SSO', 'Connect Health'], a: 1, obj: 3,
      why: 'Leaked credentials detection compares against password hashes, which only PHS provides for synced users.' },
    { q: 'An app registration’s client secret was published in a public repository. Where does this surface, and what licence gives full detail?', o: ['Risky users; P2', 'Risky workload identities; Workload Identities Premium', 'Risky sign-ins; P1', 'Audit logs; none'], a: 1, obj: 4,
      why: 'Leaked credentials for service principals is a workload identity risk detection; full detail and CA use need Workload Identities Premium.' }
  ]
});

/* ======================================================================
   02-05  Global Secure Access
   ====================================================================== */
MODULES.push({
  id: '02-05', domain: '02', title: 'Global Secure Access: Clients, Private Access and Internet Access', short: 'Global Secure Access',
  group: 'Implement Global Secure Access',
  objectives: [
    'Deploy Global Secure Access clients',
    'Deploy and manage Private Access',
    'Deploy and manage Internet Access',
    'Deploy and manage Internet Access for Microsoft 365'
  ],
  status: 'GA', verified: '',
  cost: { level: 'mid', label: 'Medium', est: 'Reuses sync01 from 01-04 as the connector host and needs an Entra joined Windows client - a VM adds about US$1-2 a day running. Microsoft traffic needs only P1; Private and Internet Access need their own licences or the Entra Suite trial.', meter: 'hourly · client VM + sync01' },
  portal: 'Entra admin center &gt; Global Secure Access &gt; Connect &gt; Traffic forwarding · Client download · Applications · Secure &gt; Web content filtering policies · Security profiles · Monitor &gt; Traffic logs',
  ms: [{ t: "Deploy and Configure Microsoft Entra Global Secure Access", u: "https://learn.microsoft.com/en-us/training/modules/deploy-configure-microsoft-entra-global-secure-access/" }],
  sdk: '<code>Microsoft.Graph.Beta.NetworkAccess</code> <code>Microsoft.Graph</code>',
  kql: '<code>NetworkAccessTraffic</code> <code>SigninLogs</code>',
  prereq: ['01-04', '02-02'],
  tactical: 'Global Secure Access changes what the logs can tell you. With source IP restoration, Entra sign-in logs keep the user’s real public IP instead of the proxy egress IP, so location policies and risk detections still work. Traffic logs add what VPN logs never had: which user, on which device, reached which private FQDN and port, and which web categories they touched - joinable to sign-ins on user and device. The compliant network condition is also a token-theft control: a session token replayed from outside your tunnel fails Conditional Access even though MFA was satisfied.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>Global Secure Access is Microsoft’s Security Service Edge: a client (or a branch tunnel) sends traffic to Microsoft’s edge, which applies identity-aware policy before it reaches the destination. It replaces the VPN for private apps and the proxy for internet traffic, with Conditional Access deciding who gets through.</p>' +
      T('compare', ['Traffic forwarding profile', 'Covers', 'Licence', 'Objective wording'], [
        ['Microsoft traffic', 'Microsoft 365 and Entra endpoints', 'Microsoft Entra ID P1 or P2', '"Internet Access for Microsoft 365"'],
        ['Private Access', 'Your private apps by FQDN or IP and port', 'Entra Private Access, or Entra Suite', '"Private Access"'],
        ['Internet Access', 'Everything else on the internet, including SaaS', 'Entra Internet Access, or Entra Suite', '"Internet Access"']
      ]) +
      '<p>The Microsoft 365 profile was renamed <strong>Microsoft traffic</strong>; the exam still uses the older name.</p>') +
    S('mechanism', 'How it works under the hood',
      '<h3>Clients</h3>' +
      '<p>The <strong>Global Secure Access client</strong> is available for Windows (64-bit Windows 11, Windows 10 LTSC 2021 or newer, and Arm64 Windows 11 with its own installer; the device should be <strong>Microsoft Entra joined or hybrid joined</strong> - Entra <em>registered</em> BYOD devices are supported in preview but tunnel Private Access traffic only, and Azure Virtual Desktop multi-session is not supported), macOS, Android and iOS (the mobile clients ship inside the Microsoft Defender app). Deploy it with Intune or any software distribution tool; it signs in as the user, acquires traffic that matches the enabled profiles and tunnels each category separately, carrying the user’s Entra token so policy is evaluated per request. <strong>Remote networks</strong> connect a branch router by IPsec for Microsoft and internet traffic without a client.</p>' +
      '<h3>Private Access</h3>' +
      '<p>Private Access reaches internal apps through <strong>Microsoft Entra private network connectors</strong> - the same outbound-only connector as Application Proxy (03-02) - installed on Windows servers with line of sight to the apps and grouped into connector groups. Two ways to publish:</p>' +
      T('compare', ['', 'Quick Access', 'Per-app access (Global Secure Access apps)'], [
        ['Shape', 'One enterprise app containing many FQDN/IP segments', 'One enterprise app per application'],
        ['Purpose', 'Replace the VPN quickly', 'Least privilege: different users, different apps, different CA'],
        ['Conditional Access', 'One policy for everything in Quick Access', 'A policy per app'],
        ['Private DNS', 'Configured on Quick Access: suffixes resolved on-premises', 'Uses the same private DNS']
      ]) +
      '<p>Because the connector runs on-premises, Private Access can also carry Kerberos to domain resources, giving SSO to file shares and intranet apps from Entra joined devices.</p>' +
      '<h3>Internet Access</h3>' +
      '<p><strong>Web content filtering policies</strong> allow or block by web category or FQDN. Policies are grouped into <strong>security profiles</strong> with priorities. The <strong>baseline profile</strong> applies to all internet traffic; other profiles apply to users through a <strong>Conditional Access policy</strong> that targets <em>All internet resources with Global Secure Access</em> and uses the session control <em>Use Global Secure Access security profile</em>. That is how "block gambling sites for Sales only" is built. TLS inspection and threat intelligence filtering add depth on top.</p>' +
      '<h3>Microsoft traffic</h3>' +
      T('compare', ['Capability', 'What it gives you'], [
        ['Source IP restoration', 'Entra sees the user’s original public IP, so named locations and risk detections keep working'],
        ['Compliant network check', 'CA network condition <em>All compliant network locations</em>: tokens work only through your tunnel'],
        ['Universal tenant restrictions', 'Tenant restrictions v2 enforced on all client traffic, blocking sign-in to unknown tenants'],
        ['Traffic logs', 'Per-user, per-device logs of Microsoft 365 access']
      ]) +
      '<p>Enable <strong>Global Secure Access signaling for Conditional Access</strong> (Settings &gt; Session management &gt; Adaptive access) before using source IP restoration or the compliant network condition.</p>') +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Traffic forwarding profiles', 'All off', 'Microsoft traffic for all; Private and Internet as licensed', 'Each profile is enabled and assigned separately'],
        ['Client deployment', 'None', 'Intune Win32 app to Entra joined devices', 'Joined devices get every profile; registered BYOD devices (preview) get Private Access only'],
        ['Connectors', 'None', 'Two or more per connector group', 'Every private request goes through one'],
        ['Quick Access vs per-app', '-', 'Quick Access to start, per-app for sensitive apps', 'Least privilege over time'],
        ['Baseline security profile', 'Empty', 'Block malware and adult categories for everyone', 'Applies without a CA policy'],
        ['GSA signaling in CA', 'Off', 'On', 'Required for source IP restoration and compliant network'],
        ['Users can disable the client', 'Allowed (Private Access toggle)', 'Restrict for managed devices', 'A disabled client bypasses policy']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>Client installed, nothing tunnelled.</strong> The profile is not enabled or the user is not assigned to it, or the Windows device is only Entra registered - registered devices tunnel Private Access traffic only.</p>' +
      '<p><strong>Private app times out.</strong> No active connector in the group has line of sight to the app, or its FQDN is not in Private DNS suffixes.</p>' +
      '<p><strong>Web filtering applies to nobody.</strong> The security profile is not linked through a CA policy targeting All internet resources with Global Secure Access.</p>' +
      '<p><strong>Sign-in logs show Microsoft proxy IPs.</strong> GSA signaling for CA is off, so source IP restoration is not active.</p>' +
      '<p><strong>Everything blocked after adding the compliant network condition.</strong> Users off the client (mobile, unmanaged) fail it. Scope it.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"replace the VPN for all internal apps quickly"', 'Private Access, Quick Access'],
        ['"different CA policies for the HR app and the finance app on-premises"', 'Per-app Private Access (Global Secure Access apps)'],
        ['"connector with outbound-only connections"', 'Private network connector'],
        ['"block social media for Sales users"', 'Web content filtering policy in a security profile, linked by CA'],
        ['"apply to all internet traffic without CA"', 'Baseline security profile'],
        ['"only allow Microsoft 365 access through the corporate SSE"', 'Microsoft traffic profile + compliant network condition'],
        ['"keep the user’s original IP in sign-in logs"', 'Source IP restoration'],
        ['"block access to other tenants from managed devices"', 'Universal tenant restrictions'],
        ['"Windows client prerequisites"', '64-bit Windows 11 or Windows 10 LTSC 2021+, Entra joined or hybrid joined; registered BYOD = Private Access only (preview)']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
NetworkAccessTraffic
| where TimeGenerated > ago(1d)
| summarize Flows = count(), Bytes = sum(SentBytes + ReceivedBytes) by TrafficType, Action, UserPrincipalName
| order by Flows desc`) +
      C('kql', String.raw`
// Private app access by user and destination
NetworkAccessTraffic
| where TimeGenerated > ago(1d) and TrafficType == "private"
| project TimeGenerated, UserPrincipalName, DeviceId, DestinationFqdn, DestinationPort, Action, ConnectorId`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('Global Secure Access traffic forwarding profiles', 'https://learn.microsoft.com/entra/global-secure-access/concept-traffic-forwarding') + '</li>' +
      '<li>' + L('Global Secure Access clients', 'https://learn.microsoft.com/entra/global-secure-access/concept-clients') + '</li>' +
      '<li>' + L('Configure Quick Access', 'https://learn.microsoft.com/entra/global-secure-access/how-to-configure-quick-access') + '</li>' +
      '<li>' + L('Use Kerberos for single sign-on with Microsoft Entra Private Access', 'https://learn.microsoft.com/entra/global-secure-access/how-to-configure-kerberos-sso') + '</li>' +
      '<li>' + L('Web content filtering', 'https://learn.microsoft.com/entra/global-secure-access/how-to-configure-web-content-filtering') + '</li>' +
      '<li>' + L('Enable the Microsoft traffic profile', 'https://learn.microsoft.com/entra/global-secure-access/how-to-manage-microsoft-profile') + '</li>' +
      '<li>' + L('Source IP restoration', 'https://learn.microsoft.com/entra/global-secure-access/how-to-source-ip-restoration') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Start the Entra Suite trial. You need an Entra joined Windows 11 device: a physical PC, or an Azure VM joined with the Microsoft Entra login extension. sync01 from 01-04 hosts the connector.',
    steps: [
      '<p>Start the <strong>Microsoft Entra Suite</strong> trial and assign it to your test users. Enable GSA signaling for Conditional Access.</p>',
      '<p>Enable the <strong>Microsoft traffic</strong> profile and assign it to all users. Install the Global Secure Access client on the Entra joined Windows device, sign in, and run the client’s <strong>Health check</strong>.</p>',
      '<p>Sign in to Outlook on the web from the device. Find the sign-in in Entra and confirm the IP is your real public IP (source IP restoration), then find the flow in <strong>Traffic logs</strong>.</p>',
      '<p>Start dc01 and sync01. On sync01, install the <strong>private network connector</strong> from Global Secure Access &gt; Connect &gt; Connectors. Confirm it shows Active.</p>',
      '<p>Configure <strong>Quick Access</strong> with an app segment for dc01’s FQDN on ports 445 and 3389, and a private DNS suffix of <code>corp.lab.local</code>. Enable the Private Access profile. From the client device (off the lab VNet), open <code>\\\\dc01.corp.lab.local\\SYSVOL</code>.</p>',
      '<p>Enable the <strong>Internet Access</strong> profile. Create a web content filtering policy blocking the <em>Gambling</em> category, put it in a security profile, and link it with a CA policy for <code>DYN-Sales</code> targeting All internet resources with Global Secure Access. Test as a Sales and a non-Sales user.</p>',
      '<p>Create a report-only CA policy for Office 365 requiring <strong>All compliant network locations</strong>. Compare report-only results from the client device and from a phone without the client.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'VMs', items: [
        'Deallocate dc01, sync01 and any client VM' ] },
      { bucket: '2', title: 'Configuration', items: [
        'Disable the Internet Access and Private Access profiles when the trial ends, or users lose connectivity to those destinations',
        'Delete the compliant network CA policy or leave it in report-only' ] },
      { bucket: '3', title: 'Verify', items: [
        '<code>Get-AzVM -Status</code> shows every lab VM deallocated',
        '<strong>Check Cost Management tomorrow, not today.</strong>' ] }
    ]
  },
  quiz: [
    { q: 'Which Windows devices can run the Global Secure Access client with every traffic profile (Microsoft, Internet and Private Access)?', o: ['Any Windows 10/11 device', '64-bit Windows devices that are Microsoft Entra joined or hybrid joined', 'Only Windows Server', 'Microsoft Entra registered personal devices'], a: 1, obj: 0,
      why: 'Joined and hybrid joined devices get every profile. Entra registered BYOD devices are supported in preview but tunnel Private Access traffic only.' },
    { q: 'You must replace the VPN for all internal apps as quickly as possible with a single policy. What do you configure?', o: ['Per-app Private Access', 'Quick Access', 'Application Proxy for each app', 'Remote networks'], a: 1, obj: 1,
      why: 'Quick Access publishes many FQDN and IP segments in one app for fast VPN replacement; per-app access is for granular policy later.' },
    { q: 'Which component gives Private Access line of sight to on-premises apps?', o: ['Global Secure Access client', 'Microsoft Entra private network connector', 'Remote network IPsec tunnel', 'PTA agent'], a: 1, obj: 1,
      why: 'Private network connectors, shared with Application Proxy, make outbound connections from inside the network.' },
    { q: 'Sales users must be blocked from gambling sites; others must not be affected. What do you build?', o: ['A baseline security profile', 'A web content filtering policy in a security profile, linked by a CA policy scoped to Sales', 'A named location', 'A Defender for Cloud Apps session policy'], a: 1, obj: 2,
      why: 'Security profiles apply to users through CA using the Global Secure Access security profile session control; the baseline profile would apply to everyone.' },
    { q: 'Microsoft 365 access must be allowed only through your Global Secure Access tunnel, so a stolen token replayed elsewhere fails. What do you use?', o: ['Tenant restrictions v2 only', 'The Microsoft traffic profile with a CA policy requiring all compliant network locations', 'Sign-in frequency', 'App enforced restrictions'], a: 1, obj: 3,
      why: 'The compliant network condition, available once Microsoft traffic flows through GSA, fails requests that did not come through the tunnel.' },
    { q: 'After enabling the Microsoft traffic profile, sign-in logs show Microsoft edge IPs and location policies stop matching. What should you enable?', o: ['Universal tenant restrictions', 'Global Secure Access signaling for Conditional Access (source IP restoration)', 'Quick Access', 'Strict location enforcement'], a: 1, obj: 3,
      why: 'Source IP restoration, enabled via GSA signaling for CA, preserves the user’s original IP for Entra.' }
  ]
});
