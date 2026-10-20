"""Tests for lib/approvals.py, the gate reader for video/approvals.md.

  python3 video/edit/tests/test_approvals.py

Standard library only. Fixture tables cover a pending gate, an approved gate, changes requested then approved, a decision
by the executor, and a gate whose latest row withdraws an earlier decision; the parser refuses a changed header, an unknown
decision and a short row, and keeps a pipe inside the notes. The real approvals.md must parse, with exactly one header,
every gate G1 to G7 present, and the owner-direction rules (an executor's call is never recorded as 'approved').
"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pipeline as P  # noqa: E402,F401  (puts lib/ on the path)
import approvals  # noqa: E402

HEADER = '| Gate | Artifact | Version | Decision | Date | Approver | Quote / notes |\n|---|---|---|---|---|---|---|\n'


def doc(*rows, header=HEADER, after='\n## Next\n\n| not | a | gate |\n'):
    body = ''.join(f'| {g} | artifact | v1 | {d} | 2026-10-19 | {who} | {notes} |\n' for g, d, who, notes in rows)
    return '# Approvals\n\nIntro with | G9 | in prose.\n\n## Gates\n\n' + header + body + after


class Fixture:
    def __init__(self, text):
        self.dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.dir.name, 'approvals.md')
        with open(self.path, 'w') as f:
            f.write(text)

    def __enter__(self):
        return self.path

    def __exit__(self, *a):
        self.dir.cleanup()


class ParseTest(unittest.TestCase):
    def test_pending(self):
        with Fixture(doc(('G3', 'pending', '—', '—'))) as p:
            self.assertFalse(approvals.is_approved('G3', p))
            self.assertEqual(approvals.latest('G3', p)['decision'], 'pending')
            with self.assertRaisesRegex(approvals.GateError, 'G3.*pending'):
                approvals.require('G3', 'the build', p)

    def test_approved(self):
        with Fixture(doc(('G3', 'approved', 'Adam Munir', '"Looks right." (chat)'))) as p:
            self.assertTrue(approvals.is_approved('G3', p))
            self.assertTrue(approvals.is_approved('G3', p, owner_only=True))
            self.assertEqual(approvals.require('G3', 'the build', p, owner_only=True)['notes'], '"Looks right." (chat)')

    def test_changes_requested_then_approved(self):
        rows = [('G3', 'changes requested', 'Adam Munir', '"Bigger type." (review)')]
        with Fixture(doc(*rows)) as p:
            self.assertFalse(approvals.is_approved('G3', p))
        rows.append(('G3', 'approved', 'Adam Munir', '"Good." (review)'))
        with Fixture(doc(*rows)) as p:
            self.assertTrue(approvals.is_approved('G3', p))
            self.assertEqual(approvals.latest('G3', p)['notes'], '"Good." (review)')
            self.assertEqual(len([r for r in approvals.rows(p) if r['gate'] == 'G3']), 2)

    def test_latest_row_wins_both_ways(self):
        with Fixture(doc(('G4', 'approved', 'Adam Munir', 'a'), ('G4', 'changes requested', 'Adam Munir', 'b'))) as p:
            self.assertFalse(approvals.is_approved('G4', p))
        with Fixture(doc(('G4', 'decided by executor', 'executor', 'a'), ('G4', 'rejected', 'Adam Munir', 'b'))) as p:
            self.assertFalse(approvals.is_approved('G4', p))

    def test_decided_by_executor(self):
        with Fixture(doc(('G3', 'decided by executor', 'executor', 'Decided by the executor ...'))) as p:
            self.assertTrue(approvals.is_approved('G3', p))
            self.assertFalse(approvals.is_approved('G3', p, owner_only=True))
            with self.assertRaisesRegex(approvals.GateError, "owner's 'approved'"):
                approvals.require('G3', 'the final', p, owner_only=True)

    def test_other_gates_and_missing_gate(self):
        with Fixture(doc(('G3', 'approved', 'Adam Munir', 'a'), ('G4', 'pending', '—', '—'))) as p:
            self.assertTrue(approvals.is_approved('G3', p))
            self.assertFalse(approvals.is_approved('G4', p))
            self.assertIsNone(approvals.latest('G9', p))           # the prose mention is not a row
            self.assertFalse(approvals.is_approved('G9', p))

    def test_pipe_inside_the_notes(self):
        with Fixture(doc(('G5', 'approved', 'Adam Munir', '"A \\| B" then | more'))) as p:
            self.assertEqual(approvals.latest('G5', p)['notes'], '"A | B" then | more')

    def test_bad_tables_are_refused(self):
        with Fixture(doc(('G3', 'approved', 'x', 'y'), header=HEADER.replace('Quote / notes', 'Notes'))) as p:
            with self.assertRaisesRegex(ValueError, 'no gates table'):
                approvals.rows(p)
        with Fixture(doc(('G3', 'okayed', 'x', 'y'))) as p:
            with self.assertRaisesRegex(ValueError, "'okayed'"):
                approvals.rows(p)
        with Fixture(doc(after='| G3 | short | row |\n')) as p:
            with self.assertRaisesRegex(ValueError, 'needs 7 cells'):
                approvals.rows(p)
        with Fixture(doc(('3', 'approved', 'x', 'y'))) as p:
            with self.assertRaisesRegex(ValueError, 'not a gate id'):
                approvals.rows(p)


class RealFileTest(unittest.TestCase):
    def setUp(self):
        with open(approvals.APPROVALS_MD, encoding='utf-8') as f:
            self.text = f.read()
        self.rows = approvals.rows()

    def test_parses_with_every_gate(self):
        self.assertEqual(self.text.count('| Gate | Artifact |'), 1)
        self.assertEqual(sorted({r['gate'] for r in self.rows}, key=lambda g: int(g[1:])), [f'G{i}' for i in range(1, 8)])

    def test_executor_calls_are_never_approvals(self):
        for r in self.rows:
            if r['decision'] == 'decided by executor':
                self.assertEqual(r['approver'], 'executor', r['gate'])
                self.assertTrue(r['notes'].startswith('Decided by the executor under owner direction 2026-10-19; for review in '
                                                      'person 2026-10-22.'), r['gate'])
            if r['decision'] == 'approved':
                self.assertEqual(r['approver'], 'Adam Munir', r['gate'])
            if r['decision'] != 'pending':
                self.assertRegex(r['date'], r'^\d{4}-\d{2}-\d{2}$', r['gate'])


if __name__ == '__main__':
    unittest.main()
