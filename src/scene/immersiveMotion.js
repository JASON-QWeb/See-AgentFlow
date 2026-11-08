// Three overlapping rhythms create slow passages and short bursts without
// repeating a single pulse. The shared clock keeps linked displays in phase.
const PERIOD = 120_000;
const RHYTHMS = [[4, .42], [9, .24], [17, .12]].map(([cycles, depth]) =>
  [cycles * 2 * Math.PI / PERIOD, depth]);

export function immersiveMotion(now) {
  const elapsed = now % PERIOD;
  let speed = 1, time = now;
  for (const [frequency, depth] of RHYTHMS) {
    const angle = elapsed * frequency;
    speed += depth * Math.cos(angle);
    // Integrate the rate so the animation stays continuous and moves forward.
    time += depth / frequency * Math.sin(angle);
  }
  return { speed, time };
}
