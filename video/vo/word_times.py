#!/usr/bin/env python3
"""Word-level timings of an episode's rendered voice-over, for timing the capture beats to the spoken words.

  $SA_VIDEO_PYTHON video/vo/word_times.py --episode video/episodes/<id>/episode.json --out <file.json> [--model small.en]

Reads <media root>/episodes/<id>/vo/<line id>.wav for every vo line, runs Whisper with word timestamps, and writes
{ "<line id>": { "dur": seconds, "heard": text, "words": [ { "w": word, "s": start, "e": end } ] } }, with times in seconds from
the start of the line's file (which is where the cue lands). Offline, no credits. Nothing is written inside the repository
unless you choose --out there.
"""
import argparse
import json
import os
import sys
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--episode', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--model', default='small.en')
    a = ap.parse_args(argv)
    import media_root as MR
    import whisper
    with open(a.episode, encoding='utf-8') as f:
        ep = json.load(f)
    vo_dir = os.path.join(MR.media_root(), 'episodes', ep['id'], 'vo')
    model = whisper.load_model(a.model)
    out = {}
    for line in ep['vo']:
        path = os.path.join(vo_dir, f"{line['id']}.wav")
        with wave.open(path) as w:
            dur = w.getnframes() / w.getframerate()
        r = model.transcribe(path, word_timestamps=True, language='en', fp16=False)
        words = [dict(w=x['word'].strip(), s=round(x['start'], 3), e=round(x['end'], 3)) for seg in r['segments'] for x in seg['words']]
        out[line['id']] = dict(dur=round(dur, 3), heard=r['text'].strip(), words=words)
        print(f"{line['id']:6} {dur:6.2f} s  {r['text'].strip()}")
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
