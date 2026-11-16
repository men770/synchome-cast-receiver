/*
 * SyncHome Cast receiver (audio only).
 *
 * Plays a live PCM/WAV (or any browser-playable) HTTP stream in a plain <audio> element
 * with a small, sender-controlled buffer, and exchanges JSON messages with the sender on
 * the custom namespace below:
 *
 *   sender -> receiver
 *     {type:"play",  url, lead}   start the stream; lead = seconds to keep behind live
 *     {type:"trim",  lead}        jump to (buffered end - lead)
 *     {type:"seek",  t}           absolute position in the stream (seconds)
 *     {type:"rate",  rate}        playbackRate (e.g. 1.00002 for clock-drift correction)
 *     {type:"stop"}
 *     {type:"ping",  id}          -> {type:"pong", id, ...}  (round-trip timing)
 *     {type:"meta",  title, artist} show the current track on displays
 *   receiver -> sender (broadcast, every second and on events)
 *     {type:"pos", ct, be, rate, paused, rs, perf, stalls}
 *         ct   = audio.currentTime (s)       be = end of buffered range (s)
 *         perf = performance.now() (ms)      stalls = number of 'waiting' events
 *     {type:"event", e, ...}
 */
(function () {
  "use strict";
  var NS = "urn:x-cast:synchome";
  var ctx = cast.framework.CastReceiverContext.getInstance();
  var a = document.getElementById("a");
  var label = document.getElementById("s");
  var stalls = 0;
  var lead = 0.3;

  function send(obj) {
    try { ctx.sendCustomMessage(NS, undefined, obj); } catch (e) { /* no sender yet */ }
  }

  function bufferedEnd() {
    var b = a.buffered;
    return b.length ? b.end(b.length - 1) : 0;
  }

  function status() {
    send({ type: "pos", ct: a.currentTime, be: bufferedEnd(), rate: a.playbackRate,
           paused: a.paused, rs: a.readyState, perf: performance.now(), stalls: stalls });
  }

  a.addEventListener("waiting", function () {
    stalls++;
    send({ type: "event", e: "waiting", ct: a.currentTime, perf: performance.now() });
  });
  a.addEventListener("playing", function () {
    label.textContent = "SyncHome ♪";
    send({ type: "event", e: "playing", ct: a.currentTime, perf: performance.now() });
  });
  a.addEventListener("error", function () {
    send({ type: "event", e: "error", code: a.error ? a.error.code : null });
  });

  ctx.addCustomMessageListener(NS, function (ev) {
    var m = ev.data || {};
    switch (m.type) {
      case "play":
        lead = typeof m.lead === "number" ? m.lead : lead;
        stalls = 0;
        a.preservesPitch = false;          // rate trims behave like resampling
        a.src = m.url;
        a.play().catch(function (e) { send({ type: "event", e: "play-failed", msg: String(e) }); });
        break;
      case "trim":
        var be = bufferedEnd();
        var l = typeof m.lead === "number" ? m.lead : lead;
        if (be > l) { a.currentTime = be - l; }
        send({ type: "event", e: "trimmed", ct: a.currentTime, be: be, perf: performance.now() });
        break;
      case "seek":
        a.currentTime = m.t;
        break;
      case "rate":
        if (typeof m.rate === "number" && m.rate > 0.9 && m.rate < 1.1) { a.playbackRate = m.rate; }
        break;
      case "stop":
        a.pause();
        a.removeAttribute("src");
        a.load();
        label.textContent = "SyncHome";
        break;
      case "meta":
        // current track for displays (e.g. Nest Hub); Hebrew/RTL safe
        label.dir = "auto";
        label.textContent = [m.title, m.artist].filter(Boolean).join(" — ") || "SyncHome";
        break;
      case "ping":
        send({ type: "pong", id: m.id, ct: a.currentTime, perf: performance.now() });
        break;
    }
  });

  setInterval(status, 1000);

  var opts = new cast.framework.CastReceiverOptions();
  opts.disableIdleTimeout = true;          // keep running while streaming silence
  opts.skipPlayersLoad = true;             // we use our own <audio> element
  opts.customNamespaces = {};
  opts.customNamespaces[NS] = cast.framework.system.MessageType.JSON;
  ctx.start(opts);
})();
