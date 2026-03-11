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
  SCRAP_SPAWN_INTERVAL,
  GRAVITY_INTERVAL,
  MIN_RECT_AREA,
  BASE_SCORE,
  CHAIN_MULTIPLIER,
  TETROMINOS,
  COLORS,
} from "../constants";

/** 射出中の弾ブロック */
interface FlyingBlock {
  sprite: Phaser.GameObjects.Rectangle;
  col: number; // 射出した列（固定）
}

export class GameScene extends Phaser.Scene {
  private cannon!: Phaser.GameObjects.Rectangle;
  private cannonPreview!: Phaser.GameObjects.Rectangle;
  private flyingBlocks: FlyingBlock[] = [];
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
    this.flyingBlocks = [];

    // グリッド初期化
    this.gridState = Array.from({ length: GRID_ROWS }, () =>
      Array(GRID_COLS).fill(false)
    );
    this.grid = Array.from({ length: GRID_ROWS }, () =>
      Array(GRID_COLS).fill(null)
    );

    this.drawGridLines();

    // 砲台
    this.cannon = this.add.rectangle(
      GAME_WIDTH / 2,
      CANNON_Y,
      CANNON_WIDTH,
      CANNON_HEIGHT,
      COLORS.cannon
    );
    this.cannon.setStrokeStyle(2, 0x997733);

    // 砲台上のプレビュー（次に射出されるブロック）
    this.cannonPreview = this.add.rectangle(
      this.cannon.x,
      CANNON_Y - CANNON_HEIGHT / 2 - CELL_SIZE / 2,
      CELL_SIZE - 2,
      CELL_SIZE - 2,
      COLORS.bullet
    );
    this.cannonPreview.setAlpha(0.6);

    // スコア表示
    this.scoreText = this.add.text(10, 10, "SCORE: 0", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: COLORS.text,
    });

    // タイマー
    this.spawnTimer = this.time.addEvent({
      delay: SCRAP_SPAWN_INTERVAL,
      callback: this.spawnTetromino,
      callbackScope: this,
      loop: true,
    });
    this.gravityTimer = this.time.addEvent({
      delay: GRAVITY_INTERVAL,
      callback: this.applyGravity,
      callbackScope: this,
      loop: true,
    });

    // 初回テトロミノ
    this.spawnTetromino();

    this.setupInput();

    // 開始時ヒント
    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "ブロックを撃って\n四角形を完成させよう！", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffee88",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: hint,
      alpha: 0,
      delay: 2500,
      duration: 800,
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
    // 砲台エリアの区切り線
    graphics.lineStyle(2, 0x555577, 0.5);
    graphics.lineBetween(0, GRID_ROWS * CELL_SIZE, GAME_WIDTH, GRID_ROWS * CELL_SIZE);
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
        // セル単位でスナップ移動
        this.cannon.x = Phaser.Math.Clamp(
          this.cannon.x + dx,
          CELL_SIZE / 2,
          GRID_COLS * CELL_SIZE - CELL_SIZE / 2
        );
        this.cannonPreview.x = this.cannon.x;
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
    // 砲台の位置から列を決定
    const col = Math.floor(this.cannon.x / CELL_SIZE);
    const clampedCol = Phaser.Math.Clamp(col, 0, GRID_COLS - 1);
    const x = clampedCol * CELL_SIZE + CELL_SIZE / 2;

    const sprite = this.add.rectangle(
      x,
      CANNON_Y - CANNON_HEIGHT / 2 - CELL_SIZE / 2,
      CELL_SIZE - 2,
      CELL_SIZE - 2,
      COLORS.bullet
    );
    sprite.setStrokeStyle(1, 0xaa6622);

    this.flyingBlocks.push({ sprite, col: clampedCol });
  }

  private spawnTetromino(): void {
    if (this.gameOver) return;

    const tetro = Phaser.Math.RND.pick(TETROMINOS);
    const startCol = Phaser.Math.Between(0, GRID_COLS - 3);

    for (const [dr, dc] of tetro.cells) {
      const r = dr;
      const c = startCol + dc;
      if (c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS) {
        if (!this.gridState[r][c]) {
          this.placeBlock(r, c);
        }
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
    rect.setStrokeStyle(1, 0x445566);
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
    this.updateFlyingBlocks(delta);
    this.checkGameOver();
  }

  private updateFlyingBlocks(delta: number): void {
    const dt = delta / 1000;
    const toRemove: number[] = [];

    for (let i = 0; i < this.flyingBlocks.length; i++) {
      const fb = this.flyingBlocks[i];
      fb.sprite.y -= BULLET_SPEED * dt;

      // この弾ブロックが着地する行を判定
      const row = Math.floor(fb.sprite.y / CELL_SIZE);

      // 画面外に出た → 最上行に配置
      if (fb.sprite.y < 0) {
        this.landBlock(0, fb.col);
        fb.sprite.destroy();
        toRemove.push(i);
        continue;
      }

      // グリッド内のブロックに衝突 → その1つ下の行に配置
      if (
        row >= 0 &&
        row < GRID_ROWS &&
        this.gridState[row][fb.col]
      ) {
        const landRow = row + 1;
        if (landRow < GRID_ROWS && !this.gridState[landRow][fb.col]) {
          this.landBlock(landRow, fb.col);
        }
        // 配置できなくても弾は消える
        fb.sprite.destroy();
        toRemove.push(i);
        continue;
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.flyingBlocks.splice(toRemove[i], 1);
    }
  }

  /** 弾ブロックがグリッドに着地 */
  private landBlock(row: number, col: number): void {
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return;
    if (this.gridState[row][col]) return;

    this.placeBlock(row, col);

    // 着地エフェクト（軽い光）
    const flash = this.add.rectangle(
      col * CELL_SIZE + CELL_SIZE / 2,
      row * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE,
      CELL_SIZE,
      0xffffff,
      0.4
    );
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy(),
    });

    // 矩形チェック
    this.checkAndClearRectangles();
  }

  private checkAndClearRectangles(): void {
    let found = false;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (!this.gridState[r][c]) continue;

        const rect = this.findLargestRect(r, c);
        if (rect && rect.area >= MIN_RECT_AREA) {
          this.clearRect(rect.r, rect.c, rect.w, rect.h);
          this.addScore(rect.area);
          found = true;
        }
      }
    }

    if (found) {
      this.chain++;
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
      if (area >= MIN_RECT_AREA && (!best || area > best.area)) {
        best = { r: startRow, c: startCol, w: maxWidth, h, area };
      }
    }

    return best;
  }

  private clearRect(r: number, c: number, w: number, h: number): void {
    const rectX = c * CELL_SIZE;
    const rectY = r * CELL_SIZE;
    const rectW = w * CELL_SIZE;
    const rectH = h * CELL_SIZE;

    // フラッシュ枠
    const flash = this.add.rectangle(
      rectX + rectW / 2,
      rectY + rectH / 2,
      rectW,
      rectH,
      COLORS.shipFlash,
      0.5
    );
    flash.setStrokeStyle(3, COLORS.shipStroke);

    // 「出荷！」テキスト
    const label = this.add
      .text(rectX + rectW / 2, rectY + rectH / 2, "出荷！", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffee00",
        stroke: "#442200",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

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

    for (let row = r; row < r + h; row++) {
      for (let col = c; col < c + w; col++) {
        this.removeBlock(row, col);
      }
    }
  }

  private addScore(area: number): void {
    const multiplier = this.chain > 0 ? Math.pow(CHAIN_MULTIPLIER, this.chain) : 1;
    // 面積の2乗に比例 → 大きい矩形ほど圧倒的に高スコア
    // 2x2=4 → 1600, 3x3=9 → 8100, 4x4=16 → 25600
    const points = Math.floor(area * area * BASE_SCORE * multiplier);
    this.score += points;
    this.scoreText.setText(`SCORE: ${this.score}`);

    // 獲得スコア表示
    const label = this.add
      .text(GAME_WIDTH / 2, GRID_ROWS * CELL_SIZE - 20, `+${points}`, {
        fontFamily: "monospace",
        fontSize: area >= 9 ? "24px" : "16px",
        color: area >= 9 ? "#ffdd00" : "#aaddff",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: label,
      y: label.y - 40,
      alpha: 0,
      duration: 800,
      onComplete: () => label.destroy(),
    });
  }

  private applyGravity(): void {
    if (this.gameOver) return;
    for (let r = GRID_ROWS - 2; r >= 0; r--) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.gridState[r][c] && !this.gridState[r + 1][c]) {
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
    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.7
    );

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, "GAME OVER", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#ff4444",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `SCORE: ${this.score}`, {
        fontFamily: "monospace",
        fontSize: "24px",
        color: COLORS.text,
      })
      .setOrigin(0.5);

    const restartText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, "TAP TO RESTART", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#88aaff",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: restartText,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.input.once("pointerup", () => {
      this.scene.start("TitleScene");
    });
  }
}
