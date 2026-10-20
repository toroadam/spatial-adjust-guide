"""The gate reader: what video/approvals.md records for each owner gate (G1 to G7).

The single place Python reads the approvals log: end_card (cards.py) checks G4, build.py checks G3, G4 and G5, the pilot
checks G6 and G7. The table is the one under "## Gates" in video/approvals.md, with exactly this header:

  | Gate | Artifact | Version | Decision | Date | Approver | Quote / notes |

A gate can have several rows; the latest row (the last one in the file) is the gate's current decision. A row is never
edited once decided, so a changed decision, or a decision on a new version, is a new row below the old one.

  from approvals import is_approved, latest, require
  is_approved('G4')                  True when the latest G4 row is decided: 'approved', or 'decided by executor' (the
                                     owner's direction of 2026-10-19, recorded at the top of approvals.md)
  is_approved('G4', owner_only=True) True only when the owner's own 'approved' is the latest row
  latest('G4')                       that row as a dict (gate, artifact, version, decision, date, approver, notes), or None
  require('G4', 'the end card')      raises GateError naming the gate and its decision unless is_approved('G4')

  python3 video/edit/lib/approvals.py [G3 G4 ...]    prints each gate's latest decision; exit 1 if any is not decided

Standard library only, so it runs in any Python, before torch loads.
"""
import os
import re
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
APPROVALS_MD = os.path.join(REPO, 'video', 'approvals.md')

HEADER = ('Gate', 'Artifact', 'Version', 'Decision', 'Date', 'Approver', 'Quote / notes')
FIELDS = ('gate', 'artifact', 'version', 'decision', 'date', 'approver', 'notes')
DECISIONS = ('pending', 'decided by executor', 'approved', 'changes requested', 'rejected')
DECIDED = ('approved', 'decided by executor')
GATE_ID = re.compile(r'^G[1-9][0-9]*$')


class GateError(RuntimeError):
    """A gate a step needs has no recorded decision."""


def _cells(line):
    """The cells of a markdown table row; a pipe escaped as \\| stays inside its cell, and extra pipes stay in the notes."""
    body = line.strip()
    if not (body.startswith('|') and body.endswith('|')):
        return None
    body = body[1:-1].replace('\\|', '\0')
    cells = [c.strip().replace('\0', '|') for c in body.split('|')]
    if len(cells) > len(HEADER):
        cells = cells[:len(HEADER) - 1] + [' | '.join(cells[len(HEADER) - 1:])]
    return cells


def parse(text, source='approvals.md'):
    """Every gate row of the Gates table in text, in file order. Raises ValueError when the table's header is not the
    expected one, or a row has a decision outside DECISIONS."""
    lines = text.splitlines()
    start = next((i for i, ln in enumerate(lines) if _cells(ln) == list(HEADER)), None)
    if start is None:
        raise ValueError(f'{source}: no gates table with the header | {" | ".join(HEADER)} |')
    rows = []
    for n, ln in enumerate(lines[start + 2:], start + 3):        # skip the header and its |---| rule
        cells = _cells(ln)
        if cells is None:
            break                                                  # the table ends at the first line that is not a row
        if len(cells) != len(HEADER):
            raise ValueError(f'{source}:{n}: a gate row needs {len(HEADER)} cells, found {len(cells)}')
        row = dict(zip(FIELDS, cells))
        if not GATE_ID.match(row['gate']):
            raise ValueError(f'{source}:{n}: {row["gate"]!r} is not a gate id (G1, G2, ...)')
        if row['decision'] not in DECISIONS:
            raise ValueError(f'{source}:{n}: {row["gate"]} decision {row["decision"]!r} is not one of {", ".join(DECISIONS)}')
        row['line'] = n
        rows.append(row)
    return rows


def rows(path=None):
    path = path or APPROVALS_MD
    with open(path, encoding='utf-8') as f:
        return parse(f.read(), os.path.relpath(path, REPO) if path.startswith(REPO) else path)


def latest(gate, path=None):
    """The latest row recorded for gate, or None when the table has no row for it."""
    found = [r for r in rows(path) if r['gate'] == gate]
    return found[-1] if found else None


def is_approved(gate, path=None, owner_only=False):
    """True when the latest row for gate is decided ('approved' or 'decided by executor'); owner_only: 'approved' only."""
    r = latest(gate, path)
    if r is None:
        return False
    return r['decision'] == 'approved' if owner_only else r['decision'] in DECIDED


def require(gate, what, path=None, owner_only=False):
    """Raise GateError unless is_approved(gate); returns the latest row."""
    r = latest(gate, path)
    if not is_approved(gate, path, owner_only):
        state = r['decision'] if r else 'no row'
        need = "the owner's 'approved'" if owner_only else "'decided by executor' or 'approved'"
        raise GateError(f'{what} needs gate {gate} decided in video/approvals.md ({need}); its latest row says: {state}')
    return r


if __name__ == '__main__':
    gates = sys.argv[1:] or sorted({r['gate'] for r in rows()}, key=lambda g: int(g[1:]))
    bad = 0
    for g in gates:
        r = latest(g)
        print(f'{g}: {r["decision"] if r else "no row"}' + (f' ({r["date"]}, {r["approver"]})' if r and r['date'] != '—' else ''))
        bad += not is_approved(g)
    sys.exit(1 if bad else 0)
