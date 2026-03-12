/** Web Audio API で簡易効果音を動的生成 */
let audioCtx: AudioContext | null = null;
let muted = false;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** オシレーター+ゲインノードを作成し接続して返す */
function createNote(ctx: AudioContext, type: OscillatorType, freq: number, vol: number, startTime: number, dur: number, freqEnd?: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + dur);
  }
  gain.gain.setValueAtTime(vol, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
  osc.start(startTime);
  osc.stop(startTime + dur);
}

/** ユーザー操作時に AudioContext を resume する（ブラウザ制限対策） */
export function resumeAudio(): void {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") {
    ctx.resume();
  }
}

/** ミュート状態を取得 */
export function isMuted(): boolean {
  return muted;
}

/** ミュート切り替え。BGMも連動して停止/再開する */
export function setMuted(val: boolean): void {
  muted = val;
  try {
    localStorage.setItem("iron-forge-muted", val ? "1" : "0");
  } catch { /* ignore */ }
  if (val) {
    stopBGM();
  } else if (bgmPlaying) {
    scheduleBGMLoop();
  }
}

/** localStorageからミュート設定を復元 */
export function restoreMuteSetting(): void {
  try {
    muted = localStorage.getItem("iron-forge-muted") === "1";
  } catch { /* ignore */ }
}

/** 射出音: 短い「ポン」 */
export function playShoot(): void {
  if (muted) return;
  const ctx = getAudioCtx();
  createNote(ctx, "square", 440, 0.15, ctx.currentTime, 0.1, 220);
}

/** 着弾音: 「カチッ」 */
export function playLand(): void {
  if (muted) return;
  const ctx = getAudioCtx();
  createNote(ctx, "triangle", 800, 0.2, ctx.currentTime, 0.08, 400);
}

/** 出荷音: 上昇する「ピロリン」 */
export function playShip(big: boolean): void {
  if (muted) return;
  const ctx = getAudioCtx();

  const notes = big
    ? [523, 659, 784, 1047] // C5 E5 G5 C6
    : [523, 659, 784]; // C5 E5 G5

  notes.forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.08;
    createNote(ctx, "sine", freq, 0.2, t, 0.15);
  });
}

/** スピードアップ警告音: 上昇する「ビビビッ！」 */
export function playSpeedUp(): void {
  if (muted) return;
  const ctx = getAudioCtx();

  // 警告的な上昇音を3段
  [330, 440, 660].forEach((freq, i) => {
    createNote(ctx, "square", freq, 0.2, ctx.currentTime + i * 0.1, 0.12);
  });

  // 最後にアクセント
  createNote(ctx, "sawtooth", 880, 0.15, ctx.currentTime + 0.35, 0.2, 440);
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
    if (bgmInterval !== null) {
      clearInterval(bgmInterval);
      bgmInterval = null;
    }
  } else {
    if (bgmPlaying && bgmInterval === null) {
      scheduleBGMLoop();
    }
  }
});

function playBGMBar(): void {
  if (muted) return;
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
  [55, 55, 65, 55].forEach((freq, i) => {
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
    createNote(ctx, p.type, p.freq, p.vol, t, p.dur, p.freq < 200 ? p.freq * 0.5 : undefined);
  }
}

/** ゲームオーバー音: 重い「ドゥーン ドゥーン ドゥーン」×3連 */
export function playGameOver(): void {
  if (muted) return;
  const ctx = getAudioCtx();

  for (let i = 0; i < 3; i++) {
    const t = ctx.currentTime + i * 0.45;
    // メイン低音（重い打撃感）
    createNote(ctx, "sawtooth", 80 - i * 10, 0.25, t, 0.6, 30);
    // サブ低音（厚みを出す）
    createNote(ctx, "square", 55 - i * 5, 0.12, t, 0.5, 20);
    // ノイズ的なアタック感
    createNote(ctx, "sawtooth", 200, 0.18, t, 0.1, 40);
  }
}
