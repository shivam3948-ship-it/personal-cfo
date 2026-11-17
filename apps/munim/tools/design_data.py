#!/usr/bin/env python3
"""Pull the sample-data literals the designs were drawn with (designs/*.dc.html) into designs/design-data.json.
The server's view models are tested against these: the app must show the same numbers the reviewed designs show."""
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from dc2react import SCREENS, DESIGNS

def literal(code, name):
    m = re.search(r'(?:\bvar\s+|,\s*)' + name + r'\s*=\s*', code)
    i, depth, q = m.end(), 0, None
    while i < len(code):
        ch = code[i]
        if q:
            if ch == '\\': i += 2; continue
            if ch == q: q = None
        elif ch in '\'"`': q = ch
        elif ch in '([{': depth += 1
        elif ch in ')]}': depth -= 1
        elif ch in ',;' and depth == 0: break
        i += 1
    return code[m.end():i]

out = {}
for f, (comp, names) in SCREENS.items():
    if not names: continue
    src = open(os.path.join(DESIGNS, f + '.dc.html')).read()
    code = src.split('class Component', 1)[1]
    # evaluated in order as vars, so a later literal can use an earlier one (EMG.target = 6 * ESS)
    js = '(function(){' + ''.join(f'var {n} = ({literal(code, n)});' for n in names) + 'return {' + ','.join(f'{json.dumps(n)}: {n}' for n in names) + '};})()'
    out[comp] = json.loads(subprocess.check_output(['node', '-e', f'process.stdout.write(JSON.stringify({js}))']))
json.dump(out, open(os.path.join(DESIGNS, 'design-data.json'), 'w'), ensure_ascii=False, indent=1)
print({k: list(v) for k, v in out.items()})
