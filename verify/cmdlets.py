import os, sys, json, glob, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
DOCS = os.environ.get('ENTRA_DOCS', os.path.join(ROOT, '.cache', 'entra-docs', 'docs'))
import re, glob, json
calls={}
BUILTIN={'Get-Date','ForEach-Object','Where-Object','Select-Object','New-Guid','Invoke-RestMethod','Import-Module','Install-Module','Get-Credential','Write-Host','Sort-Object','Measure-Object','ConvertTo-Json','ConvertFrom-Json','Export-Csv','Import-Csv','Get-Content','Set-Content','Test-NetConnection','Start-Sleep','Out-Null','Get-Item','Get-ChildItem','Format-Table','Group-Object'}
srcs=[]
for f in sorted(glob.glob(os.path.join(ROOT, 'content', '*.js'))):
    s=open(f).read()
    for m in re.finditer(r"C\('powershell', String\.raw`([\s\S]*?)`\)", s): srcs.append((f.split('/')[-1], m.group(1)))
    if f.endswith('exam.js'):
        for m in re.finditer(r"code: \"([^\"]*)\"", s): srcs.append(('exam.js', m.group(1).replace('\\n','\n').replace('[[0]]','X').replace('[[1]]','X').replace('[[2]]','X')))
    for m in re.finditer(r"<code>((?:New|Get|Set|Remove|Update|Add|Invoke|Connect|Revoke|Confirm|Install)-[A-Za-z]+)[^<]*</code>", s): srcs.append((f.split('/')[-1]+' inline', m.group(0)))
for src,code in srcs:
    # join backtick/pipe continuations crudely: analyse per statement line
    for line in code.split('\n'):
        for m in re.finditer(r'\b((?:New|Get|Set|Remove|Update|Add|Invoke|Connect|Revoke|Confirm|Install|Disconnect|Enable|Disable|Start|Stop|Test|Reset|Register|Grant|Restore)-[A-Z][A-Za-z0-9]+)\b', line):
            name=m.group(1)
            if name in BUILTIN: continue
            rest=line[m.end():]
            # stop at next pipeline segment
            rest=rest.split('|')[0]
            params=set(re.findall(r'(?<![\w$])-([A-Za-z][A-Za-z0-9]*)(?=[\s:]|$)', rest))
            d=calls.setdefault(name,{'params':set(),'where':set()}); d['params']|=params; d['where'].add(src)
out={k:{'params':sorted(v['params']),'where':sorted(v['where'])} for k,v in sorted(calls.items())}
json.dump(out, open(os.path.join(OUT, 'pscalls.json'), 'w'), indent=1)
print(len(out),'cmdlets')

import urllib.request
R = 'https://raw.githubusercontent.com/MicrosoftDocs'
def get(u):
    try: return urllib.request.urlopen(u, timeout=30).read().decode('utf-8', 'ignore')
    except Exception: return None
calls = out; calls.pop('New-MgRoleManagementDirectoryX', None)
NOISE = {'and', 'eq', 'Format'}
MODS = json.load(open(os.path.join(HERE, 'graph-cmdlet-modules.json')))
cands = {
 'Get-AzRoleDefinition': [f'{R}/azure-docs-powershell/main/azps-16.3.0/Az.Resources/Get-AzRoleDefinition.md'],
 'Get-AzVM': [f'{R}/azure-docs-powershell/main/azps-16.3.0/Az.Compute/Get-AzVM.md'],
 'New-AzOperationalInsightsWorkspace': [f'{R}/azure-docs-powershell/main/azps-16.3.0/Az.OperationalInsights/New-AzOperationalInsightsWorkspace.md'],
 'New-AzResourceGroup': [f'{R}/azure-docs-powershell/main/azps-16.3.0/Az.Resources/New-AzResourceGroup.md'],
 'Remove-AzResourceGroup': [f'{R}/azure-docs-powershell/main/azps-16.3.0/Az.Resources/Remove-AzResourceGroup.md'],
 'New-AzRoleEligibilityScheduleRequest': [f'{R}/azure-docs-powershell/main/azps-16.3.0/Az.Resources/New-AzRoleEligibilityScheduleRequest.md'],
 'Set-OwaMailboxPolicy': [f'{R}/office-docs-powershell/main/exchange/exchange-ps/ExchangePowerShell/Set-OwaMailboxPolicy.md', f'{R}/office-docs-powershell/main/exchange/exchange-ps/exchange/Set-OwaMailboxPolicy.md'],
 'Connect-ExchangeOnline': [f'{R}/office-docs-powershell/main/exchange/exchange-ps/ExchangePowerShell/Connect-ExchangeOnline.md', f'{R}/office-docs-powershell/main/exchange/exchange-ps/exchange/Connect-ExchangeOnline.md'],
 'Set-SPOTenant': [f'{R}/OfficeDocs-SharePoint-PowerShell/main/sharepoint/sharepoint-ps/Microsoft.Online.SharePoint.PowerShell/Set-SPOTenant.md'],
 'Connect-SPOService': [f'{R}/OfficeDocs-SharePoint-PowerShell/main/sharepoint/sharepoint-ps/Microsoft.Online.SharePoint.PowerShell/Connect-SPOService.md'],
}

# cmdlets documented inside Microsoft Entra articles rather than a cmdlet reference
INDOC = {
 'Get-ADSyncScheduler': ('entra-docs/main/docs/identity/hybrid/connect/how-to-connect-sync-feature-scheduler.md', []),
 'Set-ADSyncScheduler': ('entra-docs/main/docs/identity/hybrid/connect/how-to-connect-sync-feature-scheduler.md', ['SyncCycleEnabled']),
 'Start-ADSyncSyncCycle': ('entra-docs/main/docs/identity/hybrid/connect/how-to-connect-sync-feature-scheduler.md', ['PolicyType']),
 'Get-ADSyncConnectorRunStatus': ('entra-docs/main/docs/identity/hybrid/connect/how-to-connect-sync-feature-scheduler.md', []),
 'Get-AzureADKerberosServer': ('entra-docs/main/docs/identity/authentication/howto-authentication-passwordless-security-key-on-premises.md', []),
 'Set-AzureADKerberosServer': ('entra-docs/main/docs/identity/authentication/howto-authentication-passwordless-security-key-on-premises.md', ['RotateServerKey']),
 'Update-AzureADSSOForest': ('entra-docs/main/docs/identity/hybrid/connect/how-to-connect-sso-faq.yml', []),
 'Disable-ADAccount': ('windows-powershell-docs/main/docset/winserver2025-ps/ActiveDirectory/Disable-ADAccount.md', None),
 'Install-ADDSForest': ('windows-powershell-docs/main/docset/winserver2025-ps/ADDSDeployment/Install-ADDSForest.md', None),
 'Install-WindowsFeature': ('windows-powershell-docs/main/docset/winserver2025-ps/ServerManager/Install-WindowsFeature.md', None),
 'New-SelfSignedCertificate': ('windows-powershell-docs/main/docset/winserver2025-ps/pki/New-SelfSignedCertificate.md', None),
 'Set-SPOTenant': ('OfficeDocs-SharePoint-PowerShell/main/sharepoint/sharepoint-ps/Microsoft.Online.SharePoint.PowerShell/Set-SPOTenant.md', None),
 'Connect-SPOService': ('OfficeDocs-SharePoint-PowerShell/main/sharepoint/sharepoint-ps/Microsoft.Online.SharePoint.PowerShell/Connect-SPOService.md', None),
}
res = {}
for k, v in sorted(calls.items()):
    used = [p for p in v['params'] if p not in NOISE]
    if k in MODS or k.split('-', 1)[1].startswith('Mg'):
        mod = MODS.get(k)
        body = get(f'{R}/microsoftgraph-docs-powershell/main/microsoftgraph/graph-powershell-1.0/{mod}/{k}.md') if mod else None
        src = f'microsoftgraph-docs-powershell {mod}/{k}.md'
    elif k in cands:
        body = next((b for b in (get(u) for u in cands[k]) if b), None); src = cands[k][0].split('/MicrosoftDocs/')[1]
    elif k in INDOC:
        path, req = INDOC[k]; body = get(f'{R}/{path}'); src = path
        if body is not None and req is not None:
            ok = k in body and all(re.search(r'-' + p + r'\b', body) for p in req)
            res[k] = ('OK' if ok else 'BAD', [] if ok else req, src); continue
    else:
        res[k] = ('UNMAPPED', used, 'add this cmdlet to verify/cmdlets.py'); continue
    if not body: res[k] = ('NO-DOC', used, src); continue
    params = set(re.findall(r'^###\s+-([A-Za-z0-9]+)', body, re.M))
    bad = [p for p in used if p not in params] if params else []
    res[k] = ('OK' if not bad else 'BAD-PARAM', bad, src)
for k, r in res.items():
    if r[0] != 'OK': print(r[0], k, r[1], r[2])
print(sum(1 for r in res.values() if r[0] == 'OK'), 'of', len(res), 'cmdlets OK')
json.dump(res, open(os.path.join(OUT, 'cmdlets.json'), 'w'), indent=1)
sys.exit(0 if all(r[0] == 'OK' for r in res.values()) else 1)
