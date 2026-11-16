# SyncHome Cast Receiver

A tiny, audio-only Google Cast Web Receiver used by SyncHome (a home multi-room audio
sync app). It plays a live HTTP audio stream from a sender on the local network in a plain
`<audio>` element, keeps only a small buffer, and talks to the sender over the custom
namespace `urn:x-cast:synchome`:

- sender → receiver: `play`, `trim`, `seek`, `rate`, `stop`, `ping`
- receiver → sender: `pos` (current time, buffered end, rate, stalls) every second, plus events

The sender uses the position reports to keep several speakers in sync and to compensate
clock drift with tiny `playbackRate` changes.

Hosted with GitHub Pages; register its URL as a Custom Receiver in the Google Cast SDK
Developer Console. No data is collected or sent anywhere except back to the sender.

License: MIT
