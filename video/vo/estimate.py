#!/usr/bin/env python3
"""Estimate ElevenLabs characters and credits for the Brian voice-over before any credits are spent.

Two estimates, with a retake allowance on both:

  --episode <episode.json>   Exact characters for one episode: the text of every VO line after the lexicon
                             (video/vo/lexicon.json) is applied, which is what render-brian.py sends and is billed for.
  --series                   A planning estimate for all the guides, one episode each. The guides and their numbered
                             steps are counted from the claims ledger, docs/claims/claims.json, which
                             scripts/claims-extract.mjs builds by evaluating the GUIDES data in
                             `Learn Spatial Adjust.dc.html` with every published correction applied (a regex scrape
                             of the export once missed guides; see docs/audit-verification.md). Each episode is
                             given a narration length inside the 20-30 s target, scaled by its step count (the guide
                             with the fewest steps gets 20 s, the one with the most gets 30 s, linear between), and
                             converted to characters with a characters-per-second rate.

Method, so the figures can be recomputed:

  characters(episode) = round(cps * seconds(episode))
  seconds(episode)    = min_s + (max_s - min_s) * (steps - fewest) / (most - fewest)     (mid-point if all equal)
  credits             = characters * CREDITS_PER_CHARACTER
  with retakes        = credits * retake factor (default 2.0: every line rendered twice on average)

The characters-per-second rate defaults to DEFAULT_CPS, measured from the iCentral Double Click #1 render report
(same voice, model and settings). Once the pilot is rendered, pass its report with --cps-from so the series uses the
pilot's own rate:

  python3 video/vo/estimate.py --series --cps-from ~/Documents/SpatialAdjust_MarCom/episodes/<pilot>/vo/render-report.json

--live prints the account's remaining character credits (counts only), with the key resolved exactly as
render-brian.py resolves it (its _key, imported). --write regenerates video/vo/series-estimate.md from the same
numbers; give it --episode for the pilot (or it uses the 70-word placeholder) and it always includes the series.
When --cps-from is the pilot's own render report, --write adds "Pilot, as rendered": the lines, characters and seconds
of that report, the credits of the pilot's rows in video/vo/credits-log.md, and the take count and final render wall
time given with --takes and --render-seconds (neither is recorded in a file the estimate could read).

Usage:
  python3 video/vo/estimate.py --episode video/episodes/<id>/episode.json [--retakes 2.0]
  python3 video/vo/estimate.py --series [--cps 16.16 | --cps-from <render-report.json>] [--seconds 20 30]
  python3 video/vo/estimate.py --live
  python3 video/vo/estimate.py --write [--episode <pilot episode.json>] [--cps-from <report>] [--takes N]
                                [--render-seconds S]
  npm run video -- estimate ...
"""

from __future__ import annotations

import argparse
import datetime as _dt
import importlib.util
import json
import os
import re
import sys
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))


def _load_renderer():
    spec = importlib.util.spec_from_file_location("render_brian", os.path.join(HERE, "render-brian.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


rb = _load_renderer()

# ElevenLabs bills eleven_multilingual_v2 at 1 credit per character of the text sent (previous_text and next_text are
# not billed). Read from the ElevenLabs pricing documentation on 2026-10-19; the owner should confirm it against the
# account's plan. The single source is render-brian.py, so the estimate and the renderer's credit check agree.
CREDITS_PER_CHARACTER = rb.CREDITS_PER_CHARACTER

DEFAULT_RETAKES = 2.0
DEFAULT_SECONDS = (20.0, 30.0)
# Characters per second of finished Brian narration: 1469 characters over 90.90 s in the 16 lines of the iCentral
# Double Click #1 (Home) render report, ~/Documents/iCentral_MarCom/double-clicks/01-home/vo/render-report.json
# (read only; modified 2026-10-16 11:42:51 local time). Same voice, model and settings; trimmed line durations.
DEFAULT_CPS = 16.16
DEFAULT_CPS_SOURCE = "iCentral Double Click #1 (Home) render report: 1469 characters in 90.90 s"

CLAIMS = os.path.join(REPO_ROOT, "docs", "claims", "claims.json")
PLACEHOLDER = os.path.join(HERE, "fixtures", "episode.vo-placeholder.json")
PILOT_GUIDE = "dashboard-overview"
SERIES_ESTIMATE_PATH = os.path.join(HERE, "series-estimate.md")


class EstimateError(Exception):
    """Bad input. Exit 2."""


def _rel(path: str) -> str:
    rel = os.path.relpath(os.path.abspath(path), REPO_ROOT)
    return path if rel.startswith("..") else rel


def _fmt(n: float) -> str:
    return f"{n:,.0f}"


# ---------------------------------------------------------------------------------------------------------------------
# Episode
# ---------------------------------------------------------------------------------------------------------------------

def episode_estimate(path: str, retakes: float = DEFAULT_RETAKES) -> dict:
    """Per-line and total characters and credits for one episode, lexicon applied."""
    episode = rb.load_episode(path)
    plan = rb.plan_lines(episode, rb.load_lexicon())
    lines = []
    for p in plan:
        credits = p["characters"] * CREDITS_PER_CHARACTER
        lines.append({"line": p["line"], "characters": p["characters"], "credits": credits,
                      "with_retakes": credits * retakes})
    characters = sum(line["characters"] for line in lines)
    credits = characters * CREDITS_PER_CHARACTER
    words = sum(len(p["text"].split()) for p in plan)
    return {"episode": episode["id"], "path": path, "lines": lines, "words": words, "characters": characters,
            "credits": credits, "retakes": retakes, "with_retakes": credits * retakes}


def print_episode(est: dict, cps: float) -> None:
    print(f"Episode {est['episode']} ({_rel(est['path'])}): {len(est['lines'])} VO lines, {est['words']} words")
    print(f"Characters are counted after the lexicon is applied; {CREDITS_PER_CHARACTER:g} credit per character; "
          f"retake factor {est['retakes']:g}.")
    print()
    width = max(len("total"), *(len(line["line"]) for line in est["lines"]))
    print(f"{'line'.ljust(width)}  {'chars':>7}  {'credits':>8}  {'x retakes':>9}")
    for line in est["lines"]:
        print(f"{line['line'].ljust(width)}  {line['characters']:>7}  {line['credits']:>8g}  {line['with_retakes']:>9g}")
    print(f"{'total'.ljust(width)}  {est['characters']:>7}  {est['credits']:>8g}  {est['with_retakes']:>9g}")
    print()
    print(f"About {est['characters'] / cps:.1f} s of narration at {cps:g} characters per second.")


# ---------------------------------------------------------------------------------------------------------------------
# Series
# ---------------------------------------------------------------------------------------------------------------------

def guides_from_ledger(path: str = CLAIMS) -> list[dict]:
    """[{guide, title, steps}] for every guide in the claims ledger, in ledger order."""
    try:
        with open(path, encoding="utf-8") as fh:
            ledger = json.load(fh)
    except (OSError, ValueError) as err:
        raise EstimateError(f"cannot read the claims ledger {_rel(path)}: {err}") from None
    claims = ledger.get("claims") if isinstance(ledger, dict) else None
    if not isinstance(claims, list) or not claims:
        raise EstimateError(f"{_rel(path)} has no claims")
    guides: "OrderedDict[str, dict]" = OrderedDict()
    for claim in claims:
        key = claim.get("guide")
        if not isinstance(key, str):
            continue
        guide = guides.setdefault(key, {"guide": key, "title": key, "steps": set()})
        step = str(claim.get("step", ""))
        if step.isdigit():
            guide["steps"].add(int(step))
        if step == "tile" and claim.get("field") == "title" and isinstance(claim.get("text"), str):
            guide["title"] = claim["text"]
    return [{"guide": g["guide"], "title": g["title"], "steps": len(g["steps"])} for g in guides.values()]


def series_estimate(guides: list[dict], cps: float, seconds=DEFAULT_SECONDS, retakes: float = DEFAULT_RETAKES) -> dict:
    lo_s, hi_s = seconds
    fewest = min(g["steps"] for g in guides)
    most = max(g["steps"] for g in guides)
    rows = []
    for g in guides:
        if most == fewest:
            secs = (lo_s + hi_s) / 2
        else:
            secs = lo_s + (hi_s - lo_s) * (g["steps"] - fewest) / (most - fewest)
        chars = round(cps * secs)
        rows.append({**g, "seconds": secs, "characters": chars, "credits": chars * CREDITS_PER_CHARACTER,
                     "with_retakes": chars * CREDITS_PER_CHARACTER * retakes})
    characters = sum(r["characters"] for r in rows)
    low = round(cps * lo_s) * len(rows)
    high = round(cps * hi_s) * len(rows)
    return {
        "rows": rows, "guides": len(rows), "cps": cps, "seconds": (lo_s, hi_s), "retakes": retakes,
        "fewest_steps": fewest, "most_steps": most,
        "characters": characters, "credits": characters * CREDITS_PER_CHARACTER,
        "with_retakes": characters * CREDITS_PER_CHARACTER * retakes,
        "low_characters": low, "high_characters": high,
        "low_with_retakes": low * CREDITS_PER_CHARACTER * retakes,
        "high_with_retakes": high * CREDITS_PER_CHARACTER * retakes,
    }


def assumptions(series: dict, cps_source: str) -> list[str]:
    lo_s, hi_s = series["seconds"]
    return [
        f"{series['guides']} guides, one episode each, counted from the claims ledger ({_rel(CLAIMS)}), "
        f"which is built from the GUIDES data in Learn Spatial Adjust.dc.html.",
        f"Narration per episode: {lo_s:g} s for the guides with the fewest steps ({series['fewest_steps']}) up to "
        f"{hi_s:g} s for the most ({series['most_steps']}), linear in between. This is an upper bound: title and end "
        f"cards carry no narration.",
        f"{series['cps']:g} characters per second ({cps_source}).",
        f"{CREDITS_PER_CHARACTER:g} credit per character (eleven_multilingual_v2, ElevenLabs pricing read "
        f"2026-10-19; to be confirmed against the account's plan).",
        f"Retake factor {series['retakes']:g}: every line rendered {series['retakes']:g} times on average.",
    ]


def print_series(series: dict, cps_source: str) -> None:
    print(f"Series estimate: {series['guides']} guides")
    for a in assumptions(series, cps_source):
        print(f"  - {a}")
    print()
    width = max(len(r["guide"]) for r in series["rows"])
    print(f"{'guide'.ljust(width)}  {'steps':>5}  {'seconds':>7}  {'chars':>6}  {'credits':>7}  {'x retakes':>9}")
    for r in series["rows"]:
        mark = "  (pilot)" if r["guide"] == PILOT_GUIDE else ""
        print(f"{r['guide'].ljust(width)}  {r['steps']:>5}  {r['seconds']:>7.1f}  {r['characters']:>6}  "
              f"{r['credits']:>7g}  {r['with_retakes']:>9g}{mark}")
    print(f"{'total'.ljust(width)}  {'':>5}  {'':>7}  {series['characters']:>6}  {series['credits']:>7g}  "
          f"{series['with_retakes']:>9g}")
    print()
    print(f"Range at {series['seconds'][0]:g}-{series['seconds'][1]:g} s for every episode: "
          f"{_fmt(series['low_characters'])} to {_fmt(series['high_characters'])} characters, "
          f"{_fmt(series['low_with_retakes'])} to {_fmt(series['high_with_retakes'])} credits with retakes.")


def cps_from_report(path: str) -> tuple[float, str]:
    """Characters per second from a render report: render-brian.py's (characters) or iCentral's (text)."""
    try:
        with open(os.path.expanduser(path), encoding="utf-8") as fh:
            report = json.load(fh)
    except (OSError, ValueError) as err:
        raise EstimateError(f"cannot read the render report {path}: {err}") from None
    lines = report.get("lines") if isinstance(report, dict) else None
    if not isinstance(lines, list) or not lines:
        raise EstimateError(f"{path} has no lines")
    chars = seconds = 0.0
    for line in lines:
        count = line.get("characters")
        if not isinstance(count, (int, float)):
            count = len(line.get("text") or "")
        chars += count
        seconds += float(line.get("seconds") or 0)
    if chars <= 0 or seconds <= 0:
        raise EstimateError(f"{path} has no characters or no seconds to measure a rate from")
    cps = round(chars / seconds, 2)
    return cps, f"{os.path.basename(os.path.dirname(os.path.dirname(os.path.abspath(path))))} render report: " \
                f"{chars:.0f} characters in {seconds:.2f} s"


# ---------------------------------------------------------------------------------------------------------------------
# Live credits and the markdown record
# ---------------------------------------------------------------------------------------------------------------------

LOG_ROW = re.compile(r"^\|[^|]*\|([^|]*)\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*->\s*(\d+)\s*\|\s*$")


def observed_billing(path: str | None = None, episode: str | None = None) -> dict:
    """What the account actually charged, from the counts-only rows of video/vo/credits-log.md: characters sent
    against the fall in remaining credits, over the runs that sent text and have both counts (only the rows of one
    episode when `episode` is given)."""
    path = path or rb.CREDITS_LOG_PATH
    runs = characters = credits = 0
    try:
        with open(path, encoding="utf-8") as fh:
            rows = fh.read().splitlines()
    except FileNotFoundError:
        rows = []
    for row in rows:
        m = LOG_ROW.match(row)
        if not m or int(m.group(3)) == 0 or (episode is not None and m.group(1).strip() != episode):
            continue
        runs += 1
        characters += int(m.group(3))
        credits += int(m.group(4)) - int(m.group(5))
    return {"runs": runs, "characters": characters, "credits": credits,
            "per_character": credits / characters if characters else None}


def as_rendered(report_path: str, pilot: dict, takes: int | None = None,
                render_seconds: float | None = None) -> dict | None:
    """The pilot's real numbers: its VO render report (lines, characters, seconds), its credits-log rows, and the take
    count and final render wall time given on the command line. None when the report is another episode's."""
    try:
        with open(os.path.expanduser(report_path), encoding="utf-8") as fh:
            report = json.load(fh)
    except (OSError, ValueError) as err:
        raise EstimateError(f"cannot read the render report {report_path}: {err}") from None
    if not isinstance(report, dict) or report.get("episode") != pilot["episode"]:
        return None
    lines = report.get("lines") or []
    characters = sum(int(line.get("characters") or 0) for line in lines)
    seconds = sum(float(line.get("seconds") or 0) for line in lines)
    return {"report": report_path, "lines": len(lines), "characters": characters, "seconds": seconds,
            "billing": observed_billing(episode=pilot["episode"]), "takes": takes, "render_seconds": render_seconds}


def live() -> tuple[int, int]:
    """(remaining, limit) character credits for the account. The key never leaves render-brian's client."""
    return rb.ElevenLabs(rb._key()).remaining()


def write_markdown(path: str, pilot: dict, pilot_is_placeholder: bool, series: dict, cps_source: str,
                   actual: dict | None = None) -> None:
    today = _dt.date.today().isoformat()
    pilot_label = ("the 70-word placeholder script, `video/vo/fixtures/episode.vo-placeholder.json` (the pilot "
                   "episode.json does not exist yet)" if pilot_is_placeholder else f"`{_rel(pilot['path'])}`")
    lines = [
        "# VO credit estimate: pilot and series",
        "",
        f"Generated {today} by `python3 video/vo/estimate.py --write`. Regenerate it the same way whenever the pilot "
        "script, the lexicon or the guides change, and after every pilot render with the real pilot numbers "
        "(`--episode` for the locked pilot, `--cps-from` its render report, `--takes` and `--render-seconds`).",
        "",
        "## Pilot",
        "",
        f"Source: {pilot_label}. Characters are counted after the lexicon is applied, which is what is sent and billed.",
        "",
        "| Line | Characters | Credits | With retakes |",
        "|---|---|---|---|",
    ]
    for line in pilot["lines"]:
        lines.append(f"| {line['line']} | {line['characters']} | {line['credits']:g} | {line['with_retakes']:g} |")
    lines += [
        f"| **Total** | **{pilot['characters']}** | **{pilot['credits']:g}** | **{pilot['with_retakes']:g}** |",
        "",
        f"{pilot['words']} words, about {pilot['characters'] / series['cps']:.1f} s of narration at "
        f"{series['cps']:g} characters per second. Retake factor {pilot['retakes']:g}.",
        "",
    ]
    if actual:
        bill = actual["billing"]
        credits = (f"{_fmt(bill['credits'])} ({bill['per_character']:.2f} per character)" if bill["runs"]
                   else "no row in credits-log.md")
        runs = f"{bill['runs']} {'run' if bill['runs'] == 1 else 'runs'}" if bill["runs"] else "no logged run"
        rate = actual["characters"] / actual["seconds"] if actual["seconds"] else 0
        takes = actual["takes"] if actual["takes"] is not None else "not given (--takes)"
        render = (f"{actual['render_seconds']:g} s" if actual["render_seconds"] is not None
                  else "not given (--render-seconds)")
        lines += [
            "## Pilot, as rendered",
            "",
            f"From the pilot's VO render report (`episodes/{pilot['episode']}/vo/render-report.json` under the media "
            f"root) and the `{pilot['episode']}` rows of [`credits-log.md`](credits-log.md); the take count and the "
            "final render's wall time are given on the command line.",
            "",
            "| | Estimate | Actual |",
            "|---|---|---|",
            f"| VO lines rendered | {len(pilot['lines'])}, or {len(pilot['lines']) * pilot['retakes']:g} with retakes | "
            f"{actual['lines']} in {runs} |",
            f"| Characters sent | {pilot['characters']}, or {_fmt(pilot['characters'] * pilot['retakes'])} with "
            f"retakes | {_fmt(bill['characters']) if bill['runs'] else actual['characters']} |",
            f"| Credits | {_fmt(pilot['credits'])}, or {_fmt(pilot['with_retakes'])} with retakes | {credits} |",
            f"| Narration | about {pilot['characters'] / DEFAULT_CPS:.1f} s at {DEFAULT_CPS:g} characters per second | "
            f"{actual['seconds']:.2f} s, {rate:.2f} characters per second |",
            f"| Takes recorded | — | {takes} |",
            f"| Final render wall time | — | {render} |",
            "",
        ]
    lines += [
        "## Series",
        "",
        "Assumptions:",
        "",
    ]
    lines += [f"- {a}" for a in assumptions(series, cps_source)]
    lines += [
        "",
        "| Guide | Steps | Narration (s) | Characters | Credits | With retakes |",
        "|---|---|---|---|---|---|",
    ]
    for r in series["rows"]:
        name = f"{r['title']} (`{r['guide']}`)" + (", pilot" if r["guide"] == PILOT_GUIDE else "")
        lines.append(f"| {name} | {r['steps']} | {r['seconds']:.1f} | {r['characters']} | {r['credits']:g} | "
                     f"{r['with_retakes']:g} |")
    lines += [
        f"| **Total, {series['guides']} guides** | | | **{_fmt(series['characters'])}** | "
        f"**{_fmt(series['credits'])}** | **{_fmt(series['with_retakes'])}** |",
        "",
        f"If every episode ran {series['seconds'][0]:g} s, the series would take {_fmt(series['low_characters'])} "
        f"characters ({_fmt(series['low_with_retakes'])} credits with retakes); if every episode ran "
        f"{series['seconds'][1]:g} s, {_fmt(series['high_characters'])} characters "
        f"({_fmt(series['high_with_retakes'])} credits with retakes).",
        "",
        "## Observed billing",
        "",
    ]
    seen = observed_billing()
    if seen["runs"]:
        lines.append(
            f"From the counts-only rows of [`credits-log.md`](credits-log.md): {seen['runs']} "
            f"{'run' if seen['runs'] == 1 else 'runs'} sent {_fmt(seen['characters'])} characters and the account's "
            f"remaining count fell by {_fmt(seen['credits'])} credits, {seen['per_character']:.2f} credits per "
            f"character. The estimates above keep {CREDITS_PER_CHARACTER:g} credit per character, an upper bound, "
            "until the owner confirms the plan's rate. A row's fall can include other use of the same account in the "
            "same minutes."
        )
    else:
        lines.append("No render has been logged in [`credits-log.md`](credits-log.md) yet.")
    lines += [
        "",
        "## How to recompute",
        "",
        "```bash",
        "python3 video/vo/estimate.py --episode <episode.json>        # one episode, exact",
        "python3 video/vo/estimate.py --series                        # all guides, planning estimate",
        "python3 video/vo/estimate.py --live                          # remaining credits on the account (counts only)",
        "python3 video/vo/estimate.py --write --episode <pilot episode.json> --cps-from <pilot render-report.json> \\",
        "    --takes <takes recorded> --render-seconds <final render wall time>",
        "```",
        "",
    ]
    tmp = path + ".part"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    os.replace(tmp, path)


# ---------------------------------------------------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------------------------------------------------

def parse_args(argv):
    ap = argparse.ArgumentParser(prog="estimate.py",
                                 description="Estimate ElevenLabs characters and credits for the Brian VO.")
    ap.add_argument("--episode", help="episode.json to estimate exactly (lexicon applied)")
    ap.add_argument("--series", action="store_true", help="estimate every guide in the claims ledger")
    ap.add_argument("--live", action="store_true", help="print the account's remaining character credits (counts only)")
    ap.add_argument("--write", action="store_true", help=f"regenerate {_rel(SERIES_ESTIMATE_PATH)}")
    ap.add_argument("--retakes", type=float, default=DEFAULT_RETAKES, help="retake factor (default 2.0)")
    ap.add_argument("--cps", type=float, help=f"characters per second (default {DEFAULT_CPS})")
    ap.add_argument("--cps-from", help="render-report.json to measure characters per second from")
    ap.add_argument("--seconds", type=float, nargs=2, metavar=("MIN", "MAX"), default=list(DEFAULT_SECONDS),
                    help="narration target per episode in seconds (default 20 30)")
    ap.add_argument("--takes", type=int, help="with --write: takes recorded for the pilot")
    ap.add_argument("--render-seconds", type=float, help="with --write: wall time of the pilot's final render, seconds")
    args = ap.parse_args(argv)
    if not (args.episode or args.series or args.live or args.write):
        ap.error("give --episode, --series, --live or --write")
    if args.retakes < 1:
        ap.error("--retakes must be 1 or more")
    if args.seconds[0] <= 0 or args.seconds[0] > args.seconds[1]:
        ap.error("--seconds MIN MAX must be positive with MIN <= MAX")
    if args.cps is not None and args.cps <= 0:
        ap.error("--cps must be positive")
    if (args.takes is not None or args.render_seconds is not None) and not (args.write and args.cps_from):
        ap.error("--takes and --render-seconds go with --write and --cps-from the pilot's render report")
    if args.takes is not None and args.takes < 1:
        ap.error("--takes must be 1 or more")
    if args.render_seconds is not None and args.render_seconds <= 0:
        ap.error("--render-seconds must be positive")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        if args.cps_from:
            cps, cps_source = cps_from_report(args.cps_from)
        elif args.cps is not None:
            cps, cps_source = args.cps, "given with --cps"
        else:
            cps, cps_source = DEFAULT_CPS, DEFAULT_CPS_SOURCE
        seconds = tuple(args.seconds)
        printed = False
        if args.episode:
            print_episode(episode_estimate(args.episode, args.retakes), cps)
            printed = True
        if args.series:
            if printed:
                print()
            print_series(series_estimate(guides_from_ledger(), cps, seconds, args.retakes), cps_source)
            printed = True
        if args.write:
            pilot_path = args.episode or PLACEHOLDER
            pilot = episode_estimate(pilot_path, args.retakes)
            series = series_estimate(guides_from_ledger(), cps, seconds, args.retakes)
            actual = as_rendered(args.cps_from, pilot, args.takes, args.render_seconds) if args.cps_from else None
            if actual is None and (args.takes is not None or args.render_seconds is not None):
                raise EstimateError(f"{args.cps_from} is not the render report of {pilot['episode']}; "
                                    "--takes and --render-seconds describe the pilot")
            write_markdown(SERIES_ESTIMATE_PATH, pilot, args.episode is None, series, cps_source, actual)
            if printed:
                print()
            print(f"wrote {_rel(SERIES_ESTIMATE_PATH)}")
            printed = True
        if args.live:
            remaining, limit = live()
            if printed:
                print()
            print(f"credits remaining: {remaining} characters (limit {limit})")
        return 0
    except (EstimateError, rb.ConfigError) as err:
        print(f"estimate: {err}", file=sys.stderr)
        return 2
    except rb.RenderError as err:
        print(f"estimate: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
