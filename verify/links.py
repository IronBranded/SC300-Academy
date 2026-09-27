import os, sys, json, glob, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
DOCS = os.environ.get('ENTRA_DOCS', os.path.join(ROOT, '.cache', 'entra-docs', 'docs'))
import re, json, glob, urllib.request, urllib.error, concurrent.futures as cf, datetime
R = 'https://raw.githubusercontent.com'
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=25) as r: return r.status == 200, r.read().decode('utf-8', 'ignore')
    except urllib.error.HTTPError: return False, ''
    except Exception as e: return None, str(e)
def redirmap(path):
    out = {}
    for x in json.load(open(path))['redirections']:
        k = x.get('source_path') or x.get('source_path_from_root', '').lstrip('/'); out[k] = x['redirect_url']
    return out
import urllib.request as _u
for _n, _r in [('entra-redir.json', 'entra-docs/main/.openpublishing.redirection.json'), ('ws-redir.json', 'windowsserverdocs/main/.openpublishing.redirection.json')]:
    open(os.path.join(OUT, _n), 'wb').write(_u.urlopen('https://raw.githubusercontent.com/MicrosoftDocs/' + _r, timeout=60).read())
ENTRA = redirmap(os.path.join(OUT, 'entra-redir.json'))
def slug(h): return re.sub(r'[^a-z0-9 -]', '', h.lower()).strip().replace(' ', '-')
# Verified this session by direct fetch or exact-URL search result (tool evidence), for repos that are not public
MANUAL = {
 'training/courses/sc-300t00': 'Fetched course page SC-300T00-A (updated 2026-06-12)',
 'credentials/certifications/resources/study-guides/sc-300': 'Fetched study guide; skills measured as of April 27, 2026',
 'credentials/certifications/exams/sc-300/practice/assessment': 'Linked from the fetched official study guide',
 'credentials/certifications/identity-and-access-administrator/practice/assessment': 'Listed on the fetched Microsoft page Practice Assessments for Microsoft Certifications',
 'defender-cloud-apps/best-practices': 'Same slug returned by search (Microsoft Learn): Defender for Cloud Apps best practices',
 'security/zero-trust/create-policies': 'Same slug returned by search (Microsoft Learn): Create policies',
 'defender-cloud-apps/set-up-cloud-discovery': 'Exact URL returned by search: "Set up cloud discovery"',
 'defender-cloud-apps/session-policy-aad': 'Exact URL returned by search: "Create Microsoft Defender for Cloud Apps session policies"',
 'defender-cloud-apps/access-policy-aad': 'Exact URL returned by search: "Create Microsoft Defender for Cloud Apps access policies"',
 'defender-cloud-apps/proxy-intro-aad': 'Exact URL returned by search: Conditional Access app control overview',
 'defender-cloud-apps/app-governance-manage-app-governance': 'Exact URL returned by search: "App governance in Microsoft Defender for Cloud Apps"',
 'defender-cloud-apps/connector-platform': 'Exact en-us URL returned by search: "Connect apps to get visibility and control" (canonical URL of the former enable-instant-visibility article)',
 'windows/security/identity-protection/hello-for-business/deploy/hybrid-cloud-kerberos-trust': 'Exact en-us URL returned by search: "Windows Hello for Business cloud Kerberos trust deployment guide"',
}
for m in ['explore-identity-azure-active-directory','implement-initial-configuration-of-azure-active-directory','create-configure-manage-identities','implement-manage-external-identities','implement-manage-hybrid-identity','secure-aad-users-with-mfa','manage-user-authentication','plan-implement-administer-conditional-access','manage-azure-active-directory-identity-protection','implement-access-management-for-azure-resources','deploy-configure-microsoft-entra-global-secure-access','plan-design-integration-of-enterprise-apps-for-sso','implement-monitor-integration-of-enterprise-apps-for-sso','implement-app-registration','register-apps-use-microsoft-entra-id','plan-implement-entitlement-management','plan-implement-manage-access-review','plan-implement-privileged-access','monitor-maintain-azure-active-directory']:
    MANUAL['training/modules/' + m] = 'Listed on a fetched official SC-300 learning path page' if m != 'explore-identity-azure-active-directory' else 'Exact URL returned by search: "Explore identity in Microsoft Entra ID" module'
EXT = {
 'https://msrc.microsoft.com/blog/2024/01/microsoft-actions-following-attack-by-nation-state-actor-midnight-blizzard/': 'Exact URL returned by search (MSRC, 2024-01-19)',
 'https://www.microsoft.com/en-us/security/blog/2024/01/25/midnight-blizzard-guidance-for-responders-on-nation-state-attack/': 'Fetched (Microsoft Threat Intelligence, 2024-01-25)',
 'https://www.microsoft.com/security/blog/2024/09/26/storm-0501-ransomware-attacks-expanding-to-hybrid-cloud-environments/': 'Returned by search (Microsoft Security blog, 2024-09-26; Aug 2025 update noted)',
 'https://www.microsoft.com/security/blog/2025/02/13/storm-2372-conducts-device-code-phishing-campaign/': 'Exact URL returned by search (updates 2025-02-14 and 2026-07-31)',
}
urls = set()
for f in glob.glob(os.path.join(ROOT, 'content', '*.js')) + [os.path.join(ROOT, 'parts', 'engine.js')]:
    for u in re.findall(r"https://[^'\"\s)<>\\]+", open(f).read()): urls.add(u.rstrip('.,'))
doc = sorted(u for u in urls if re.match(r'https://(learn\.microsoft\.com|msrc\.microsoft\.com|www\.microsoft\.com/.*security/blog|github\.com/MicrosoftLearning)', u))
def check(u):
    if u in EXT: return ('VERIFIED', 'live page', EXT[u])
    if u.startswith('https://github.com/'):
        ok, _ = get(u); return ('VERIFIED' if ok else 'BROKEN', 'HTTP GET', 'github.com returned 200' if ok else 'not reachable')
    p = re.sub(r'^https://learn\.microsoft\.com/(en-us/)?', '', u); anchor = None
    if '#' in p: p, anchor = p.split('#', 1)
    p = p.split('?')[0].rstrip('/')
    if p in MANUAL: return ('VERIFIED', 'live page', MANUAL[p])
    repo = None
    if p.startswith('entra/'): repo, base = 'MicrosoftDocs/entra-docs', f'{R}/MicrosoftDocs/entra-docs/main/docs/{p[6:]}'
    elif p.startswith('graph/'): repo, base = 'microsoftgraph/microsoft-graph-docs-contrib', f'{R}/microsoftgraph/microsoft-graph-docs-contrib/main/concepts/{p[6:]}'
    elif p.startswith('powershell/microsoftgraph/'): repo, base = 'MicrosoftDocs/microsoftgraph-docs-powershell', f'{R}/MicrosoftDocs/microsoftgraph-docs-powershell/main/microsoftgraph/docs-conceptual/{p.split("/")[-1]}'
    elif p.startswith('security/'): repo, base = 'MicrosoftDocs/security', f'{R}/MicrosoftDocs/security/main/security-docs/{p[9:]}'
    elif p.startswith('windows-server/'): repo, base = 'MicrosoftDocs/windowsserverdocs', f'{R}/MicrosoftDocs/windowsserverdocs/main/WindowsServerDocs/{p[15:]}'
    elif p.startswith('azure/'): repo, base = 'MicrosoftDocs/azure-docs', f'{R}/MicrosoftDocs/azure-docs/main/articles/{p[6:]}'
    elif p.startswith('microsoft-365/'): repo, base = 'MicrosoftDocs/microsoft-365-docs', f'{R}/MicrosoftDocs/microsoft-365-docs/public/microsoft-365/{p[14:]}'
    if not repo: return ('UNCHECKED', '-', 'no public source repo and no fetch evidence')
    for ext in ['.md', '.yml', '/index.yml']:
        ok, body = get(base + ext)
        if ok:
            if anchor:
                heads = [slug(h) for h in re.findall(r'^#{1,6}\s+(.+?)\s*$', body, re.M)]
                if anchor not in heads: return ('ANCHOR-MISSING', 'source file', f'{repo}: #{anchor} not a heading')
            t = re.search(r'^title:\s*"?(.+?)"?\s*$', body, re.M)
            return ('VERIFIED', 'source file', f'{repo} ' + base.split('/main/')[-1].split('/public/')[-1] + ext + (f' - "{t.group(1).strip()}"' if t else ''))
    if repo == 'MicrosoftDocs/entra-docs' and f'docs/{p[6:]}.md' in ENTRA: return ('REDIRECT', 'redirect map', ENTRA[f'docs/{p[6:]}.md'])
    return ('BROKEN', 'source file', f'{repo}: not found')
with cf.ThreadPoolExecutor(12) as ex: res = dict(zip(doc, ex.map(check, doc)))
from collections import Counter
c = Counter(v[0] for v in res.values()); print(len(res), dict(c)); print(Counter(v[1] for v in res.values()))
for u, v in res.items():
    if v[0] != 'VERIFIED': print(v[0], u, v[2])
json.dump(res, open(os.path.join(OUT, 'links.json'), 'w'), indent=1)
sys.exit(0 if all(v[0] == 'VERIFIED' for v in res.values()) else 1)
