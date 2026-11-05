import AppKit

struct DisplayLayout {
    let values: [String: Double]

    static func make(screen: NSScreen?, preview: Bool) -> DisplayLayout {
        let screens = NSScreen.screens.sorted {
            if $0.frame.minX != $1.frame.minX { return $0.frame.minX < $1.frame.minX }
            return $0.frame.maxY > $1.frame.maxY
        }
        let current = screen ?? screens.first
        let frame = current?.frame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frames = preview ? [frame] : screens.map(\.frame)
        return from(frames: frames, selected: frame, primary: preview ? frame : NSScreen.screens.first?.frame)
    }

    static func from(frames: [NSRect], selected: NSRect, primary: NSRect? = nil) -> DisplayLayout {
        let union = frames.dropFirst().reduce(frames.first ?? selected) { $0.union($1) }
        let main = primary ?? frames.first ?? selected
        return DisplayLayout(values: [
            "x": selected.minX - union.minX, "y": union.maxY - selected.maxY,
            "width": selected.width, "height": selected.height,
            "worldWidth": union.width, "worldHeight": union.height,
            "mainX": main.minX - union.minX, "mainY": union.maxY - main.maxY,
            "mainWidth": main.width, "mainHeight": main.height, "isMain": selected == main ? 1 : 0,
            "index": Double(frames.firstIndex(of: selected) ?? 0), "count": Double(frames.count)
        ])
    }

    var json: String {
        let data = try? JSONSerialization.data(withJSONObject: values, options: [.sortedKeys])
        return data.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
    }
}
