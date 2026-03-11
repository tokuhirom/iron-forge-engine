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

/** スピードアップ警告音: 上昇する「ビビビッ！」 */
export function playSpeedUp(): void {
  const ctx = getAudioCtx();

  // 警告的な上昇音を3段
  const freqs = [330, 440, 660];
  freqs.forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start(t);
    osc.stop(t + 0.12);
  });

  // 最後にアクセント
  const t = ctx.currentTime + 0.35;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.15);
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.start(t);
  osc.stop(t + 0.2);
}

// --- BGM ---

let bgmInterval: ReturnType<typeof setInterval> | null = null;
let bgmBpm = 120;
let bgmPlaying = false;

/** BGM開始: スチームパンク風の機械リズムループ */
export function startBGM(): void {
  stopBGM();
  bgmBpm = 120;
  bgmPlaying = true;
  scheduleBGMLoop();
}

/** BGMテンポを上げる */
export function speedUpBGM(): void {
  bgmBpm = Math.min(220, bgmBpm + 20);
  // ループ再スケジュール
  if (bgmInterval !== null) {
    clearInterval(bgmInterval);
    scheduleBGMLoop();
  }
}

/** BGM停止 */
export function stopBGM(): void {
  bgmPlaying = false;
  if (bgmInterval !== null) {
    clearInterval(bgmInterval);
    bgmInterval = null;
  }
}

function scheduleBGMLoop(): void {
  if (!bgmPlaying) return;
  const beatMs = (60 / bgmBpm) * 1000;
  playBGMBar();
  bgmInterval = setInterval(() => {
    if (!bgmPlaying) return;
    playBGMBar();
  }, beatMs * 4); // 4拍ごとに1小節
}

// タブが非表示になったらBGMを一時停止、表示されたら再開
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // タブ非表示 → interval停止（音は自然に止まる）
    if (bgmInterval !== null) {
      clearInterval(bgmInterval);
      bgmInterval = null;
    }
  } else {
    // タブ表示 → 再開（bgmPlayingがtrueの場合のみ）
    if (bgmPlaying && bgmInterval === null) {
      scheduleBGMLoop();
    }
  }
});

function playBGMBar(): void {
  const ctx = getAudioCtx();
  const beatSec = 60 / bgmBpm;

  // 4拍のリズムパターン: ドン・カッ・ドドン・カッ
  const pattern: { time: number; freq: number; type: OscillatorType; dur: number; vol: number }[] = [
    // Beat 1: ドン（低いキック）
    { time: 0, freq: 60, type: "sine", dur: 0.15, vol: 0.18 },
    { time: 0, freq: 120, type: "square", dur: 0.05, vol: 0.08 },
    // Beat 2: カッ（ハイハット的）
    { time: beatSec, freq: 800, type: "square", dur: 0.03, vol: 0.06 },
    // Beat 2.5: 裏拍ハイハット
    { time: beatSec * 1.5, freq: 900, type: "square", dur: 0.02, vol: 0.04 },
    // Beat 3: ドドン（キック2連）
    { time: beatSec * 2, freq: 55, type: "sine", dur: 0.12, vol: 0.16 },
    { time: beatSec * 2.3, freq: 65, type: "sine", dur: 0.12, vol: 0.14 },
    { time: beatSec * 2.3, freq: 130, type: "square", dur: 0.04, vol: 0.06 },
    // Beat 4: カッ
    { time: beatSec * 3, freq: 800, type: "square", dur: 0.03, vol: 0.06 },
    // Beat 4.5: 裏拍
    { time: beatSec * 3.5, freq: 950, type: "square", dur: 0.02, vol: 0.04 },
  ];

  // ベースライン（機械的な反復音）
  const bassNotes = [55, 55, 65, 55];
  bassNotes.forEach((freq, i) => {
    const t = ctx.currentTime + beatSec * i;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.setValueAtTime(0.04, t + beatSec * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + beatSec * 0.9);
    osc.start(t);
    osc.stop(t + beatSec * 0.9);
  });

  for (const p of pattern) {
    const t = ctx.currentTime + p.time;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = p.type;
    osc.frequency.setValueAtTime(p.freq, t);
    if (p.freq < 200) {
      osc.frequency.exponentialRampToValueAtTime(p.freq * 0.5, t + p.dur);
    }
    gain.gain.setValueAtTime(p.vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
    osc.start(t);
    osc.stop(t + p.dur);
  }
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
