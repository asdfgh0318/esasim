# Netcode: how streamer cuts are judged online

Code: `shared/arena.js` (`step()`, `LAG`, `viewDelay`, `_rewound`), `server/index.js` (ping/pong), `test/lagcomp.test.js`.
Rules: ESA §4.11 (a cut counts once per attack, only the attached streamer counts), §3.7 (10 m streamer).

## Who decides what

- Each browser flies its own plane and sends its position 20 times a second. The server believes it
  (client-authoritative flight, see audit finding N3).
- The server builds every streamer from those positions, and it alone decides cuts and points.

## The problem

You see the other planes and their streamers late. The server's snapshot needs one network trip to reach you,
your browser shows it 100 ms in the past so the movement is smooth (`INTERP_MS` in `client/main.js`), and your own
position needs another trip back to the server. At 15 m/s, 150 ms is more than 2 m. Without a correction, a cut
that looked clean on your screen often missed on the server.

## The fix: favour the shooter

- The server keeps about 1 s of each streamer's shape, one copy per server tick (30 per second).
- Once a second the server sends each player a `ping`; the browser answers `pong` at once. The server times
  the round trip on its own clock and smooths it (80 % old value, 20 % new sample).
- A human attacker's **view delay** = round trip + 100 ms, at most **250 ms**. Bots see the present (no delay).
- The attacker's path between its last two positions is tested against the victim's streamer as it was
  view-delay ago (interpolated between two stored ticks).
- A hit cuts the victim's **live** streamer at the same distance from the tail (the paper moves with the plane,
  so "8.7 m from the tail" means the same piece of paper then and now).
- A hit on a part that has been cut off since then does not count (§4.11: only the attached streamer).
  Several hits in one attack still count once (`fight.cut`, §4.11).
- After a streamer is replaced (new launch), the old one's history is never used.

## Limits and what a cheater can still do

- **The clamp.** A player whose browser answers the ping late can make its round trip look longer, but the
  rewind never exceeds 250 ms. Lag above that (round trip over about 150 ms) is not fully compensated: such a
  player has to lead the target a bit.
- The victim pays: you can lose your streamer to a pass that, on your own screen, looked like a near miss.
  That is the usual trade-off of "favour the shooter" and is limited to 250 ms of streamer movement.
- Not compensated: the server tick (up to 33 ms) and the gap between snapshots; both are small next to the
  hit zone the prop and wing sweep in that time.
- Flight is still client-authoritative. A cheater can teleport, fly impossibly fast or fake `airborne`
  (finding N3). Lag compensation does not make this worse, apart from the 250 ms of rewind.
- Not yet tested over a real internet connection; the tests simulate the delay inside the server.
