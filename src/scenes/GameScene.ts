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
  BASE_SCORE,
  CHAIN_MULTIPLIER,
  SCRAP_SHAPES,
  COLORS,
} from "../constants";

interface ScrapGroup {
  id: number;
  r: number; // bounding box top row
  c: number; // bounding box left col
  w: number;
  h: number;
}

interface FlyingBlock {
  sprite: Phaser.GameObjects.Rectangle;
  col: number;
}

export class GameScene extends Phaser.Scene {
  private cannon!: Phaser.GameObjects.Rectangle;
  private flyingBlocks: FlyingBlock[] = [];

  // グリッド: 0=空, 正の数=グループID
  private gridState: number[][] = [];
  private grid: (Phaser.GameObjects.Rectangle | null)[][] = [];
  private groups: Map<number, ScrapGroup> = new Map();
  private nextGroupId = 1;

  private score = 0;
  private chain = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private spawnTimer!: Phaser.Time.TimerEvent;
  private gravityTimer!: Phaser.Time.TimerEvent;
  private gameOver = false;

  // 描画用
  private outlineGraphics!: Phaser.GameObjects.Graphics;
  private aimLineGraphics!: Phaser.GameObjects.Graphics;

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
    this.groups.clear();
    this.nextGroupId = 1;

    this.gridState = Array.from({ length: GRID_ROWS }, () =>
      Array(GRID_COLS).fill(0)
    );
    this.grid = Array.from({ length: GRID_ROWS }, () =>
      Array(GRID_COLS).fill(null)
    );

    this.drawGridLines();

    // グループ枠描画用
    this.outlineGraphics = this.add.graphics();
    // 射線描画用
    this.aimLineGraphics = this.add.graphics();

    // 砲台
    this.cannon = this.add.rectangle(
      GAME_WIDTH / 2,
      CANNON_Y,
      CANNON_WIDTH,
      CANNON_HEIGHT,
      COLORS.cannon
    );
    this.cannon.setStrokeStyle(2, 0x997733);
    this.cannon.setDepth(10);

    // スコア表示
    this.scoreText = this.add.text(10, 10, "SCORE: 0", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: COLORS.text,
    });
    this.scoreText.setDepth(10);

    // タイマー
    this.spawnTimer = this.time.addEvent({
      delay: SCRAP_SPAWN_INTERVAL,
      callback: this.spawnGroup,
      callbackScope: this,
      loop: true,
    });
    this.gravityTimer = this.time.addEvent({
      delay: GRAVITY_INTERVAL,
      callback: this.applyGravity,
      callbackScope: this,
      loop: true,
    });

    this.spawnGroup();
    this.setupInput();

    // 開始時ヒント
    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "穴にブロックを撃ち込んで\n四角形を完成させよう！", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffee88",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(20);

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
        this.cannon.x = Phaser.Math.Clamp(
          this.cannon.x + dx,
          CELL_SIZE / 2,
          GRID_COLS * CELL_SIZE - CELL_SIZE / 2
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
    sprite.setDepth(5);

    this.flyingBlocks.push({ sprite, col: clampedCol });
  }

  // --- グループ生成 ---

  private spawnGroup(): void {
    if (this.gameOver) return;

    const shape = Phaser.Math.RND.pick(SCRAP_SHAPES);
    const startCol = Phaser.Math.Between(0, GRID_COLS - shape.w);
    const startRow = 0;

    // 配置可能チェック
    for (const [dr, dc] of shape.filled) {
      if (this.gridState[startRow + dr][startCol + dc] !== 0) {
        return; // 配置不可
      }
    }

    const groupId = this.nextGroupId++;
    const group: ScrapGroup = {
      id: groupId,
      r: startRow,
      c: startCol,
      w: shape.w,
      h: shape.h,
    };
    this.groups.set(groupId, group);

    for (const [dr, dc] of shape.filled) {
      const r = startRow + dr;
      const c = startCol + dc;
      this.gridState[r][c] = groupId;

      const rect = this.add.rectangle(
        c * CELL_SIZE + CELL_SIZE / 2,
        r * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE - 2,
        CELL_SIZE - 2,
        COLORS.scrap
      );
      rect.setStrokeStyle(1, 0x445566);
      this.grid[r][c] = rect;
    }

    this.redrawOutlines();
  }

  // --- 穴判定 ---

  /** 指定セルがグループの穴（未充填部分）かを返す */
  private getHoleGroupId(row: number, col: number): number | null {
    if (this.gridState[row][col] !== 0) return null;

    for (const group of this.groups.values()) {
      if (
        row >= group.r && row < group.r + group.h &&
        col >= group.c && col < group.c + group.w
      ) {
        return group.id;
      }
    }
    return null;
  }

  /** グループの全セルが埋まっているか */
  private isGroupComplete(group: ScrapGroup): boolean {
    for (let r = group.r; r < group.r + group.h; r++) {
      for (let c = group.c; c < group.c + group.w; c++) {
        if (this.gridState[r][c] !== group.id) return false;
      }
    }
    return true;
  }

  // --- 弾更新 ---

  update(_time: number, delta: number): void {
    if (this.gameOver) return;
    this.updateFlyingBlocks(delta);
    this.drawAimLine();
    this.checkGameOver();
  }

  private updateFlyingBlocks(delta: number): void {
    const dt = delta / 1000;
    const toRemove: number[] = [];

    for (let i = 0; i < this.flyingBlocks.length; i++) {
      const fb = this.flyingBlocks[i];
      fb.sprite.y -= BULLET_SPEED * dt;

      // 画面外
      if (fb.sprite.y < 0) {
        fb.sprite.destroy();
        toRemove.push(i);
        continue;
      }

      const row = Math.floor(fb.sprite.y / CELL_SIZE);
      if (row < 0 || row >= GRID_ROWS) continue;

      const col = fb.col;

      // 穴に入った → 充填
      const holeGroupId = this.getHoleGroupId(row, col);
      if (holeGroupId !== null) {
        this.fillHole(row, col, holeGroupId);
        fb.sprite.destroy();
        toRemove.push(i);
        continue;
      }

      // 既存ブロックに衝突 → 消える（ミスショット）
      if (this.gridState[row][col] !== 0) {
        fb.sprite.destroy();
        toRemove.push(i);
        continue;
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.flyingBlocks.splice(toRemove[i], 1);
    }
  }

  /** 穴を埋める */
  private fillHole(row: number, col: number, groupId: number): void {
    this.gridState[row][col] = groupId;

    const rect = this.add.rectangle(
      col * CELL_SIZE + CELL_SIZE / 2,
      row * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE - 2,
      CELL_SIZE - 2,
      COLORS.bullet
    );
    rect.setStrokeStyle(1, 0xaa6622);
    this.grid[row][col] = rect;

    // 着弾フラッシュ
    const flash = this.add.rectangle(
      col * CELL_SIZE + CELL_SIZE / 2,
      row * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE,
      CELL_SIZE,
      0xffffff,
      0.5
    );
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy(),
    });

    // グループ完成チェック
    const group = this.groups.get(groupId);
    if (group && this.isGroupComplete(group)) {
      this.shipGroup(group);
    }

    this.redrawOutlines();
  }

  /** グループ出荷 */
  private shipGroup(group: ScrapGroup): void {
    const area = group.w * group.h;

    // フラッシュ枠
    const rectX = group.c * CELL_SIZE;
    const rectY = group.r * CELL_SIZE;
    const rectW = group.w * CELL_SIZE;
    const rectH = group.h * CELL_SIZE;

    const flash = this.add.rectangle(
      rectX + rectW / 2,
      rectY + rectH / 2,
      rectW,
      rectH,
      COLORS.shipFlash,
      0.6
    );
    flash.setStrokeStyle(3, COLORS.shipStroke);
    flash.setDepth(15);

    const label = this.add
      .text(rectX + rectW / 2, rectY + rectH / 2, "出荷！", {
        fontFamily: "monospace",
        fontSize: area >= 9 ? "24px" : "18px",
        color: "#ffee00",
        stroke: "#442200",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(16);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 500,
      onComplete: () => flash.destroy(),
    });
    this.tweens.add({
      targets: label,
      y: label.y - 30,
      alpha: 0,
      duration: 700,
      onComplete: () => label.destroy(),
    });

    // ブロック削除
    for (let r = group.r; r < group.r + group.h; r++) {
      for (let c = group.c; c < group.c + group.w; c++) {
        const block = this.grid[r][c];
        if (block) {
          block.destroy();
          this.grid[r][c] = null;
        }
        this.gridState[r][c] = 0;
      }
    }

    this.groups.delete(group.id);
    this.addScore(area);
    this.redrawOutlines();
  }

  private addScore(area: number): void {
    const multiplier = this.chain > 0 ? Math.pow(CHAIN_MULTIPLIER, this.chain) : 1;
    const points = Math.floor(area * area * BASE_SCORE * multiplier);
    this.score += points;
    this.scoreText.setText(`SCORE: ${this.score}`);

    const label = this.add
      .text(GAME_WIDTH / 2, GRID_ROWS * CELL_SIZE - 20, `+${points}`, {
        fontFamily: "monospace",
        fontSize: area >= 9 ? "24px" : "16px",
        color: area >= 9 ? "#ffdd00" : "#aaddff",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(15);

    this.tweens.add({
      targets: label,
      y: label.y - 40,
      alpha: 0,
      duration: 800,
      onComplete: () => label.destroy(),
    });
  }

  // --- 重力（グループ単位） ---

  private applyGravity(): void {
    if (this.gameOver) return;

    const sortedGroups = [...this.groups.values()].sort((a, b) => b.r - a.r);
    let moved = false;

    for (const group of sortedGroups) {
      if (this.canGroupFall(group)) {
        this.moveGroupDown(group);
        moved = true;
      }
    }

    if (moved) {
      this.redrawOutlines();
    }
  }

  private canGroupFall(group: ScrapGroup): boolean {
    for (let r = group.r; r < group.r + group.h; r++) {
      for (let c = group.c; c < group.c + group.w; c++) {
        if (this.gridState[r][c] === group.id) {
          const belowRow = r + 1;
          if (belowRow >= GRID_ROWS) return false;
          const below = this.gridState[belowRow][c];
          if (below !== 0 && below !== group.id) return false;
        }
      }
    }
    return true;
  }

  private moveGroupDown(group: ScrapGroup): void {
    // 下の行から処理（上書き防止）
    for (let r = group.r + group.h - 1; r >= group.r; r--) {
      for (let c = group.c; c < group.c + group.w; c++) {
        if (this.gridState[r][c] === group.id) {
          this.gridState[r][c] = 0;
          this.gridState[r + 1][c] = group.id;

          const block = this.grid[r][c];
          this.grid[r][c] = null;
          this.grid[r + 1][c] = block;
          if (block) {
            block.y = (r + 1) * CELL_SIZE + CELL_SIZE / 2;
          }
        }
      }
    }
    group.r += 1;
  }

  // --- 描画 ---

  private redrawOutlines(): void {
    this.outlineGraphics.clear();

    for (const group of this.groups.values()) {
      const x = group.c * CELL_SIZE;
      const y = group.r * CELL_SIZE;
      const w = group.w * CELL_SIZE;
      const h = group.h * CELL_SIZE;

      // 枠線
      this.outlineGraphics.lineStyle(2, COLORS.groupOutline, 0.8);
      this.outlineGraphics.strokeRect(x, y, w, h);

      // 穴を表示
      for (let r = group.r; r < group.r + group.h; r++) {
        for (let c = group.c; c < group.c + group.w; c++) {
          if (this.gridState[r][c] === 0) {
            const hx = c * CELL_SIZE + 1;
            const hy = r * CELL_SIZE + 1;
            this.outlineGraphics.fillStyle(COLORS.hole, 0.4);
            this.outlineGraphics.fillRect(hx, hy, CELL_SIZE - 2, CELL_SIZE - 2);
            this.outlineGraphics.lineStyle(1, COLORS.holeStroke, 0.6);
            this.outlineGraphics.strokeRect(hx, hy, CELL_SIZE - 2, CELL_SIZE - 2);
          }
        }
      }
    }
  }

  /** 射線（砲台の列に沿って上方向にガイドライン表示） */
  private drawAimLine(): void {
    this.aimLineGraphics.clear();

    const col = Math.floor(this.cannon.x / CELL_SIZE);
    const clampedCol = Phaser.Math.Clamp(col, 0, GRID_COLS - 1);
    const x = clampedCol * CELL_SIZE + CELL_SIZE / 2;

    // 点線を描画
    this.aimLineGraphics.lineStyle(1, 0xffffff, 0.2);
    const topY = 0;
    const bottomY = GRID_ROWS * CELL_SIZE;
    const dashLen = 6;
    const gapLen = 8;

    for (let y = bottomY; y > topY; y -= dashLen + gapLen) {
      const endY = Math.max(y - dashLen, topY);
      this.aimLineGraphics.lineBetween(x, y, x, endY);
    }

    // 着弾予測位置を表示
    let targetRow = -1;
    for (let r = GRID_ROWS - 1; r >= 0; r--) {
      // 穴チェック
      const holeGroup = this.getHoleGroupId(r, clampedCol);
      if (holeGroup !== null) {
        targetRow = r;
        break;
      }
      // ブロックチェック（この上には着弾不可）
      if (this.gridState[r][clampedCol] !== 0) {
        break;
      }
    }

    if (targetRow >= 0) {
      this.aimLineGraphics.lineStyle(2, 0x88ffaa, 0.5);
      this.aimLineGraphics.strokeRect(
        clampedCol * CELL_SIZE + 2,
        targetRow * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4
      );
    }
  }

  // --- ゲームオーバー ---

  private checkGameOver(): void {
    const bottomRow = GRID_ROWS - 1;
    for (let c = 0; c < GRID_COLS; c++) {
      if (this.gridState[bottomRow][c] !== 0) {
        this.gameOver = true;
        this.spawnTimer.remove();
        this.gravityTimer.remove();
        this.showGameOver();
        return;
      }
    }
  }

  private showGameOver(): void {
    this.aimLineGraphics.clear();

    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.7
    ).setDepth(20);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, "GAME OVER", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#ff4444",
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `SCORE: ${this.score}`, {
        fontFamily: "monospace",
        fontSize: "24px",
        color: COLORS.text,
      })
      .setOrigin(0.5)
      .setDepth(21);

    const restartText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, "TAP TO RESTART", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#88aaff",
      })
      .setOrigin(0.5)
      .setDepth(21);

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
