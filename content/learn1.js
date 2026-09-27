/* learn.js - SC-300 guide
   Six primers on what the exam assumes rather than asks, in this guide's own
   words. Every unit carries a visual and defines its key terms; the glossary is
   built from those definitions. */

function MSD(t, u) { return { t: t, u: u }; }
var LEARN = [];

/* ======================================================================
   L1  The directory
   ====================================================================== */
LEARN.push({
  id: 'L1', title: 'The Directory: Tenants, Objects and Roles', short: 'The directory', mins: 20,
  summary: 'What a Microsoft Entra tenant actually is, which objects live in it, how they differ from Active Directory, and how roles and scopes decide who can change them.',
  ms: [MSD("Explore identity in Microsoft Entra ID", "https://learn.microsoft.com/training/modules/explore-identity-azure-active-directory"), MSD("Implement initial configuration of Microsoft Entra ID", "https://learn.microsoft.com/en-us/training/modules/implement-initial-configuration-of-azure-active-directory/"), MSD('What is Microsoft Entra?', 'https://learn.microsoft.com/entra/fundamentals/what-is-entra'), MSD('Microsoft Entra built-in roles', 'https://learn.microsoft.com/entra/identity/role-based-access-control/permissions-reference')],
  mods: ['01-01', '01-02'],
  units: [
    { t: 'A tenant is a directory, a boundary and a trust anchor',
      body: '<p>A <strong>tenant</strong> is one instance of Microsoft Entra ID, created when an organisation first signs up for a Microsoft cloud service. It holds a directory of objects, issues tokens for them, and is the boundary for policy: Conditional Access, authentication methods and settings apply inside one tenant and nowhere else. Every tenant has a permanent <strong>tenant ID</strong> (a GUID) and an initial domain ending in <code>.onmicrosoft.com</code>.</p>' +
        '<p>Other services trust the tenant rather than holding their own identities. An Azure subscription trusts exactly one tenant; Microsoft 365 workloads use the tenant’s users and groups; applications register in it. That is why moving a subscription between tenants breaks every role assignment on it.</p>',
      vis: vNest([
        { t: 'Microsoft Entra tenant', s: 'tenant ID, initial domain, policies', k: 'd1' },
        { t: 'Directory', s: 'the objects', k: 'acc', chips: ['Users', 'Groups', 'Devices', 'Applications', 'Service principals', 'Administrative units'] }
      ], 'Everything in this guide acts on objects inside one tenant, under that tenant’s policies.'),
      terms: [['Tenant', 'A dedicated instance of Microsoft Entra ID for one organisation: its directory, policies and token issuer.'],
              ['Tenant ID', 'The permanent GUID that identifies a tenant; used in endpoints, cross-tenant settings and logs.'],
              ['Initial domain', 'The <code>.onmicrosoft.com</code> domain created with the tenant; it cannot be removed.'],
              ['Verified domain', 'A custom domain whose ownership was proven with a DNS record; only verified domains can be UPN suffixes.']] },
    { t: 'Objects and their source of authority',
      body: '<p>Users, groups and devices are directory objects with properties. The property that matters most for administration is the <strong>source of authority</strong>: an object created in the cloud is edited in the cloud; an object synchronized from Active Directory is edited on-premises, and most of its properties are read-only in Entra. A user’s <code>userType</code> (Member or Guest) is separate from where it came from - a guest can be a member, and a member can be external.</p>' +
        '<p>Entra is not Active Directory in the cloud. There are no OUs, no Group Policy, no LDAP or Kerberos for your servers (except through Entra Kerberos and Domain Services), and no forest trusts. Structure comes from groups, administrative units and attributes instead.</p>',
      vis: vVs({ t: 'Active Directory DS', k: 'd1', items: ['OUs and Group Policy', 'Kerberos and NTLM, LDAP', 'Domain controllers you run', 'Forests and trusts'] },
                { t: 'Microsoft Entra ID', k: 'd2', items: ['Groups, AUs and attributes', 'OAuth 2.0, OIDC, SAML', 'A global service Microsoft runs', 'Tenants and cross-tenant settings'] },
                'Same identities, different machinery. Questions often hinge on a feature that exists on one side only.'),
      terms: [['Source of authority', 'Where an object is mastered: Entra (cloud) or Active Directory (synced). The mastered side is where you edit it.'],
              ['userType', 'Member or Guest. Controls default permissions; independent of whether the user is internal or external.'],
              ['Directory object', 'Any entity in the tenant with an object ID: user, group, device, application, service principal and so on.'],
              ['Soft delete', 'Deleted users, groups and applications are kept for 30 days and can be restored with their memberships.']] },
    { t: 'Roles, assignments and scope',
      body: '<p>A <strong>role definition</strong> is a list of permissions such as <code>microsoft.directory/users/password/update</code>. A <strong>role assignment</strong> gives a role to a principal at a <strong>scope</strong>: the whole tenant, an administrative unit, or a single object such as one application. Permissions from every assignment add up; there is no deny.</p>' +
        '<p>Microsoft Entra roles govern the directory and Microsoft 365. <strong>Azure RBAC</strong> roles govern Azure resources and are assigned on subscriptions and below. The two systems meet in only one place: a Global Administrator can elevate to User Access Administrator at the Azure root.</p>',
      vis: vFlow([
        { t: 'Role definition', s: 'what can be done', k: 'd1' },
        { t: 'Principal', s: 'user, role-assignable group, service principal', k: 'acc' },
        { t: 'Scope', s: '/ · /administrativeUnits/{id} · /{objectId}', k: 'd2' },
        { t: 'Assignment', s: 'active or eligible (PIM)', k: 'ok' }
      ], 'Every administrative permission is these three things joined by an assignment.'),
      terms: [['Role definition', 'A named set of permissions; built-in or custom.'],
              ['Role assignment', 'The link between a principal, a role definition and a scope.'],
              ['Scope', 'Where an assignment applies: tenant, administrative unit or a single resource.'],
              ['Role-assignable group', 'A group created with isAssignableToRole so that Entra roles can be assigned to it; cannot be dynamic.'],
              ['Azure RBAC', 'The separate role system for Azure resources, assigned on management groups, subscriptions, resource groups and resources.']] },
    { t: 'Administrative units',
      body: '<p>An <strong>administrative unit</strong> is a container that exists only to restrict scope. It holds users, groups or devices - by assignment or a dynamic rule - and roles assigned at its scope reach only those objects. A <strong>restricted management</strong> AU inverts the idea: it protects its members from tenant-scoped administrators, so only admins assigned at the AU can change them.</p>' +
        '<p>AUs do not nest, do not grant access to anything, and do not pull in the members of a group you add to them.</p>',
      vis: vCards([
        { t: 'AU-Quebec', s: 'Dynamic: user.state -eq "QC". Helpdesk Administrator scoped here resets only these users.', k: 'd1' },
        { t: 'AU-Executives', s: 'Restricted management. Even Global Administrators need an assignment at this scope to edit members.', k: 'warn' },
        { t: 'Group in an AU', s: 'The group object is in scope; its members are not.', k: 'acc' }
      ], 'Three administrative unit patterns and the trap that goes with them.'),
      terms: [['Administrative unit', 'A container used to scope role assignments to a subset of users, groups or devices.'],
              ['Restricted management administrative unit', 'An AU whose members can be modified only by administrators assigned at the AU scope.'],
              ['Dynamic administrative unit', 'An AU whose user or device membership is computed from a rule.']] }
  ]
});

/* ======================================================================
   L2  Tokens and protocols
   ====================================================================== */
LEARN.push({
  id: 'L2', title: 'Tokens, Protocols and Sessions', short: 'Tokens and protocols', mins: 25,
  summary: 'How a sign-in turns into tokens: OAuth 2.0, OpenID Connect, SAML and WS-Fed, what is inside an access token, how refresh tokens and the Primary Refresh Token keep sessions alive, and how sessions end.',
  ms: [MSD("Explore identity in Microsoft Entra ID", "https://learn.microsoft.com/training/modules/explore-identity-azure-active-directory"), MSD("Register apps using Microsoft Entra ID", "https://learn.microsoft.com/en-us/training/modules/register-apps-use-microsoft-entra-id/"), MSD('OAuth 2.0 and OpenID Connect protocols', 'https://learn.microsoft.com/entra/identity-platform/v2-protocols'), MSD('Access tokens', 'https://learn.microsoft.com/entra/identity-platform/access-tokens'), MSD('Primary Refresh Token', 'https://learn.microsoft.com/entra/identity/devices/concept-primary-refresh-token')],
  mods: ['02-01', '02-03', '03-03'],
  units: [
    { t: 'Four protocols, one job',
      body: '<p>Every protocol here answers the same question - how does an app learn who the user is, or get permission to call an API - with different formats. <strong>OAuth 2.0</strong> is authorisation: an app obtains an <em>access token</em> to call an API. <strong>OpenID Connect</strong> adds authentication on top, returning an <em>ID token</em> about the user. <strong>SAML 2.0</strong> and <strong>WS-Federation</strong> are older XML-based single sign-on protocols that deliver a signed assertion to the application; most SaaS apps and AD FS speak them.</p>' +
        '<p>For the exam: modern apps you register use OIDC and OAuth; gallery SaaS apps are often SAML; partner IdPs that are not Entra connect with SAML or WS-Fed.</p>',
      vis: vCards([
        { t: 'OAuth 2.0', s: 'Access tokens to call APIs. Scopes and app roles.', k: 'd2', tag: 'authorisation' },
        { t: 'OpenID Connect', s: 'ID token saying who signed in. Built on OAuth.', k: 'd2', tag: 'sign-in' },
        { t: 'SAML 2.0', s: 'Signed XML assertion posted to the app. Most SaaS SSO.', k: 'd3', tag: 'sign-in' },
        { t: 'WS-Federation', s: 'Older XML protocol; AD FS and some partner IdPs.', k: 'd3', tag: 'sign-in' }
      ], 'Which protocol carries what.'),
      terms: [['OAuth 2.0', 'The authorisation framework apps use to obtain access tokens for APIs.'],
              ['OpenID Connect', 'An authentication layer on OAuth 2.0 that returns an ID token describing the signed-in user.'],
              ['SAML 2.0', 'An XML-based SSO protocol in which the IdP posts a signed assertion to the application.'],
              ['WS-Federation', 'An older XML-based federation protocol used by AD FS and some identity providers.']] },
    { t: 'What is inside an access token',
      body: '<p>An Entra access token is a signed JSON Web Token. Its claims say who it is for, who it is about and what it allows. Resources validate the signature and the claims, and never call Entra to check the token - which is why a token keeps working until it expires unless the resource supports continuous access evaluation.</p>' +
        '<p>Delegated tokens carry the user in <code>oid</code> and the granted permissions in <code>scp</code>. App-only tokens carry the application’s permissions in <code>roles</code> and no user. Group and app role claims appear only when configured.</p>',
      vis: vAnat([
        { l: 'aud', t: 'the API the token is for (for example https://graph.microsoft.com)', k: 'd2' },
        { l: 'iss / tid', t: 'the issuing tenant', k: 'd1' },
        { l: 'oid / sub', t: 'the user or service principal', k: 'd1' },
        { l: 'scp', t: 'delegated permissions granted', k: 'acc' },
        { l: 'roles', t: 'application permissions or app roles', k: 'acc' },
        { l: 'amr / acrs', t: 'how the user authenticated; authentication context satisfied', k: 'd3' },
        { l: 'exp', t: 'expiry: by default a random 60-90 minutes (75 on average)', k: 'warn' }
      ], 'The claims you read when a token does not do what you expect.', 'Access token (decoded)'),
      terms: [['Access token', 'A short-lived token presented to an API to prove what the caller may do.'],
              ['ID token', 'An OpenID Connect token describing the user to the client application.'],
              ['JWT', 'JSON Web Token: a signed, base64url-encoded set of claims.'],
              ['scp claim', 'The delegated permissions (scopes) in a user token.'],
              ['roles claim', 'Application permissions in an app-only token, or app roles assigned to a user.']] },
    { t: 'Refresh tokens and the Primary Refresh Token',
      body: '<p>Access tokens are short-lived by design, so clients also receive a <strong>refresh token</strong> to obtain new ones silently. Those silent refreshes are the <em>non-interactive sign-ins</em> in your logs. On Entra joined, hybrid joined and registered devices, Windows and the mobile brokers hold a <strong>Primary Refresh Token</strong> (PRT): a device-bound token issued at sign-in that provides SSO to every Entra app and carries device claims for Conditional Access.</p>' +
        '<p>Because refresh tokens can outlive password changes, stealing one is valuable. Revoking sessions invalidates them; token protection binds them to the device so a copy is useless elsewhere.</p>',
      vis: vFlow([
        { t: 'Interactive sign-in', s: 'password, passkey, MFA', k: 'd1' },
        { t: 'PRT or refresh token', s: 'long-lived, silent', k: 'acc' },
        { t: 'Access token', s: '60-90 minutes by default', k: 'd2' },
        { t: 'API call', s: 'resource validates the token', k: 'ok' }
      ], 'One interactive sign-in, many silent refreshes. Replay attacks live in the middle box.', { loop: 'refresh silently until revoked or expired' }),
      terms: [['Refresh token', 'A long-lived token a client uses to obtain new access tokens without prompting the user.'],
              ['Primary Refresh Token', 'A device-bound token on joined or registered devices that provides SSO and device claims.'],
              ['Non-interactive sign-in', 'A sign-in performed by a client on the user’s behalf, such as a token refresh.'],
              ['Token protection', 'A Conditional Access session control that binds refresh tokens to the device they were issued to.']] },
    { t: 'How sessions end',
      body: '<p>A session ends when a token expires, when policy forces reauthentication (sign-in frequency), or when something revokes it. <strong>Revoking sign-in sessions</strong> invalidates refresh tokens and session cookies; already-issued access tokens stay valid until they expire - unless the resource supports <strong>continuous access evaluation</strong>, in which case it rejects them after critical events such as the account being disabled or the password reset.</p>',
      vis: vVs({ t: 'Without CAE', k: 'warn', items: ['Revoke kills refresh tokens', 'Access token works until expiry (60-90 minutes by default)', 'IP changes are not re-evaluated'] },
               { t: 'With CAE', k: 'ok', items: ['Resource hears about critical events', 'Access token rejected within minutes', 'Location policies re-evaluated at the resource'] },
               'Why "disable and revoke" is immediate at Exchange Online and Graph but not at every app.'),
      terms: [['Revoke sign-in sessions', 'An action that invalidates a user’s refresh tokens and session cookies.'],
              ['Continuous access evaluation', 'A mechanism by which supporting resources reject tokens after critical events or location changes.'],
              ['Sign-in frequency', 'A Conditional Access session control that forces reauthentication after a set interval or every time.']] }
  ]
});

/* ======================================================================
   L3  Hybrid identity
   ====================================================================== */
LEARN.push({
  id: 'L3', title: 'Hybrid Identity: How an On-Premises User Signs In', short: 'Hybrid sign-in', mins: 20,
  summary: 'The two separate decisions in hybrid identity - how objects reach the cloud and where passwords are checked - and the on-premises protocols (Kerberos, NTLM, federation) the exam expects you to recognise.',
  ms: [MSD("Implement and manage hybrid identity", "https://learn.microsoft.com/en-us/training/modules/implement-manage-hybrid-identity/"), MSD('What is hybrid identity?', 'https://learn.microsoft.com/entra/identity/hybrid/whatis-hybrid-identity'), MSD('Choose the right authentication method', 'https://learn.microsoft.com/entra/identity/hybrid/connect/choose-ad-authn')],
  mods: ['01-04', '02-01'],
  units: [
    { t: 'Two decisions, not one',
      body: '<p>Hybrid identity always involves two choices that are easy to blur. <strong>Synchronization</strong> decides how users, groups and (optionally) devices get from Active Directory into Entra: Entra Connect Sync or Cloud Sync. <strong>Authentication</strong> decides where the password is checked when a synced user signs in: in the cloud against a synced hash, on-premises through pass-through agents, or at a federation server.</p>' +
        '<p>Every combination is possible, and each exam scenario usually constrains exactly one of them - an outage requirement points at authentication, a disconnected forest at synchronization.</p>',
      vis: vVs({ t: 'How objects arrive', k: 'd1', items: ['Entra Connect Sync (full engine, device sync, PTA)', 'Entra Cloud Sync (agents, disconnected forests)'] },
               { t: 'Where passwords are checked', k: 'd2', items: ['Password hash sync (cloud)', 'Pass-through authentication (on-premises agents)', 'Federation (AD FS or another IdP)'] },
               'Pick one from each column.'),
      terms: [['Hybrid identity', 'A single identity for users across on-premises Active Directory and Microsoft Entra ID.'],
              ['Entra Connect Sync', 'The full synchronization engine installed on a Windows server; supports device sync and PTA.'],
              ['Entra Cloud Sync', 'A lightweight, agent-based synchronization service configured in the cloud.'],
              ['Staging mode', 'A Connect Sync server that imports and synchronizes but does not export; a warm standby.']] },
    { t: 'Kerberos and NTLM in one page',
      body: '<p>On-premises, Windows authenticates with <strong>Kerberos</strong>: the user gets a ticket-granting ticket (TGT) from a domain controller, then service tickets for each server, all encrypted with keys derived from account passwords. <strong>NTLM</strong> is the older challenge-response fallback. Neither crosses the internet, which is why cloud sign-in needs other protocols - and why features such as Seamless SSO and Entra Kerberos exist to bridge the two.</p>' +
        '<p><strong>Seamless SSO</strong> lets a domain-joined PC present a Kerberos ticket for a special computer account to Entra. <strong>Entra Kerberos</strong> goes the other way: Entra issues a partial TGT for your AD realm, so a cloud sign-in (Windows Hello for Business, passkeys) can reach on-premises resources.</p>',
      vis: vFlow([
        { t: 'User', s: 'signs in to Windows', k: 'd1' },
        { t: 'Domain controller', s: 'issues a TGT', k: 'd1' },
        { t: 'Service ticket', s: 'per server or service', k: 'acc' },
        { t: 'File server, IIS...', s: 'validates the ticket', k: 'ok' }
      ], 'Kerberos in four steps. Entra Kerberos replaces step 2 with a partial TGT issued by the cloud.'),
      terms: [['Kerberos', 'The ticket-based authentication protocol used by Active Directory.'],
              ['TGT', 'Ticket-granting ticket: the Kerberos credential from which service tickets are obtained.'],
              ['NTLM', 'An older challenge-response Windows authentication protocol.'],
              ['Seamless SSO', 'Silent sign-in to Entra for domain-joined devices using a Kerberos ticket for the AZUREADSSOACC account.'],
              ['Microsoft Entra Kerberos', 'Entra’s ability to issue partial Kerberos TGTs for an AD domain, enabling cloud credentials to reach on-premises resources.']] },
    { t: 'Federation and why it is being retired',
      body: '<p>With federation, Entra redirects the user to another identity provider - usually AD FS - which authenticates them against AD and returns a <strong>signed token</strong>. Entra trusts anything signed with that IdP’s token-signing key. That trust is the weakness: whoever holds the key can mint a token for any user on the domain, without a password and without a sign-in at your IdP.</p>' +
        '<p>Moving to password hash sync or PTA removes the AD FS servers, the certificates and the key. The migration path - application activity report, staged rollout, domain conversion - is an exam objective in its own right.</p>',
      vis: vFlow([
        { t: 'User', s: 'goes to Microsoft 365', k: 'd1' },
        { t: 'Entra ID', s: 'domain is federated: redirect', k: 'd2' },
        { t: 'AD FS', s: 'authenticates, signs token', k: 'warn' },
        { t: 'Entra ID', s: 'trusts the signature, issues tokens', k: 'd2' }
      ], 'The signature in step 3 is the whole trust.'),
      terms: [['Federation', 'Delegating authentication for a domain to an external identity provider.'],
              ['Token-signing certificate', 'The key a federation server uses to sign tokens; its compromise allows forged sign-ins.'],
              ['Staged rollout', 'A feature that moves selected groups to cloud authentication while the domain remains federated.'],
              ['Managed domain', 'A domain whose users authenticate with Entra (PHS or PTA) rather than a federated IdP.']] },
    { t: 'Choosing the authentication method',
      body: '<p>Microsoft’s decision guidance is short. Start with <strong>password hash sync</strong>: least infrastructure, survives on-premises outages, enables leaked credential detection. Choose <strong>pass-through authentication</strong> when on-premises account policies must be enforced at the moment of sign-in. Keep <strong>federation</strong> only for requirements neither can meet, such as a third-party MFA server or smart card flow that has no cloud equivalent - and even then, enable PHS as a backup.</p>',
      vis: vBars([
        { l: 'PHS', v: 0.2, note: 'least', k: 'd2' },
        { l: 'PTA', v: 0.55, note: 'agents' },
        { l: 'Federation', v: 0.95, note: 'most', k: 'warn' }
      ], 'On-premises infrastructure each method depends on, roughly. More infrastructure means more to patch, more to fail, more to steal.'),
      terms: [['Password hash synchronization', 'Syncing a hash of the AD password hash so Entra can authenticate users in the cloud.'],
              ['Pass-through authentication', 'Validating cloud sign-ins against AD in real time through on-premises agents.'],
              ['Leaked credentials detection', 'An ID Protection detection comparing user password hashes with credentials found in breaches; needs PHS.']] }
  ]
});
