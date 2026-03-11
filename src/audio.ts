/** Web Audio API で簡易効果音を動的生成 */
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** ユーザー操作時に AudioContext を resume する（ブラウザ制限対策） */
export function resumeAudio(): void {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") {
    ctx.resume();
  }
}

/** 射出音: 短い「ポン」 */
export function playShoot(): void {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = "square";
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}

/** 着弾音: 「カチッ」 */
export function playLand(): void {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = "triangle";
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.08);
}

/** 出荷音: 上昇する「ピロリン」 */
export function playShip(big: boolean): void {
  const ctx = getAudioCtx();

  const notes = big
    ? [523, 659, 784, 1047] // C5 E5 G5 C6
    : [523, 659, 784]; // C5 E5 G5

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    const t = ctx.currentTime + i * 0.08;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.start(t);
    osc.stop(t + 0.15);
  });
}

/** ゲームオーバー音: 重い「ドゥーン ドゥーン ドゥーン」×3連 */
export function playGameOver(): void {
  const ctx = getAudioCtx();

  for (let i = 0; i < 3; i++) {
    const t = ctx.currentTime + i * 0.45;

    // メイン低音（重い打撃感）
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(80 - i * 10, t);
    osc1.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    gain1.gain.setValueAtTime(0.25, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc1.start(t);
    osc1.stop(t + 0.6);

    // サブ低音（厚みを出す）
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = "square";
    osc2.frequency.setValueAtTime(55 - i * 5, t);
    osc2.frequency.exponentialRampToValueAtTime(20, t + 0.4);
    gain2.gain.setValueAtTime(0.12, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc2.start(t);
    osc2.stop(t + 0.5);

    // ノイズ的なアタック感
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.type = "sawtooth";
    osc3.frequency.setValueAtTime(200, t);
    osc3.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    gain3.gain.setValueAtTime(0.18, t);
    gain3.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc3.start(t);
    osc3.stop(t + 0.1);
  }
}
