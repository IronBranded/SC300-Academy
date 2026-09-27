/* data.js - SC-300 guide content.
   Objectives are verbatim from the skills outline dated April 27, 2026.
   Module bodies are written from Microsoft Learn documentation current to
   September 2026. Every module ends with a knowledge check that tests every
   objective it claims, so the coverage grid can reach "Quiz passed" everywhere. */

var EXAM = {
  code: 'SC-300',
  site: 'SC-300 Academy',
  title: 'Microsoft Identity and Access Administrator',
  passing: 700,
  outline: 'April 27, 2026',
  studyGuide: 'https://learn.microsoft.com/credentials/certifications/resources/study-guides/sc-300',
  domains: [
    { id: '00', name: 'Lab tenant', short: 'Lab', weight: 'not an exam domain', mid: 0, tint: 'var(--domain-00)' },
    { id: '01', name: 'Implement and manage user identities', short: 'Users', weight: '20-25%', mid: 22.5, tint: 'var(--domain-01)' },
    { id: '02', name: 'Implement authentication and access management', short: 'Access', weight: '25-30%', mid: 27.5, tint: 'var(--domain-02)' },
    { id: '03', name: 'Plan and implement workload identities', short: 'Workloads', weight: '20-25%', mid: 22.5, tint: 'var(--domain-03)' },
    { id: '04', name: 'Plan and automate identity governance', short: 'Governance', weight: '20-25%', mid: 22.5, tint: 'var(--domain-04)' }
  ],
  glance: [
    ['Code', 'Graph PowerShell, KQL, JSON'],
    ['Features', 'Mostly GA; preview if widely used'],
    ['Renewal', 'Free online assessment, yearly'],
    ['Re-verify', 'The GitHub repository re-runs every check weekly against Microsoft’s current sources'],
    ['Source links', '196 verified 25 Sep 2026: 160 against Microsoft’s public docs source repos, 35 by live page, 1 by direct request'],
    ['Facts checked', '33 defaults, limits and durations pinned to file and line in Microsoft’s Entra docs source, 25 Sep 2026'],
    ['Answer keys', '131 claims behind 190 of 206 answer explanations pinned to exact Microsoft documentation, 25 Sep 2026'],
    ['Code checked', '34 KQL queries, 70 cmdlets and 13 Azure CLI lines checked 25 Sep 2026 against Microsoft table schemas, cmdlet references and CLI 2.90.0']
  ],
  note: 'The study guide contradicts itself: the skills-at-a-glance list gives authentication and access management 25-30%, while the heading further down the same page says 20-25%. This guide uses 25-30%. Either way it is the domain with the most objectives (27 of 98), so it gets the most time.',
  paUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/identity-and-access-administrator/practice/assessment?assessment-type=practice&assessmentId=60&practice-assessment-type=certification',
  links: [
    ['Official study guide', 'https://learn.microsoft.com/credentials/certifications/resources/study-guides/sc-300'],
    ['Official course SC-300T00', 'https://learn.microsoft.com/en-us/training/courses/sc-300t00'],
    ['Official practice assessment', 'https://learn.microsoft.com/en-us/credentials/certifications/identity-and-access-administrator/practice/assessment?assessment-type=practice&assessmentId=60&practice-assessment-type=certification'],
    ['Microsoft labs (GitHub)', 'https://github.com/MicrosoftLearning/SC-300-Identity-and-Access-Administrator']
  ],
  dashLede: 'Every objective is quoted verbatim and mapped to the module that teaches it, and every module\'s knowledge check tests every objective it claims.',
  learnLede: 'Six pages on what the exam assumes rather than asks: the directory object model, tokens and protocols, how hybrid sign-in actually travels, the Conditional Access decision, application identity, and the identity lifecycle. Each unit carries a diagram and defines its terms. Read the Learn page before the module it feeds.',
  unverified: 'Written from Microsoft Learn documentation current to September 2026 and not yet run end to end. The Entra admin center moves blades often: if a portal path has changed, search the admin center for the feature name, and check cmdlet parameters with Get-Help before running anything against a tenant you care about.',
  costIntro: '<p>SC-300 is mostly licensing, not metering. Almost every lab is configuration inside Entra and Microsoft 365, covered by the trial licences set up in 00-01. Only three labs need servers - hybrid identity, Application Proxy and Private Access - and they share the same two small virtual machines if you build them in order.</p>' +
    '<p>The expensive mistakes in this exam are not on the invoice. A Conditional Access policy switched straight to On, an emergency account that cannot pass MFA, or a hard-deleted object are the identity equivalent of an Azure Firewall left running, and the traps list below treats them that way.</p>'
};

var COST_TRAPS = [
  { mod: '00-01', t: 'Trial recurring billing', s: 'Microsoft 365 and Entra trials started with a payment method convert to paid seats unless recurring billing is turned off in the Microsoft 365 admin center. Turn it off the day you start the trial.', meter: 'monthly · per seat' },
  { mod: '02-02', t: 'A Conditional Access policy enabled without report-only', s: 'One policy targeting All users and All resources with a grant nobody can satisfy locks out every administrator, including you. Report-only first, emergency accounts excluded always.', meter: 'lockout · not money' },
  { mod: '04-03', t: 'An emergency account that cannot sign in', s: 'Mandatory MFA for Azure and admin portals applies to break-glass accounts too. An emergency account with only a password is not an emergency account. Register a passkey or certificate and test it.', meter: 'lockout · not money' },
  { mod: '01-04', t: 'Azure Bastion Basic or Standard', s: 'Convenient for reaching the lab VMs and billed hourly from creation. The Developer SKU is free, or use RDP restricted to your own IP and deallocate the VMs.', meter: 'hourly · gateway' },
  { mod: '04-04', t: 'Event Hubs as a diagnostic destination', s: 'A Standard namespace bills per throughput unit per hour whether or not a single event arrives. The lab uses Log Analytics and a storage account; read about Event Hubs, do not create one.', meter: 'hourly · throughput unit' },
  { mod: '04-04', t: 'Microsoft Sentinel on the lab workspace', s: 'Enabling Sentinel adds its own per-GB charge to Log Analytics ingestion once its trial ends. Nothing in this guide needs it.', meter: 'per GB ingested' },
  { mod: '01-03', t: 'Guest billing linked to a subscription', s: 'Linking a subscription to External ID for guest premium features switches those features to monthly-active-user billing beyond the free allowance.', meter: 'monthly · MAU' }
];

var MODULES = [];
