// A small seeded random number generator (mulberry32): the same seed gives the same game,
// so the world is deterministic and screenshot scenes are repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  random.int = (max) => Math.floor(random() * max);
  random.float = (min, max) => min + random() * (max - min);
  random.pick = (arr) => arr[random.int(arr.length)];
  random.bool = () => random() < 0.5;
  random.angle = () => random() * Math.PI * 2;
  return random;
}