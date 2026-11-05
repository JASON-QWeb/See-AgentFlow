import AppKit

@main
struct LayoutTests {
    static func main() {
        let left = NSRect(x: -1920, y: 0, width: 1920, height: 1080)
        let right = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let first = DisplayLayout.from(frames: [left, right], selected: left).values
        let second = DisplayLayout.from(frames: [left, right], selected: right, primary: right).values
        precondition(first["x"] == 0 && second["x"] == 1920)
        precondition(first["worldWidth"] == 3840 && second["worldWidth"] == 3840)
        precondition(second["mainX"] == 1920 && second["isMain"] == 1)
        let single = DisplayLayout.from(frames: [right], selected: right).values
        precondition(single["x"] == 0 && single["count"] == 1 && single["worldWidth"] == 1920)
        let above = NSRect(x: 0, y: 1080, width: 1920, height: 1080)
        let stacked = DisplayLayout.from(frames: [above, right], selected: right).values
        precondition(stacked["y"] == 1080 && stacked["worldHeight"] == 2160)
        print("Native layout tests passed: negative origins, mixed-density geometry, single-display fallback, vertical offsets")
    }
}
