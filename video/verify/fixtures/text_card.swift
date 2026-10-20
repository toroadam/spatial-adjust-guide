// Test helper for test_ocr_check.py: draws one line of text, in a font file, on a light card and writes a PNG.
//
//   text_card <font.ttf> <out.png> <width> <height> <font px> <text ...>
//
// The ffmpeg on the pipeline machines has no drawtext filter (no libfreetype), so the OCR test draws its fixture text
// here instead, with the Golos UI font from _ds, the way the guides' own UI text looks. Compiled by the test into
// <media root>/episodes/_test/bin/. Never part of a render.
import AppKit
import CoreText
import Foundation

let a = CommandLine.arguments
guard a.count >= 7, let w = Int(a[3]), let h = Int(a[4]), let px = Double(a[5]) else {
    FileHandle.standardError.write("usage: text_card <font.ttf> <out.png> <width> <height> <font px> <text ...>\n".data(using: .utf8)!)
    exit(64)
}
guard let descriptors = CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: a[1]) as CFURL) as? [CTFontDescriptor],
      let descriptor = descriptors.first else {
    FileHandle.standardError.write("text_card: cannot load font \(a[1])\n".data(using: .utf8)!)
    exit(2)
}
let font = CTFontCreateWithFontDescriptor(descriptor, CGFloat(px), nil) as NSFont
let text = a[6...].joined(separator: " ")
guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4,
                                 hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else {
    exit(2)
}
rep.size = NSSize(width: w, height: h)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSColor(srgbRed: 0.96, green: 0.97, blue: 0.97, alpha: 1).setFill()               // gray05
NSRect(x: 0, y: 0, width: w, height: h).fill()
let string = NSAttributedString(string: text, attributes: [
    .font: font, .foregroundColor: NSColor(srgbRed: 0.03, green: 0.05, blue: 0.07, alpha: 1),   // gray100
])
let size = string.size()
string.draw(at: NSPoint(x: (CGFloat(w) - size.width) / 2, y: (CGFloat(h) - size.height) / 2))
NSGraphicsContext.restoreGraphicsState()
guard let png = rep.representation(using: .png, properties: [:]) else { exit(2) }
do {
    try png.write(to: URL(fileURLWithPath: a[2]))
} catch {
    FileHandle.standardError.write("text_card: cannot write \(a[2])\n".data(using: .utf8)!)
    exit(2)
}
