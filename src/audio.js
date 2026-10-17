// WebAudio 合成音效（无版权素材）。所有输出接到 master，可同时送往录制流。
export class Sfx {
  constructor() { this.ctx = null; }
  ensure() {
    if (this.ctx) return this.ctx;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    this.ctx = new C(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.recDest = this.ctx.createMediaStreamDestination(); this.master.connect(this.recDest);
    this.makeNoise(); return this.ctx;
  }
  makeNoise() {
    const len = Math.round(this.ctx.sampleRate * 0.05), b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    this.noise = b;
  }
  // 当前时间：离线渲染时用 _t 指定事件时间
  now() { return this._t != null ? this._t : this.ctx.currentTime; }
  emit(name, o) { if (this.hook) try { this.hook(name, o || {}); } catch (e) { } }
  resume() { const c = this.ensure(); if (c && c.state === 'suspended') c.resume(); }
  click(t, vol, pitch) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = pitch;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200 * pitch; f.Q.value = 3;
    const g = c.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
    const o = c.createOscillator(), og = c.createGain(); o.frequency.value = 1900 * pitch; o.type = 'square';
    og.gain.setValueAtTime(vol * 0.08, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.02);
  }
  // 棘轮：dur 秒内以 rate 次/秒咔哒
  ratchet(dur, S, up = true) {
    if (S.sfxMute || !this.ensure()) return; const c = this.ctx, t0 = this.now(); this.emit(up ? 'ratchet_up' : 'ratchet_down', { dur });
    const n = Math.max(2, Math.round(dur * S.ratchetRate));
    for (let i = 0; i < n; i++) { const k = i / n; this.click(t0 + k * dur + Math.random() * 0.004, S.sfxVolume * (0.5 + 0.5 * Math.random()) * (up ? 1 - k * 0.4 : 0.6 + k * 0.4), S.ratchetPitch * (up ? 1 + k * 0.15 : 1.1 - k * 0.15)); }
  }
  thunk(S) { // 拧紧到位
    if (S.sfxMute || !this.ensure()) return; const c = this.ctx, t = this.now(); this.emit('thunk');
    const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(420 * S.ratchetPitch, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.06);
    g.gain.setValueAtTime(S.sfxVolume * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.1);
    this.click(t, S.sfxVolume, S.ratchetPitch * 0.8);
  }
  pop(S) { this.click(this.ensure() && this.ctx.currentTime, !S.sfxMute ? S.sfxVolumeume * 0.7 : 0, 1.4); }
  fall(S) {
    if (S.sfxMute || !S.fallSfx || !this.ensure()) return; const c = this.ctx, t = this.now(); this.emit('fall');
    const s = c.createBufferSource(); const len = c.sampleRate * 0.5, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
    s.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(250, t + 0.45);
    const g = c.createGain(); g.gain.value = S.sfxVolume * 0.35; s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
    // 木板轻碰
    const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    og.gain.setValueAtTime(S.sfxVolume * 0.4, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.16);
  }
  setBgm(url, vol) {
    if (!this.ensure()) return;
    if (this.bgmEl) { this.bgmEl.pause(); this.bgmEl = null; }
    if (!url) return;
    const a = new Audio(url); a.loop = true; this.bgmEl = a; this.bgmGain = this.ctx.createGain(); this.bgmGain.gain.value = vol;
    this.ctx.createMediaElementSource(a).connect(this.bgmGain); this.bgmGain.connect(this.master);
  }
  playBgm() { if (this.bgmEl) { this.bgmEl.currentTime = 0; this.bgmEl.play().catch(() => { }); } }
}

// ---------- 离线渲染（AE / 3D 导出用）----------
// events: [{t, name, dur}]；返回 AudioBuffer（单声道 44.1k）
export async function renderSfxOffline(events, dur, S) {
  const C = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!C) return null;
  const sr = 44100, oc = new C(1, Math.max(1, Math.ceil(sr * dur)), sr);
  const x = new Sfx(); x.ctx = oc; x.master = oc.createGain(); x.master.connect(oc.destination); x.makeNoise();
  const S2 = { ...S, sfx: true, fallSfx: true };
  for (const e of events) {
    x._t = e.t;
    if (e.name === 'ratchet_up' || e.name === 'ratchet_down') x.ratchet(e.dur, S2, e.name === 'ratchet_up');
    else if (e.name === 'thunk') x.thunk(S2);
    else if (e.name === 'fall') x.fall(S2);
  }
  return await oc.startRendering();
}
export function encodeWav(buf) {
  const ch = buf.getChannelData(0), n = ch.length, dv = new DataView(new ArrayBuffer(44 + n * 2));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, ch[i])); dv.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return new Uint8Array(dv.buffer);
}
