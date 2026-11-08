import Foundation

struct LockState {
    private(set) var locked = false
    private(set) var generation = 0
    private(set) var saverActive = false
    private(set) var systemLocked = false
    private(set) var sleeping = false
    private var failures = 0
    private var retryAfter: TimeInterval = 0
    private var titleTaps = 0
    private var lastTap: TimeInterval = 0
    var shouldPresent: Bool { locked && !saverActive && !systemLocked && !sleeping }

    mutating func begin() {
        guard !locked else { return }
        locked = true; generation += 1; failures = 0; retryAfter = 0; titleTaps = 0
    }
    mutating func unlock() { locked = false; generation += 1; titleTaps = 0; failures = 0; retryAfter = 0 }
    mutating func saverStarted(arm: Bool) { saverActive = true; invalidateAttempt(); if arm { begin() } }
    mutating func saverStopped() { saverActive = false }
    mutating func systemLock(_ value: Bool) {
        systemLocked = value
        if value { invalidateAttempt() } else { saverActive = false }
    }
    mutating func sleep(_ value: Bool) { sleeping = value; if value { invalidateAttempt() } }
    private mutating func invalidateAttempt() { generation += 1; titleTaps = 0 }
    func canAttempt(now: TimeInterval) -> Bool { locked && now >= retryAfter }
    mutating func failed(now: TimeInterval) {
        failures += 1
        if failures % 5 == 0 { retryAfter = now + min(30, Double(failures)) }
    }
    // Deliberate user-requested recovery gesture. A pause over 3 s starts a new sequence.
    mutating func titleTap(now: TimeInterval) -> Bool {
        guard locked else { return false }
        titleTaps = now - lastTap <= 3 ? titleTaps + 1 : 1; lastTap = now
        if titleTaps == 10 { titleTaps = 0; return true }
        return false
    }
}
