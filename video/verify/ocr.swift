// Ported from iCentral MarCom 06-edit/compositor/tools/ocr/ocr.swift (10 lines) on 2026-10-20; changes listed in video/verify/NOTES.md
//
// sa-ocr: on-device OCR with Apple Vision. Nothing leaves the machine.
//
//   sa-ocr [--min-text-height <fraction>[,<fraction>...]] <image> [<image> ...]
//
// Prints one JSON object per image, one per line, in argument order:
//   {"file": "<path>", "lines": ["<line>", ...], "alternates": ["<line>", ...]}
//   {"file": "<path>", "error": "<reason>"}          when the image cannot be read or recognised
// "lines" holds each observation's best reading, "alternates" its second and third, so a caller can match names that
// the best reading got slightly wrong. Recognition: VNRecognizeTextRequest, accurate level, en-US, no language
// correction (correction would "fix" a name into an ordinary word).
//
// Each image is read once per --min-text-height value (a comma-separated list of fractions of the image height,
// default 0.03125,0.008: Vision's own default and about 9 px at 1080) and the readings are merged, without repeats.
// Measured on Golos UI test cards at 1920x1080, small UI text (11 to 14 px) comes out differently, and often wrongly,
// in each setting; reading twice and keeping both catches a name that one reading garbles.
//
// Exit codes: 0 every image recognised, 1 at least one image failed, 64 usage.
// Compiled by video/verify/ocr_check.py to <media root>/bin/sa-ocr. The text it prints may hold real names: the caller
// matches it in memory and never logs or stores it.
import AppKit
import Foundation
import Vision

func emit(_ object: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: object, options: []),
          let line = String(data: data, encoding: .utf8) else { return }
    print(line)
}

var args = Array(CommandLine.arguments.dropFirst())
var minTextHeights: [Float] = [0.03125, 0.008]
if args.count >= 2 && args[0] == "--min-text-height" {
    let hs = args[1].split(separator: ",").compactMap { Float($0) }
    guard !hs.isEmpty, hs.allSatisfy({ $0 > 0 && $0 < 1 }) else {
        FileHandle.standardError.write("sa-ocr: --min-text-height takes fractions between 0 and 1, comma-separated\n".data(using: .utf8)!)
        exit(64)
    }
    minTextHeights = hs
    args.removeFirst(2)
}
if args.isEmpty {
    FileHandle.standardError.write("usage: sa-ocr [--min-text-height <fraction>[,<fraction>...]] <image> [<image> ...]\n".data(using: .utf8)!)
    exit(64)
}

var failed = false
for path in args {
    autoreleasepool {
        guard let image = NSImage(contentsOfFile: path),
              let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            emit(["file": path, "error": "unreadable image"])
            failed = true
            return
        }
        var lines: [String] = []
        var alternates: [String] = []
        for height in minTextHeights {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["en-US"]
            request.usesLanguageCorrection = false
            request.minimumTextHeight = height
            do {
                try VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
            } catch {
                emit(["file": path, "error": "recognition failed"])
                failed = true
                return
            }
            for observation in request.results ?? [] {
                let candidates = observation.topCandidates(3).map { $0.string }
                if let best = candidates.first, !lines.contains(best) { lines.append(best) }
                for alt in candidates.dropFirst() where !alternates.contains(alt) { alternates.append(alt) }
            }
        }
        emit(["file": path, "lines": lines, "alternates": alternates])
    }
}
exit(failed ? 1 : 0)
