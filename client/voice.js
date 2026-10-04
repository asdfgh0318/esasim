// Voice chat between the pilots of one private room: peer-to-peer WebRTC audio, the game server only relays the handshake ("rtc" messages).
// Opt-in: nothing happens (no microphone prompt, no connections) until the pilot turns voice on. Modes: off -> push-to-talk (hold T) -> open mic.
// Needs a secure page for the microphone (https or localhost); see the README. Without ?stun=1 only direct (LAN / same network) connections are
// tried, with ?stun=1 a public STUN server (Google) helps through home routers, which tells that server your address.
export function createVoice({ send, myId: getMyId, humans, onSpeaking, onMode, stun = false }) {
  const myId = () => getMyId();
  let mode = "off", stream = null, ctx = null, ptt = false;
  const peers = new Map(), announced = new Set(), levels = new Map();
  const iceServers = stun ? [{ urls: "stun:stun.l.google.com:19302" }] : [];
  const rtc = (to, data) => send({ to, data });

  addEventListener("keydown", (e) => { if (e.code === "KeyT" && !e.repeat && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")) { ptt = true; apply(); } });
  addEventListener("keyup", (e) => { if (e.code === "KeyT") { ptt = false; apply(); } });
  addEventListener("blur", () => { ptt = false; apply(); });

  const apply = () => { if (stream) for (const t of stream.getAudioTracks()) t.enabled = mode === "open" || (mode === "ptt" && ptt); };

  function watch(id, media) {                                                   // loudness meter for the "speaking" marker
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const an = ctx.createAnalyser(); an.fftSize = 256; ctx.createMediaStreamSource(media).connect(an);
    levels.set(id, { an, buf: new Uint8Array(an.frequencyBinCount) });
  }
  function makePeer(id) {
    close(id);
    const pc = new RTCPeerConnection({ iceServers }), p = { pc, audio: null };
    peers.set(id, p);
    const tr = pc.addTransceiver("audio", { direction: "sendrecv" });            // the microphone track is attached later with replaceTrack, no renegotiation
    p.sender = tr.sender;
    if (stream) tr.sender.replaceTrack(stream.getAudioTracks()[0]).catch(() => {});
    pc.onicecandidate = (e) => { if (e.candidate) rtc(id, { ice: e.candidate }); };
    pc.ontrack = (e) => {
      const ms = e.streams[0] || new MediaStream([e.track]);                      // the sender attaches its track with replaceTrack, so there may be no stream id
      p.audio = Object.assign(new Audio(), { srcObject: ms, autoplay: true }); p.audio.play?.().catch(() => {});
      watch(id, ms);
    };
    return p;
  }
  function close(id) { const p = peers.get(id); if (p) { try { p.pc.close(); } catch { /* closed */ } if (p.audio) p.audio.srcObject = null; peers.delete(id); levels.delete(id); } }
  async function offerTo(id) {
    const p = makePeer(id);
    await p.pc.setLocalDescription(await p.pc.createOffer());
    rtc(id, { sdp: p.pc.localDescription });
  }
  const announce = (id) => { announced.add(id); rtc(id, { join: true }); };

  async function onSignal(from, d) {
    if (mode === "off" || !d) return;
    if (d.join) {
      if (!d.re) rtc(from, { join: true, re: true });                             // answer a join once (re = reply, not answered again) so both sides know the other is on, whatever the order
      announced.add(from);
      if (myId() < from) await offerTo(from);                                       // the smaller id makes the offer, the other side answers
      return;
    }
    if (d.sdp) {
      let p = peers.get(from);
      if (d.sdp.type === "offer") {
        p = makePeer(from);
        await p.pc.setRemoteDescription(d.sdp);
        await p.pc.setLocalDescription(await p.pc.createAnswer());
        rtc(from, { sdp: p.pc.localDescription });
      } else if (p) await p.pc.setRemoteDescription(d.sdp);
    } else if (d.ice) { const p = peers.get(from); if (p) try { await p.pc.addIceCandidate(d.ice); } catch { /* stale candidate */ } }
  }

  // Poll loudness 10 times a second and report who is speaking (my own microphone counts when it is live).
  setInterval(() => {
    const talking = new Set();
    for (const [id, l] of levels) { l.an.getByteTimeDomainData(l.buf); let m = 0; for (const v of l.buf) m = Math.max(m, Math.abs(v - 128)); if (m > 12) talking.add(id); }
    if (stream && (mode === "open" || (mode === "ptt" && ptt))) talking.add(myId());
    onSpeaking(talking);
  }, 100);

  return {
    get mode() { return mode; },
    onSignal,
    // Called with every snapshot: connect to newly arrived pilots, drop the ones that left.
    sync() {
      if (mode === "off") return;
      const ids = new Set(humans().filter((id) => id !== myId()));
      for (const id of ids) if (!announced.has(id)) announce(id);
      for (const id of [...peers.keys()]) if (!ids.has(id)) { close(id); announced.delete(id); }
    },
    async cycle() {                                                               // off -> push-to-talk -> open mic -> off
      if (mode === "off") {
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
        catch (e) { onMode("error", e); return; }
        ctx ||= new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.();
        mode = "ptt"; apply();
        for (const p of peers.values()) p.sender.replaceTrack(stream.getAudioTracks()[0]).catch(() => {});
        for (const id of humans().filter((i) => i !== myId())) announce(id);
      } else if (mode === "ptt") mode = "open";
      else {
        mode = "off"; announced.clear();
        for (const id of [...peers.keys()]) close(id);
        if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
      }
      apply(); onMode(mode);
    },
    peerStates() { return Object.fromEntries([...peers].map(([id, p]) => [id, p.pc.connectionState])); },
  };
}
