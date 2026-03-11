import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { resumeAudio } from "../audio";

export class TitleScene extends Phaser.Scene {
  private ready = false;
  private readonly textRes = Math.max(2, window.devicePixelRatio || 2);

  constructor() {
    super({ key: "TitleScene" });
  }

  create(): void {
    this.ready = false;

    // タイトル
    this.add
      .text(GAME_WIDTH / 2, 120, "鉄塊機関", {
        fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
        fontSize: "40px",
        color: "#e0d0b0",
        stroke: "#332211",
        strokeThickness: 3,
        resolution: this.textRes,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 168, "IRON FORGE ENGINE", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#887766",
        letterSpacing: 4,
        resolution: this.textRes,
      })
      .setOrigin(0.5);

    // 区切り線
    const line = this.add.graphics();
    line.lineStyle(1, 0x554433, 0.5);
    line.lineBetween(60, 195, GAME_WIDTH - 60, 195);

    // 遊び方
    const rules = [
      "欠けた鉄塊が降ってくる",
      "ブロックを撃って穴を埋めろ！",
      "",
      "四角形を完成させると「出荷」",
      "大きな四角ほど超高スコア！",
    ];

    this.add
      .text(GAME_WIDTH / 2, 270, rules.join("\n"), {
        fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
        fontSize: "15px",
        color: "#ccbbaa",
        align: "center",
        lineSpacing: 8,
        resolution: this.textRes,
      })
      .setOrigin(0.5);

    // 操作説明
    const controls = "スワイプ → 砲台移動\nタップ → 発射";

    this.add
      .text(GAME_WIDTH / 2, 400, controls, {
        fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
        fontSize: "14px",
        color: "#998877",
        align: "center",
        lineSpacing: 6,
        resolution: this.textRes,
      })
      .setOrigin(0.5);

    // スタートボタン
    const startText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 100, "TAP TO START", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#88aaff",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: startText,
      alpha: 0.3,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    // ビルド情報
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 30, `${__BUILD_DATE__} (${__COMMIT_HASH__})`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#555566",
      })
      .setOrigin(0.5);

    // 画面全体をタップ可能なゾーンにする
    const zone = this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);
    zone.setInteractive();
    zone.on("pointerdown", () => {
      if (!this.ready) return;
      resumeAudio();
      this.scene.start("GameScene");
    });

    // 誤爆防止: 800ms 後に有効化
    this.time.delayedCall(800, () => {
      this.ready = true;
    });
  }
}
