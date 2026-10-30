import AppKit
import Foundation

let specPath = CommandLine.arguments[1]
let out = CommandLine.arguments[2]
let data = try Data(contentsOf: URL(fileURLWithPath: specPath))
let spec = try JSONSerialization.jsonObject(with: data) as! [String: Any]
let chapters = spec["chapters"] as! [[String: Any]]
func color(_ value: UInt32) -> NSColor {
    NSColor(srgbRed: CGFloat((value >> 16) & 255)/255, green: CGFloat((value >> 8) & 255)/255, blue: CGFloat(value & 255)/255, alpha: 1)
}
func text(_ value: String, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ size: CGFloat, _ weight: NSFont.Weight, _ ink: NSColor) {
    let style = NSMutableParagraphStyle()
    style.lineSpacing = 5
    let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: size, weight: weight), .foregroundColor: ink, .paragraphStyle: style]
    NSAttributedString(string: value, attributes: attrs).draw(in: NSRect(x:x,y:y,width:w,height:h))
}
for ch in chapters where ch["layout"] as! String == "cli" {
    let rep = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:1920,pixelsHigh:1080,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
    NSGraphicsContext.saveGraphicsState()
    let ctx = NSGraphicsContext(bitmapImageRep:rep)!
    NSGraphicsContext.current = ctx
    ctx.cgContext.translateBy(x: 0, y: 1080)
    ctx.cgContext.scaleBy(x: 1, y: -1)
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx.cgContext, flipped: true)
    ctx.cgContext.setFillColor(color(0x080F1B).cgColor)
    ctx.cgContext.fill(CGRect(x:0,y:0,width:1920,height:1080))
    let white=color(0xF3F7FF), muted=color(0xB4C1D7), blue=color(0x80A4FF)
    text("AGENTPAY",72,56,500,60,33,.bold,white)
    text("Chainlink CRE · deterministic guardrails",72,107,530,45,23,.regular,muted)
    text(ch["label"] as! String,72,250,530,50,20,.semibold,blue)
    text(ch["title"] as! String,68,310,540,265,58,.bold,white)
    text(ch["detail"] as! String,72,605,535,135,26,.regular,muted)
    let status = ch["status"] as! String
    let amber = status.contains("DENY") || status.contains("CLOSE")
    text(status,72,815,540,80,25,.bold,color(amber ? 0xF5CC76 : 0x8AE6BE))
    text("CLI recording  /  Stream #9",650,53,1150,45,23,.medium,muted)
    text("Original session · waits shortened",650,1026,1200,35,19,.regular,muted)
    ctx.cgContext.setFillColor(blue.cgColor)
    ctx.cgContext.fill(CGRect(x:72,y:211,width:72,height:3))
    NSGraphicsContext.restoreGraphicsState()
    try rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:out+"/panel-"+(ch["id"] as! String)+".png"))
}
print("CLI panels rendered")
