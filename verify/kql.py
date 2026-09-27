import os, sys, json, glob, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
DOCS = os.environ.get('ENTRA_DOCS', os.path.join(ROOT, '.cache', 'entra-docs', 'docs'))
import re, glob, json, urllib.request
R='https://raw.githubusercontent.com/MicrosoftDocs/azure-monitor-docs/main/articles/azure-monitor/reference/tables/'
blocks=[]
for f in sorted(glob.glob(os.path.join(ROOT, 'content', '*.js'))):
    s=open(f).read()
    for m in re.finditer(r"C\('kql', String\.raw`([\s\S]*?)`\)", s): blocks.append((f.split('/')[-1], m.group(1)))
# exam code item x61 (KQL with blanks) - fill with correct answers
blocks.append(('exam.js x61', "SigninLogs\n| where TimeGenerated > ago(1d)\n| where ResultType == 50126\n| summarize Users = dcount(UserPrincipalName) by IPAddress\n| where Users > 10"))
KNOWN_TABLES={'SigninLogs','AADNonInteractiveUserSignInLogs','AADServicePrincipalSignInLogs','AADManagedIdentitySignInLogs','AuditLogs','AADProvisioningLogs','MicrosoftGraphActivityLogs','AzureActivity','CloudAppEvents','OAuthAppInfo','AADRiskyUsers','AADUserRiskEvents','NetworkAccessTraffic','AADRiskyServicePrincipals','AADServicePrincipalRiskEvents','ADFSSignInLogs'}
cache={}
def schema(t):
    if t in cache: return cache[t]
    try: body=urllib.request.urlopen(R+t.lower()+'.md',timeout=20).read().decode()
    except Exception as e: cache[t]=None; return None
    cols=set(re.findall(r'^\|\s*([A-Za-z_][A-Za-z0-9_]*)\s*\|\s*(?:string|datetime|int|long|real|bool|boolean|dynamic|guid|timespan)\s*\|', body, re.M|re.I))
    if t=='OAuthAppInfo': cols|={'ReportId','Timestamp','OAuthAppId','ServicePrincipalId','AppName','AddedOnTime','LastModifiedTime','AppStatus','VerifiedPublisher','PrivilegeLevel','Permissions','ConsentedUsersCount','IsAdminConsented','AppOrigin','LastUsedTime','AppOwnerTenantId','RiskScore','AssignedRoles'}
    if t=='CloudAppEvents': cols|={'Timestamp'}
    cache[t]=cols; return cols
KQLWORDS=set('''where project extend summarize by order desc asc take top count dcount dcountif countif make_set make_list ago now in has has_any contains startswith endswith and or not between join kind leftanti inner union withsource let distinct mv-expand parse_json tostring toint todatetime coalesce isnotempty isempty iff case bin min max arg_max arg_min sum avg any render datatable on true false null project-away sort limit extract strcat split'''.split())
report=[]
for src,q in blocks:
    tables=[t for t in KNOWN_TABLES if re.search(r'\b'+t+r'\b', q)]
    unknown_tables=[w for w in re.findall(r'^\s*([A-Z][A-Za-z]+)\s*$', q, re.M) if w not in KNOWN_TABLES]
    cols=set()
    for t in tables:
        sc=schema(t)
        if sc is None: report.append((src,'NO-SCHEMA',t)); continue
        cols|=sc
    # identifiers defined in query
    defined=set(re.findall(r'\b([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)', q)) | set(re.findall(r'\blet\s+([A-Za-z_]\w*)', q)) | {'Table'}
    strip=re.sub(r'"[^"]*"|//[^\n]*', ' ', q)
    idents=set(re.findall(r'(?<![\.\w])([A-Za-z_][A-Za-z0-9_]*)\b(?!\s*\()', strip))
    cand=[i for i in idents if i not in KQLWORDS and i not in defined and i not in KNOWN_TABLES and not i.islower() and i[0].isupper()]
    missing=sorted(c for c in cand if c not in cols)
    report.append((src,'OK' if not missing and not unknown_tables else 'CHECK', ','.join(tables)+(' missing:'+str(missing) if missing else '')+(' unknown-table:'+str(unknown_tables) if unknown_tables else '')))
for r in report: print(r[1], r[0], r[2])
print(len(blocks), 'KQL blocks')
json.dump(report, open(os.path.join(OUT, 'kql.json'), 'w'), indent=1)
sys.exit(0 if all(r[1] == 'OK' for r in report) else 1)
