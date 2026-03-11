import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../constants";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: "TitleScene" });
  }

  create(): void {
    // タイトル
    this.add
      .text(GAME_WIDTH / 2, 100, "鉄塊機関", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#e0d0b0",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 145, "―IRON FORGE ENGINE―", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#888899",
      })
      .setOrigin(0.5);

    // 遊び方
    const instructions = [
      "【 遊び方 】",
      "",
      "欠けた鉄塊が降ってくる",
      "",
      "  ■■■    ■■",
      "  ■ ■    ■■ ← 穴がある！",
      "          ■",
      "",
      "ブロックを撃って穴を埋めろ！",
      "",
      "  ■■■",
      "  ■■■ ← 四角完成で出荷！",
      "",
      "大きい四角 ＝ 高スコア",
      "",
      "【 操作 】",
      "スワイプ … 砲台を移動",
      "タップ   … ブロック発射",
    ];

    this.add
      .text(GAME_WIDTH / 2, 340, instructions.join("\n"), {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ccbbaa",
        align: "center",
        lineSpacing: 4,
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

    this.input.once("pointerup", () => {
      this.scene.start("GameScene");
    });
  }
}
