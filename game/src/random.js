// A small seeded random number generator: the same seed gives the same orders,
// the same spawn timing and the same screenshot scenes, which is what makes the
// staged screenshots repeatable. It is a 32-bit hash walk (mulberry32): each
// call scrambles the state and returns a number in [0, 1).

export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), 1 | mixed);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one element of `list` with the seeded generator. */
export function pickOne(random, list) {
  return list[Math.floor(random() * list.length)];
}
