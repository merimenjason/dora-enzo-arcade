#!/usr/bin/env python3
"""gen.py [ids...] (jobs.py, jobs2.py, then jobs3.py, jobs4.py, jobs5.py, jobs5b.py, jobs6.py, jobs7.py, jobs8.py, jobs9.py, jobs10.py, jobs-empire*.py and jobs12.py) — paints Jade Street sheets with Codex image generation, up to 6 at once.
Each job in jobs.py: id -> (size, refs, prompt). Skips ids whose png already exists."""
import subprocess, sys, concurrent.futures as cf
from pathlib import Path
D = Path(__file__).parent
sys.path.insert(0, str(D))
from jobs import JOBS
from jobs2 import J as JOBS2
from jobs3 import J as JOBS3
from jobs4 import J as JOBS4
from jobs5 import J as JOBS5
import jobs5b
from jobs6 import J as JOBS6
from jobs7 import J as JOBS7
from jobs8 import J as JOBS8
from jobs9 import J as JOBS9
from jobs10 import J as JOBS10
from jobs12 import J as JOBS12
from jobs13 import J as JOBS13
from jobs14 import J as JOBS14
from jobs15 import J as JOBS15
from jobs16 import J as JOBS16
JOBS.update(JOBS2)
JOBS.update(JOBS3)
JOBS.update(JOBS4)
JOBS.update(JOBS5)
jobs5b.add_repaints(JOBS)
JOBS.update(jobs5b.J)
JOBS.update(JOBS6)
JOBS.update(JOBS7)
JOBS.update(JOBS8)
JOBS.update(JOBS9)
JOBS.update(JOBS10)
JOBS.update(JOBS12)
JOBS.update(JOBS13)
JOBS.update(JOBS14)
JOBS.update(JOBS15)
JOBS.update(JOBS16)
# the tenth pass's empire sheets (jobs-empire*.py: hyphenated names, so loaded by path)
import importlib.util
for _f in sorted(D.glob('jobs-empire*.py')):
    _sp = importlib.util.spec_from_file_location(_f.stem.replace('-', '_'), _f); _m = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(_m)
    JOBS.update(_m.J)
def run(i):
    size, refs, prompt = JOBS[i]
    if (D / f'{i}.png').exists(): return f'{i} exists'
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', str(D), '-s', 'workspace-write', '-o', str(D / f'last-{i}.txt'),
           f'Generate ONE image with your image generation tool and save it in this folder as {i}.png ({size}). Do not write or edit any other files, do not post-process the image with code, and do not touch any git repository. Save exactly what the image tool produced. {prompt}']
    for r in refs: cmd += ['-i', str(D / r)]
    with open(D / f'log-{i}.txt', 'w') as lg:
        p = subprocess.run(cmd, stdin=subprocess.DEVNULL, stdout=lg, stderr=subprocess.STDOUT, timeout=1500)
    f = D / f'{i}.png'
    return f'{i} exit {p.returncode} {f.stat().st_size if f.exists() else "MISSING"}'
ids = sys.argv[1:] or list(JOBS)
with cf.ThreadPoolExecutor(int(__import__('os').environ.get('N', 6))) as ex:
    for r in ex.map(run, ids): print(r, flush=True)
