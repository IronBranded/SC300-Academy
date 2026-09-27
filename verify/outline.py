"""Outline check.
Offline (default): the app's objectives and skill-area names match docs/SKILLS-MEASURED-SNAPSHOT.md word for word.
--live: also fetch Microsoft's study guide and compare it with the snapshot (outline drift), confirm the SC-300
practice assessment is still listed, and confirm the official learning paths still contain the modules the app links."""
import os, sys, json, re, subprocess, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
UA = {'User-Agent': 'sc300-academy-outline-check'}
def fetch(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read().decode('utf-8', 'ignore')
def norm(s): return re.sub(r'\s+', ' ', s.replace('\u200b', '').replace('’', "'")).strip()
def parse(md):
    lines = md.replace('\r', '').split('\n')
    start = next((i for i, l in enumerate(lines) if l.startswith('## Skills measured as of')), None)
    if start is None: raise SystemExit('Could not find "## Skills measured as of" - the page shape changed.')
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith('## ') and not lines[i].startswith('## Skills measured')), len(lines))
    date = lines[start][len('## Skills measured as of'):].strip()
    glance, groups, cur, sect, last = [], {}, None, None, None
    for l in lines[start + 1:end]:
        if l.startswith('### '): sect = l[4:].strip(); cur = None; last = None; continue
        if l.startswith('#### '): cur = norm(l[5:]); groups[cur] = []; last = None; continue
        if l.startswith('- '):
            item = [l[2:].strip()]
            if sect == 'Skills at a glance': glance.append(item); last = item
            elif cur is not None: groups[cur].append(item); last = item
            else: last = None
            continue
        if l.strip() and last is not None and not l.startswith('#'): last[0] += ' ' + l.strip()
        elif not l.strip(): last = None
    return date, [norm(x[0]) for x in glance], {g: [norm(x[0]) for x in v] for g, v in groups.items()}
snap = parse(open(os.path.join(ROOT, 'docs', 'SKILLS-MEASURED-SNAPSHOT.md')).read())
app = json.loads(subprocess.run(['node', os.path.join(HERE, 'dump.js')], capture_output=True, text=True, check=True).stdout)
problems = []
# app vs snapshot
if norm(app['outline']) != norm(snap[0]): problems.append(f"app outline date '{app['outline']}' != snapshot '{snap[0]}'")
app_groups = {}
for m in app['modules']:
    if m['domain'] == '00': continue
    app_groups.setdefault(norm(m['group']), []).extend(norm(o) for o in m['objectives'])
for g in snap[2]:
    if g not in app_groups: problems.append(f'skill area missing from app: {g}'); continue
    miss = [o for o in snap[2][g] if o not in app_groups[g]]
    extra = [o for o in app_groups[g] if o not in snap[2][g]]
    problems += [f'objective missing from app [{g}]: {o}' for o in miss] + [f'objective in app but not in outline [{g}]: {o}' for o in extra]
for g in app_groups:
    if g not in snap[2]: problems.append(f'app skill area not in outline: {g}')
n_snap = sum(len(v) for v in snap[2].values())
print(f'snapshot: {snap[0]}, {len(snap[2])} skill areas, {n_snap} objectives; app matches: {not problems}')
if '--live' in sys.argv:
    live = parse(fetch('https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/sc-300?accept=text/markdown'))
    if live[0] != snap[0]: problems.append(f'OUTLINE DATE CHANGED: live "{live[0]}" vs snapshot "{snap[0]}"')
    if live[1] != snap[1]: problems.append(f'skills-at-a-glance changed: {live[1]}')
    for g in set(live[2]) | set(snap[2]):
        a, b = live[2].get(g), snap[2].get(g)
        if a != b: problems.append(f'skill area changed: {g}\n  live: {a}\n  snapshot: {b}')
    pa = fetch('https://learn.microsoft.com/en-us/credentials/certifications/practice-assessments-for-microsoft-certifications?accept=text/markdown')
    if 'SC-300' not in pa or 'assessmentId=60' not in pa: problems.append('SC-300 practice assessment no longer listed with assessmentId=60')
    links = sorted({x['u'] for m in app['modules'] for x in m['ms']})
    paths = ['explore-identity-azure-active-directory', 'implement-identity-management-solution', 'implement-authentication-access-management-solution',
             'implement-access-management-for-apps', 'plan-implement-identity-governance-strategy']
    listed = ''
    for p in paths:
        try: listed += fetch(f'https://learn.microsoft.com/en-us/training/paths/{p}/?accept=text/markdown')
        except Exception as e: problems.append(f'learning path unavailable: {p} ({e})')
    for u in links:
        slug = u.rstrip('/').rsplit('/', 1)[-1]
        if slug not in listed: problems.append(f'training module no longer in the SC-300 learning paths: {slug}')
    print(f'live outline: {live[0]}; practice assessment listed: {"assessmentId=60" in pa}; training modules checked: {len(links)}')
json.dump(problems, open(os.path.join(OUT, 'outline.json'), 'w'), indent=1)
for p in problems: print('DRIFT' if '--live' in sys.argv else 'MISMATCH', p)
sys.exit(1 if problems else 0)
