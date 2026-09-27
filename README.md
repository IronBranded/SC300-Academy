# SC300 Academy

A study guide for **Microsoft Exam SC-300: Identity and Access Administrator**. It teaches how Microsoft Entra actually works — what each feature is for, how it behaves under the hood, how it fails, and how the exam asks about it — and lets you prove it in hands-on labs and practice questions.

**Open the Academy:** https://ironbranded.github.io/SC300-Academy/

## Purpose

SC-300 rewards understanding over memorisation: most questions describe a situation and ask which feature, setting or role solves it. The Academy is built for identity administrators and security engineers who want to pass the exam and also be able to run, troubleshoot and investigate these features in a real tenant. Every objective in the official skills outline (dated April 27, 2026) is covered, word for word, and every module ends in a lab you can run in your own test tenant.

## What it covers

| Exam domain | Weight | Modules |
|---|---|---|
| Lab tenant | Not scored | 00-01 Lab Tenant, Licences and Emergency Access |
| Implement and manage user identities | 20–25% | 01-01 Tenant Configuration, Roles and Administrative Units · 01-02 Users, Groups, Custom Security Attributes, Devices and Licences · 01-03 External Users, Cross-Tenant Access and Cross-Tenant Sync · 01-04 Hybrid Identity: Connect Sync, Cloud Sync and Sign-in Methods |
| Implement authentication and access management | 25–30% | 02-01 Authentication Methods, SSPR, Password Protection and Kerberos · 02-02 Conditional Access: Planning, Assignments, Controls and Testing · 02-03 Session Controls, Device Enforcement, CAE, Authentication Context and Protected Actions · 02-04 Risk with Microsoft Entra ID Protection · 02-05 Global Secure Access: Clients, Private Access and Internet Access |
| Plan and implement workload identities | 20–25% | 03-01 Choosing Workload Identities and Using Managed Identities · 03-02 Enterprise Applications, Application Proxy, SaaS SSO and Consent · 03-03 App Registrations: Authentication, API Permissions and App Roles · 03-04 Managing App Access with Microsoft Defender for Cloud Apps |
| Plan and automate identity governance | 20–25% | 04-01 Entitlement Management, Terms of Use and External User Lifecycle · 04-02 Access Reviews: Planning, Configuration and Response · 04-03 Privileged Identity Management and Emergency Access · 04-04 Logs, KQL, Workbooks and Identity Secure Score |

18 modules, 98 objectives.

## Inside every module

- **Why it exists** — the problem the feature solves and when to choose it over the alternatives.
- **How it works** — the mechanism, with diagrams and PowerShell, Microsoft Graph and Azure CLI examples checked against Microsoft's references.
- **Configuration surface** — the settings that matter, their defaults, and what to set them to.
- **Common failure modes** — what breaks, the error you will see, and why.
- **How this is tested** — the phrases exam questions use and what each one points to.
- **Validation** — KQL queries and commands to confirm the configuration works and to investigate it.
- **Incident-response note** — how the feature is abused and where the evidence lands.
- **Lab** — step-by-step, with teardown and a cost estimate.
- **Knowledge check** — at least one question per objective.
- **Sources** — the official Microsoft Learn training modules and documentation for the topic.

## Practice

- **Knowledge checks** — 134 questions across the modules.
- **Practice assessment** — 50 randomized questions in the format of Microsoft's free Practice Assessment, weighted by exam domain. Check each answer as you go, or sit it under exam conditions (100 minutes). Every question shows the rationale and the Microsoft Learn pages behind the answer, and the score report breaks results down by domain and skill area. The questions are the Academy's own; take [Microsoft's official practice assessment](https://learn.microsoft.com/en-us/credentials/certifications/identity-and-access-administrator/practice/assessment?assessment-type=practice&assessmentId=60&practice-assessment-type=certification) as well.
- **Practice exam** — 72 questions in every exam format (multiple choice, multiple response, yes/no sets, build-a-list, code completion), including a case study.
- **Readiness** — ranks what to study next from your wrong answers, weighted by how much each objective counts on the exam.

## Learn

- **Six concept primers** — The Directory: Tenants, Objects and Roles · Tokens, Protocols and Sessions · Hybrid Identity: How an On-Premises User Signs In · Zero Trust and the Conditional Access Decision · Application Identity: Registrations, Service Principals and Consent · The Identity Lifecycle and Governance.
- **Glossary** — 92 terms, each defined where it is taught.
- **Interactive tools** — a Conditional Access evaluator (change the sign-in and see which policies apply and why), a consent simulator (who can consent to what), and a lab cost planner.

## A suggested path

1. Build the lab tenant (module 00-01) so every later lab has somewhere to run.
2. Read the primer for any concept that feels shaky.
3. Work through the modules in order, running each lab and its teardown.
4. Answer each module's knowledge check; Readiness tells you what to revisit.
5. Take the practice assessment in practice mode, then again under exam conditions.
6. Finish with Microsoft's official practice assessment.

Progress, answers and lab records are saved in your browser.

## Accuracy

The Academy follows Microsoft Learn. Every module links the official SC-300 training and the documentation it draws on, every practice-assessment question links the pages that ground its answer, and the commands, queries, key facts and nearly all answer explanations have been checked against Microsoft's documentation. Features that changed in 2026 — such as the retirement of the legacy ID Protection risk policies and the Entra Connect Sync minimum version — are called out where they matter.

Not affiliated with or endorsed by Microsoft.
