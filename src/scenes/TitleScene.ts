import Phaser from "phaser";
import { GAME_WIDTH } from "../constants";
import type { ControlMode } from "../constants";
import { resumeAudio } from "../audio";

export class TitleScene extends Phaser.Scene {
  private ready = false;
  private readonly textRes = Math.max(2, window.devicePixelRatio || 2);
  private selectedMode: ControlMode = "direct";

  constructor() {
    super({ key: "TitleScene" });
  }

  create(): void {
    this.ready = false;

    // 前回の選択を復元
    try {
      const saved = localStorage.getItem("iron-forge-control-mode");
      if (saved === "direct" || saved === "swipe" || saved === "vpad") {
        this.selectedMode = saved;
      }
    } catch { /* ignore */ }

    // タイトル
    this.add
      .text(GAME_WIDTH / 2, 80, "鉄塊機関", {
        fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
        fontSize: "40px",
        color: "#e0d0b0",
        stroke: "#332211",
        strokeThickness: 3,
        resolution: this.textRes,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 125, "IRON FORGE ENGINE", {
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
    line.lineBetween(60, 148, GAME_WIDTH - 60, 148);

    // 遊び方
    const rules = [
      "欠けた鉄塊が降ってくる",
      "ブロックを撃って穴を埋めろ！",
      "",
      "四角形を完成させると「出荷」",
      "大きな四角ほど超高スコア！",
    ];

    this.add
      .text(GAME_WIDTH / 2, 220, rules.join("\n"), {
        fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
        fontSize: "15px",
        color: "#ccbbaa",
        align: "center",
        lineSpacing: 8,
        resolution: this.textRes,
      })
      .setOrigin(0.5);

    // 操作モード選択
    this.add
      .text(GAME_WIDTH / 2, 330, "操作タイプ", {
        fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
        fontSize: "14px",
        color: "#998877",
        resolution: this.textRes,
      })
      .setOrigin(0.5);

    const modes: { key: ControlMode; label: string; desc: string }[] = [
      { key: "direct", label: "ダイレクト", desc: "タップした列に発射" },
      { key: "swipe",  label: "スワイプ",   desc: "スワイプ+タップ" },
      { key: "vpad",   label: "仮想パッド", desc: "← → ボタンで移動" },
    ];

    const btnTexts: Phaser.GameObjects.Text[] = [];
    const btnBgs: Phaser.GameObjects.Rectangle[] = [];

    const btnW = 110;
    const btnH = 70;
    const btnY = 395;
    const gap = 8;
    const totalW = btnW * 3 + gap * 2;
    const startX = (GAME_WIDTH - totalW) / 2 + btnW / 2;

    for (let i = 0; i < modes.length; i++) {
      const m = modes[i];
      const x = startX + i * (btnW + gap);

      const bg = this.add.rectangle(x, btnY, btnW, btnH, 0x223344, 1)
        .setStrokeStyle(2, 0x445566).setInteractive({ useHandCursor: true });

      const label = this.add.text(x, btnY - 12, m.label, {
        fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
        fontSize: "14px", color: "#ccddee",
        resolution: this.textRes,
      }).setOrigin(0.5);

      const desc = this.add.text(x, btnY + 14, m.desc, {
        fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
        fontSize: "10px", color: "#889999",
        resolution: this.textRes,
      }).setOrigin(0.5);

      btnBgs.push(bg);
      btnTexts.push(label, desc);

      bg.on("pointerdown", () => {
        this.selectedMode = m.key;
        this.updateModeButtons(btnBgs, modes);
      });
    }

    this.updateModeButtons(btnBgs, modes);

    // PC操作説明
    this.add
      .text(GAME_WIDTH / 2, 448, "PC: ←→/AD移動  Space発射  Esc一時停止", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#666677",
        resolution: this.textRes,
      })
      .setOrigin(0.5);

    // スタートボタン
    const startBg = this.add.rectangle(
      GAME_WIDTH / 2, 530, 200, 50, 0x334488, 1
    ).setStrokeStyle(2, 0x5566aa).setInteractive({ useHandCursor: true });

    const startText = this.add
      .text(GAME_WIDTH / 2, 530, "開始", {
        fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
        fontSize: "24px",
        color: "#88aaff",
        resolution: this.textRes,
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: startText,
      alpha: 0.4,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    startBg.on("pointerdown", () => {
      if (!this.ready) return;
      this.startGame();
    });

    // フルスクリーンボタン（PWAモードでなく、Fullscreen APIが使える場合のみ表示）
    const isPwa = window.matchMedia("(display-mode: standalone)").matches;
    if (!isPwa && document.documentElement.requestFullscreen) {
      const fsBg = this.add.rectangle(
        GAME_WIDTH / 2, 580, 180, 36, 0x223344, 1
      ).setStrokeStyle(1, 0x445566).setInteractive({ useHandCursor: true });

      this.add.text(GAME_WIDTH / 2, 580, "\u26F6 フルスクリーン", {
        fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
        fontSize: "13px", color: "#8899aa",
        resolution: this.textRes,
      }).setOrigin(0.5);

      fsBg.on("pointerdown", () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // ビルド情報
    this.add
      .text(GAME_WIDTH / 2, 610, `${__BUILD_DATE__} (${__COMMIT_HASH__})`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#555566",
      })
      .setOrigin(0.5);

    // 誤爆防止: 800ms 後に有効化
    this.time.delayedCall(800, () => {
      this.ready = true;
    });
  }

  private updateModeButtons(
    bgs: Phaser.GameObjects.Rectangle[],
    modes: { key: ControlMode }[],
  ): void {
    for (let i = 0; i < bgs.length; i++) {
      const selected = modes[i].key === this.selectedMode;
      bgs[i].setFillStyle(selected ? 0x445588 : 0x223344);
      bgs[i].setStrokeStyle(2, selected ? 0x88aadd : 0x445566);
    }
  }

  private startGame(): void {
    try {
      localStorage.setItem("iron-forge-control-mode", this.selectedMode);
    } catch { /* ignore */ }
    resumeAudio();
    this.scene.start("GameScene", { controlMode: this.selectedMode });
  }
}
