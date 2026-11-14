#!/usr/bin/env python3
"""gen.py [ids...] (jobs.py, then jobs2.py) — paints Jade Street sheets with Codex image generation, up to 6 at once.
Each job in jobs.py: id -> (size, refs, prompt). Skips ids whose png already exists."""
import subprocess, sys, concurrent.futures as cf
from pathlib import Path
D = Path(__file__).parent
sys.path.insert(0, str(D))
from jobs import JOBS
from jobs2 import J as JOBS2
JOBS.update(JOBS2)
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
