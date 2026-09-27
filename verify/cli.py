import os, sys, json, glob, re, shutil, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
AZ = os.environ.get('AZ', shutil.which('az'))
if not AZ:
    print('Azure CLI not installed; skipping (pip install azure-cli)'); sys.exit(0)
lines = []
for f in sorted(glob.glob(os.path.join(ROOT, 'content', '*.js'))):
    s = open(f).read()
    blocks = re.findall(r"C\('bash', String\.raw`([\s\S]*?)`\)", s) + re.findall(r"<code>(az [^<]+)</code>", s)
    for b in blocks:
        for line in b.replace('\\\n', ' ').split('\n'):
            for inner in re.findall(r'\$\((az [^()]*)\)', line): lines.append((os.path.basename(f), inner.strip()))
            outer = re.sub(r'\$\((az [^()]*)\)', 'SUB', line).strip()
            m = re.search(r'(?:^|[=\s])(az\s.*)$', outer)
            if m: lines.append((os.path.basename(f), re.sub(r'^.*?(az\s)', r'\1', m.group(1))))
helpc, bad = {}, []
for src, cmd in lines:
    words = []
    for t in cmd.split()[1:]:
        if t.startswith('-') or t.startswith('$') or t == 'SUB': break
        words.append(t)
    key = ' '.join(words)
    if key not in helpc:
        r = subprocess.run([AZ] + words + ['--help'], capture_output=True, text=True, timeout=180)
        helpc[key] = (r.returncode, r.stdout + r.stderr)
    rc, h = helpc[key]
    if rc != 0 or 'is not in the' in h or 'misspelled' in h: bad.append((src, cmd, 'command not found')); continue
    flags = re.findall(r'(?<![\w-])(--[a-z][a-z0-9-]*|-[a-zA-Z])(?=\s|$)', cmd)
    missing = [fl for fl in flags if not re.search(r'(^|[\s,\[])' + re.escape(fl) + r'(?=[\s,\]:])', h, re.M)]
    if missing: bad.append((src, cmd, 'unknown flags: %s' % missing))
ver = subprocess.run([AZ, 'version', '-o', 'json'], capture_output=True, text=True).stdout
print(len(lines) - len(bad), 'of', len(lines), 'Azure CLI lines OK')
for b in bad: print('BAD', b)
json.dump({'total': len(lines), 'bad': bad, 'commands': sorted(helpc), 'version': ver}, open(os.path.join(OUT, 'cli.json'), 'w'), indent=1)
sys.exit(1 if bad else 0)
