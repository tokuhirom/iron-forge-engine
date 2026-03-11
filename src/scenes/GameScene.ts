import Phaser from "phaser";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
  CANNON_Y,
  CANNON_WIDTH,
  CANNON_HEIGHT,
  BULLET_SPEED,
  BULLET_RADIUS,
  SCRAP_SPAWN_INTERVAL,
  GRAVITY_INTERVAL,
  BASE_SCORE,
  CHAIN_MULTIPLIER,
  COLORS,
} from "../constants";

export class GameScene extends Phaser.Scene {
  private cannon!: Phaser.GameObjects.Rectangle;
  private bullets: Phaser.GameObjects.Arc[] = [];
  private grid: (Phaser.GameObjects.Rectangle | null)[][] = [];
  private gridState: boolean[][] = [];
  private score = 0;
  private chain = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private spawnTimer!: Phaser.Time.TimerEvent;
  private gravityTimer!: Phaser.Time.TimerEvent;
  private gameOver = false;

  // タッチ入力用
  private touchStartX = 0;
  private isSwiping = false;
  private swipeThreshold = 10;

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.score = 0;
    this.chain = 0;
    this.gameOver = false;
    this.bullets = [];

    // グリッド初期化
    this.gridState = Array.from({ length: GRID_ROWS }, () =>
      Array(GRID_COLS).fill(false)
    );
    this.grid = Array.from({ length: GRID_ROWS }, () =>
      Array(GRID_COLS).fill(null)
    );

    // グリッド線描画
    this.drawGridLines();

    // 砲台
    this.cannon = this.add.rectangle(
      GAME_WIDTH / 2,
      CANNON_Y,
      CANNON_WIDTH,
      CANNON_HEIGHT,
      COLORS.cannon
    );

    // スコア表示
    this.scoreText = this.add.text(10, 10, "SCORE: 0", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: COLORS.text,
    });

    // スクラップ生成タイマー
    this.spawnTimer = this.time.addEvent({
      delay: SCRAP_SPAWN_INTERVAL,
      callback: this.spawnScrap,
      callbackScope: this,
      loop: true,
    });

    // 重力タイマー
    this.gravityTimer = this.time.addEvent({
      delay: GRAVITY_INTERVAL,
      callback: this.applyGravity,
      callbackScope: this,
      loop: true,
    });

    // 初回スクラップ
    this.spawnScrap();

    // 入力設定
    this.setupInput();

    // 開始時ヒント
    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "弾を当てて四角形を作ろう！", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffee88",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(1);

    this.tweens.add({
      targets: hint,
      alpha: 0,
      delay: 2000,
      duration: 1000,
      onComplete: () => hint.destroy(),
    });
  }

  private drawGridLines(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, COLORS.gridLine, 0.3);
    for (let c = 0; c <= GRID_COLS; c++) {
      graphics.lineBetween(c * CELL_SIZE, 0, c * CELL_SIZE, GRID_ROWS * CELL_SIZE);
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      graphics.lineBetween(0, r * CELL_SIZE, GRID_COLS * CELL_SIZE, r * CELL_SIZE);
    }
  }

  private setupInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.gameOver) return;
      this.touchStartX = pointer.x;
      this.isSwiping = false;
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.gameOver || !pointer.isDown) return;
      const dx = pointer.x - this.touchStartX;
      if (Math.abs(dx) > this.swipeThreshold) {
        this.isSwiping = true;
        this.cannon.x = Phaser.Math.Clamp(
          this.cannon.x + dx,
          CANNON_WIDTH / 2,
          GAME_WIDTH - CANNON_WIDTH / 2
        );
        this.touchStartX = pointer.x;
      }
    });

    this.input.on("pointerup", () => {
      if (this.gameOver) return;
      if (!this.isSwiping) {
        this.shoot();
      }
    });
  }

  private shoot(): void {
    const bullet = this.add.circle(
      this.cannon.x,
      CANNON_Y - CANNON_HEIGHT / 2,
      BULLET_RADIUS,
      COLORS.bullet
    );
    this.bullets.push(bullet);
  }

  private spawnScrap(): void {
    if (this.gameOver) return;

    // ランダムな列にスクラップを配置
    const col = Phaser.Math.Between(0, GRID_COLS - 1);
    const width = Phaser.Math.Between(1, 3); // 1〜3セル幅
    const startCol = Phaser.Math.Clamp(col, 0, GRID_COLS - width);

    for (let c = startCol; c < startCol + width; c++) {
      if (!this.gridState[0][c]) {
        this.placeBlock(0, c);
      }
    }
  }

  private placeBlock(row: number, col: number): void {
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return;
    if (this.gridState[row][col]) return;

    this.gridState[row][col] = true;
    const rect = this.add.rectangle(
      col * CELL_SIZE + CELL_SIZE / 2,
      row * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE - 2,
      CELL_SIZE - 2,
      COLORS.scrap
    );
    rect.setStrokeStyle(1, 0x444466);
    this.grid[row][col] = rect;
  }

  private removeBlock(row: number, col: number): void {
    const block = this.grid[row][col];
    if (block) {
      block.destroy();
      this.grid[row][col] = null;
    }
    this.gridState[row][col] = false;
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    this.updateBullets(delta);
    this.checkGameOver();
  }

  private updateBullets(delta: number): void {
    const dt = delta / 1000;
    const toRemove: number[] = [];

    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];
      bullet.y -= BULLET_SPEED * dt;

      // 画面外
      if (bullet.y < 0) {
        toRemove.push(i);
        continue;
      }

      // グリッドとの衝突判定
      const col = Math.floor(bullet.x / CELL_SIZE);
      const row = Math.floor(bullet.y / CELL_SIZE);

      if (
        row >= 0 &&
        row < GRID_ROWS &&
        col >= 0 &&
        col < GRID_COLS &&
        this.gridState[row][col]
      ) {
        // 弾が当たったブロックの左右に拡張
        this.expandScrap(row, col);
        toRemove.push(i);
      }
    }

    // 弾の削除（逆順）
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.bullets[toRemove[i]].destroy();
      this.bullets.splice(toRemove[i], 1);
    }
  }

  private expandScrap(row: number, col: number): void {
    // 左右に1セルずつ拡張
    if (col > 0 && !this.gridState[row][col - 1]) {
      this.placeBlock(row, col - 1);
    }
    if (col < GRID_COLS - 1 && !this.gridState[row][col + 1]) {
      this.placeBlock(row, col + 1);
    }

    // 矩形チェック
    this.checkAndClearRectangles();
  }

  private checkAndClearRectangles(): void {
    // 全行・列を走査して矩形（2x2以上の塗りつぶし矩形）を探す
    let found = false;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (!this.gridState[r][c]) continue;

        // この位置を左上とする最大矩形を探す
        const rect = this.findLargestRect(r, c);
        if (rect && rect.area >= 4) {
          // 最低2x2
          this.clearRect(rect.r, rect.c, rect.w, rect.h);
          this.addScore(rect.area);
          found = true;
        }
      }
    }

    if (found) {
      this.chain++;
      // 連鎖チェック（次フレームで再チェック）
      this.time.delayedCall(200, () => this.checkAndClearRectangles());
    } else {
      this.chain = 0;
    }
  }

  private findLargestRect(
    startRow: number,
    startCol: number
  ): { r: number; c: number; w: number; h: number; area: number } | null {
    let best: { r: number; c: number; w: number; h: number; area: number } | null = null;

    let maxWidth = GRID_COLS - startCol;

    for (let h = 1; startRow + h <= GRID_ROWS; h++) {
      // この行で連続するブロックの幅を制限
      let width = 0;
      for (let c = startCol; c < startCol + maxWidth; c++) {
        if (this.gridState[startRow + h - 1][c]) {
          width++;
        } else {
          break;
        }
      }
      maxWidth = Math.min(maxWidth, width);
      if (maxWidth === 0) break;

      const area = maxWidth * h;
      if (area >= 4 && (!best || area > best.area)) {
        best = { r: startRow, c: startCol, w: maxWidth, h, area };
      }
    }

    return best;
  }

  private clearRect(r: number, c: number, w: number, h: number): void {
    // 矩形全体を囲むフラッシュ枠
    const rectX = c * CELL_SIZE;
    const rectY = r * CELL_SIZE;
    const rectW = w * CELL_SIZE;
    const rectH = h * CELL_SIZE;

    const flash = this.add.rectangle(
      rectX + rectW / 2,
      rectY + rectH / 2,
      rectW,
      rectH,
      0xffff66,
      0.5
    );
    flash.setStrokeStyle(3, 0xffcc00);

    // 「出荷！」テキスト演出
    const label = this.add
      .text(rectX + rectW / 2, rectY + rectH / 2, "出荷！", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffee00",
        stroke: "#442200",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // フラッシュ → フェードアウト
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy(),
    });

    this.tweens.add({
      targets: label,
      y: label.y - 30,
      alpha: 0,
      duration: 600,
      onComplete: () => label.destroy(),
    });

    // ブロック削除
    for (let row = r; row < r + h; row++) {
      for (let col = c; col < c + w; col++) {
        this.removeBlock(row, col);
      }
    }
  }

  private addScore(area: number): void {
    const multiplier = this.chain > 0 ? Math.pow(CHAIN_MULTIPLIER, this.chain) : 1;
    this.score += Math.floor(area * BASE_SCORE * multiplier);
    this.scoreText.setText(`SCORE: ${this.score}`);
  }

  private applyGravity(): void {
    if (this.gameOver) return;
    // 下の行から上に向かって処理（重力）
    for (let r = GRID_ROWS - 2; r >= 0; r--) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.gridState[r][c] && !this.gridState[r + 1][c]) {
          // 1セル落下
          const block = this.grid[r][c];
          this.gridState[r][c] = false;
          this.grid[r][c] = null;

          this.gridState[r + 1][c] = true;
          this.grid[r + 1][c] = block;

          if (block) {
            block.y = (r + 1) * CELL_SIZE + CELL_SIZE / 2;
          }
        }
      }
    }
  }

  private checkGameOver(): void {
    // 最下行にブロックがあればゲームオーバー
    const bottomRow = GRID_ROWS - 1;
    for (let c = 0; c < GRID_COLS; c++) {
      if (this.gridState[bottomRow][c]) {
        this.gameOver = true;
        this.spawnTimer.remove();
        this.gravityTimer.remove();
        this.showGameOver();
        return;
      }
    }
  }

  private showGameOver(): void {
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.7
    );

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, "GAME OVER", {
      fontFamily: "monospace",
      fontSize: "36px",
      color: "#ff4444",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `SCORE: ${this.score}`, {
      fontFamily: "monospace",
      fontSize: "24px",
      color: COLORS.text,
    }).setOrigin(0.5);

    const restartText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 60,
      "TAP TO RESTART",
      {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#88aaff",
      }
    ).setOrigin(0.5);

    // 点滅
    this.tweens.add({
      targets: restartText,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.input.once("pointerup", () => {
      this.scene.restart();
    });
  }
}
