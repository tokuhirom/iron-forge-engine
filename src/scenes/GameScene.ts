import Phaser from "phaser";
import { playShoot, playLand, playShip, playGameOver } from "../audio";
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
  SCRAP_SHAPES,
  COLORS,
} from "../constants";

interface ScrapGroup {
  id: number;
  r: number;
  c: number;
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
  private difficultyTimer!: Phaser.Time.TimerEvent;
  private gameOver = false;
  private elapsedSec = 0;
  private currentSpawnInterval = SCRAP_SPAWN_INTERVAL;
  private currentGravityInterval = GRAVITY_INTERVAL;

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

    this.outlineGraphics = this.add.graphics();
    this.aimLineGraphics = this.add.graphics();

    this.cannon = this.add.rectangle(
      GAME_WIDTH / 2, CANNON_Y, CANNON_WIDTH, CANNON_HEIGHT, COLORS.cannon
    );
    this.cannon.setStrokeStyle(2, 0x997733);
    this.cannon.setDepth(10);

    this.scoreText = this.add.text(10, 10, "SCORE: 0", {
      fontFamily: "monospace", fontSize: "18px", color: COLORS.text,
    });
    this.scoreText.setDepth(10);

    this.spawnTimer = this.time.addEvent({
      delay: SCRAP_SPAWN_INTERVAL, callback: this.spawnGroup,
      callbackScope: this, loop: true,
    });
    this.gravityTimer = this.time.addEvent({
      delay: GRAVITY_INTERVAL, callback: this.applyGravity,
      callbackScope: this, loop: true,
    });

    this.elapsedSec = 0;
    this.currentSpawnInterval = SCRAP_SPAWN_INTERVAL;
    this.currentGravityInterval = GRAVITY_INTERVAL;
    this.difficultyTimer = this.time.addEvent({
      delay: 10000, callback: this.increaseDifficulty,
      callbackScope: this, loop: true,
    });

    this.spawnGroup();
    this.setupInput();

    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40,
        "穴を埋めて四角形を完成！\n枠の外に積んで大きくもできる", {
        fontFamily: "monospace", fontSize: "15px", color: "#ffee88",
        stroke: "#000000", strokeThickness: 3, align: "center",
      })
      .setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets: hint, alpha: 0, delay: 3000, duration: 800,
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
          CELL_SIZE / 2, GRID_COLS * CELL_SIZE - CELL_SIZE / 2
        );
        this.touchStartX = pointer.x;
      }
    });

    this.input.on("pointerup", () => {
      if (this.gameOver) return;
      if (!this.isSwiping) this.shoot();
    });
  }

  private shoot(): void {
    const col = Math.floor(this.cannon.x / CELL_SIZE);
    const clampedCol = Phaser.Math.Clamp(col, 0, GRID_COLS - 1);
    const x = clampedCol * CELL_SIZE + CELL_SIZE / 2;

    const sprite = this.add.rectangle(
      x, CANNON_Y - CANNON_HEIGHT / 2 - CELL_SIZE / 2,
      CELL_SIZE - 2, CELL_SIZE - 2, COLORS.bullet
    );
    sprite.setStrokeStyle(1, 0xaa6622);
    sprite.setDepth(5);
    this.flyingBlocks.push({ sprite, col: clampedCol });
    playShoot();
  }

  // --- グループ生成 ---

  private spawnGroup(): void {
    if (this.gameOver) return;

    // 経過時間に応じて複合スポーンの確率が上がる（30秒後から）
    const elapsed = this.time.now / 1000;
    const compoundChance = Math.min(0.4, Math.max(0, (elapsed - 30) * 0.005));
    if (Math.random() < compoundChance) {
      this.spawnCompoundGroup();
      return;
    }

    this.spawnSingleGroup(0);
  }

  /** 単体グループを指定行にスポーン */
  private spawnSingleGroup(startRow: number, forceCol?: number): ScrapGroup | null {
    const shape = Phaser.Math.RND.pick(SCRAP_SHAPES);
    const maxW = Math.max(shape.w, 1);
    if (forceCol !== undefined && forceCol + maxW > GRID_COLS) return null;
    const startCol = forceCol ?? Phaser.Math.Between(0, GRID_COLS - shape.w);

    if (startRow + shape.h > GRID_ROWS) return null;

    for (const [dr, dc] of shape.filled) {
      const r = startRow + dr;
      const c = startCol + dc;
      if (r >= GRID_ROWS || c >= GRID_COLS || this.gridState[r][c] !== 0) return null;
    }

    const groupId = this.nextGroupId++;
    const group: ScrapGroup = {
      id: groupId, r: startRow, c: startCol, w: shape.w, h: shape.h,
    };
    this.groups.set(groupId, group);

    for (const [dr, dc] of shape.filled) {
      const r = startRow + dr;
      const c = startCol + dc;
      this.gridState[r][c] = groupId;
      const rect = this.add.rectangle(
        c * CELL_SIZE + CELL_SIZE / 2, r * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE - 2, CELL_SIZE - 2, COLORS.scrap
      );
      rect.setStrokeStyle(1, 0x445566);
      this.grid[r][c] = rect;
    }
    this.redrawOutlines();
    return group;
  }

  /** 複合スポーン: 2つのグループを縦に重ねて配置 */
  private spawnCompoundGroup(): void {
    const shape1 = Phaser.Math.RND.pick(SCRAP_SHAPES);
    const shape2 = Phaser.Math.RND.pick(SCRAP_SHAPES);
    const maxW = Math.max(shape1.w, shape2.w);

    if (maxW > GRID_COLS) { this.spawnSingleGroup(0); return; }
    const startCol = Phaser.Math.Between(0, GRID_COLS - maxW);

    // 上のグループ (group2) → row 0
    // 下のグループ (group1) → row shape2.h（直下）
    const row2 = 0;
    const row1 = shape2.h;

    if (row1 + shape1.h > GRID_ROWS) { this.spawnSingleGroup(0); return; }

    // 配置チェック
    for (const [dr, dc] of shape2.filled) {
      const r = row2 + dr, c = startCol + dc;
      if (c >= GRID_COLS || this.gridState[r][c] !== 0) { this.spawnSingleGroup(0); return; }
    }
    for (const [dr, dc] of shape1.filled) {
      const r = row1 + dr, c = startCol + dc;
      if (r >= GRID_ROWS || c >= GRID_COLS || this.gridState[r][c] !== 0) { this.spawnSingleGroup(0); return; }
    }

    // 下のグループ (先に消す必要がある)
    const gid1 = this.nextGroupId++;
    const group1: ScrapGroup = { id: gid1, r: row1, c: startCol, w: shape1.w, h: shape1.h };
    this.groups.set(gid1, group1);
    for (const [dr, dc] of shape1.filled) {
      const r = row1 + dr, c = startCol + dc;
      this.gridState[r][c] = gid1;
      const rect = this.add.rectangle(
        c * CELL_SIZE + CELL_SIZE / 2, r * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE - 2, CELL_SIZE - 2, COLORS.scrap
      );
      rect.setStrokeStyle(1, 0x445566);
      this.grid[r][c] = rect;
    }

    // 上のグループ
    const gid2 = this.nextGroupId++;
    const group2: ScrapGroup = { id: gid2, r: row2, c: startCol, w: shape2.w, h: shape2.h };
    this.groups.set(gid2, group2);
    for (const [dr, dc] of shape2.filled) {
      const r = row2 + dr, c = startCol + dc;
      this.gridState[r][c] = gid2;
      const rect = this.add.rectangle(
        c * CELL_SIZE + CELL_SIZE / 2, r * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE - 2, CELL_SIZE - 2, 0x778899 // 少し色を変えて区別
      );
      rect.setStrokeStyle(1, 0x556677);
      this.grid[r][c] = rect;
    }

    this.redrawOutlines();
  }

  // --- グループ操作 ---

  /** 指定セルがグループの穴（バウンディングボックス内の空きセル）かを返す */
  private getHoleGroupId(row: number, col: number): number | null {
    if (this.gridState[row][col] !== 0) return null;
    for (const group of this.groups.values()) {
      if (row >= group.r && row < group.r + group.h &&
          col >= group.c && col < group.c + group.w) {
        return group.id;
      }
    }
    return null;
  }

  /** 指定セルに隣接するグループIDを返す */
  private getAdjacentGroupId(row: number, col: number): number | null {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
        const gid = this.gridState[nr][nc];
        if (gid !== 0) return gid;
      }
    }
    return null;
  }

  /** グループのバウンディングボックスを実際のセルから再計算 */
  private recalcBoundingBox(group: ScrapGroup): void {
    let minR = GRID_ROWS, maxR = 0, minC = GRID_COLS, maxC = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.gridState[r][c] === group.id) {
          minR = Math.min(minR, r);
          maxR = Math.max(maxR, r);
          minC = Math.min(minC, c);
          maxC = Math.max(maxC, c);
        }
      }
    }
    group.r = minR;
    group.c = minC;
    group.w = maxC - minC + 1;
    group.h = maxR - minR + 1;
  }

  /** グループの全セル（バウンディングボックス内）が埋まっているか */
  private isGroupComplete(group: ScrapGroup): boolean {
    if (group.w * group.h < MIN_RECT_AREA) return false;
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

      if (fb.sprite.y < 0) {
        fb.sprite.destroy();
        toRemove.push(i);
        continue;
      }

      const row = Math.floor(fb.sprite.y / CELL_SIZE);
      if (row < 0 || row >= GRID_ROWS) continue;
      const col = fb.col;

      // 既存ブロックに衝突 → 1つ下に着弾
      // （穴はバウンディングボックス内の空セルだが、飛行中は無視する。
      //   非対称拡張時に意図しない位置に着弾するバグを防ぐため）
      if (this.gridState[row][col] !== 0) {
        const landRow = row + 1;
        if (landRow < GRID_ROWS && this.gridState[landRow][col] === 0) {
          // 着弾先がどこかのグループの穴か？
          const landHoleGroup = this.getHoleGroupId(landRow, col);
          if (landHoleGroup !== null) {
            this.landBlockOnGrid(landRow, col, landHoleGroup);
          } else {
            // 隣接グループに合流、またはフリーブロック
            const adjGroup = this.getAdjacentGroupId(landRow, col);
            if (adjGroup !== null) {
              this.landBlockOnGrid(landRow, col, adjGroup);
            } else {
              this.landFreeBlock(landRow, col);
            }
          }
        }
        fb.sprite.destroy();
        toRemove.push(i);
        continue;
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.flyingBlocks.splice(toRemove[i], 1);
    }
  }

  /** ブロックをグリッドに配置してグループに合流 */
  private landBlockOnGrid(row: number, col: number, groupId: number): void {
    this.gridState[row][col] = groupId;

    const rect = this.add.rectangle(
      col * CELL_SIZE + CELL_SIZE / 2, row * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE - 2, CELL_SIZE - 2, COLORS.bullet
    );
    rect.setStrokeStyle(1, 0xaa6622);
    this.grid[row][col] = rect;

    playLand();
    // 着弾フラッシュ
    const flash = this.add.rectangle(
      col * CELL_SIZE + CELL_SIZE / 2, row * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE, CELL_SIZE, 0xffffff, 0.5
    );
    this.tweens.add({
      targets: flash, alpha: 0, duration: 200,
      onComplete: () => flash.destroy(),
    });

    // バウンディングボックス再計算
    const group = this.groups.get(groupId);
    if (group) {
      this.recalcBoundingBox(group);

      // バウンディングボックス内にある他グループのセルや
      // フリーブロックを吸収
      this.absorbInBoundingBox(group);

      if (this.isGroupComplete(group)) {
        this.shipGroup(group);
      }
    }

    this.redrawOutlines();
  }

  /** フリーブロック（どのグループにも属さない） */
  private landFreeBlock(row: number, col: number): void {
    // フリーブロックとして配置（gridState = -1）
    this.gridState[row][col] = -1;

    const rect = this.add.rectangle(
      col * CELL_SIZE + CELL_SIZE / 2, row * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE - 2, CELL_SIZE - 2, COLORS.bullet
    );
    rect.setStrokeStyle(1, 0x886633);
    rect.setAlpha(0.7);
    this.grid[row][col] = rect;
  }

  /** バウンディングボックス内のフリーブロックやバウンディングボックスに
   *  隣接するフリーブロックをグループに吸収 */
  private absorbInBoundingBox(group: ScrapGroup): void {
    for (let r = group.r; r < group.r + group.h; r++) {
      for (let c = group.c; c < group.c + group.w; c++) {
        const val = this.gridState[r][c];
        if (val === -1) {
          // フリーブロックを吸収
          this.gridState[r][c] = group.id;
          const block = this.grid[r][c];
          if (block) {
            block.setFillStyle(COLORS.bullet);
            block.setAlpha(1);
          }
        }
      }
    }
  }

  /** グループ出荷 */
  private shipGroup(group: ScrapGroup): void {
    const area = group.w * group.h;

    const rectX = group.c * CELL_SIZE;
    const rectY = group.r * CELL_SIZE;
    const rectW = group.w * CELL_SIZE;
    const rectH = group.h * CELL_SIZE;

    const flash = this.add.rectangle(
      rectX + rectW / 2, rectY + rectH / 2,
      rectW, rectH, COLORS.shipFlash, 0.6
    );
    flash.setStrokeStyle(3, COLORS.shipStroke);
    flash.setDepth(15);

    playShip(area >= 12);
    const sizeLabel = area >= 20 ? "大出荷！！" : area >= 12 ? "大出荷！" : "出荷！";
    const label = this.add
      .text(rectX + rectW / 2, rectY + rectH / 2, sizeLabel, {
        fontFamily: "monospace",
        fontSize: area >= 20 ? "28px" : area >= 12 ? "22px" : "18px",
        color: "#ffee00",
        stroke: "#442200",
        strokeThickness: 3,
      })
      .setOrigin(0.5).setDepth(16);

    this.tweens.add({
      targets: flash, alpha: 0, duration: 500,
      onComplete: () => flash.destroy(),
    });
    this.tweens.add({
      targets: label, y: label.y - 30, alpha: 0, duration: 700,
      onComplete: () => label.destroy(),
    });

    for (let r = group.r; r < group.r + group.h; r++) {
      for (let c = group.c; c < group.c + group.w; c++) {
        const block = this.grid[r][c];
        if (block) { block.destroy(); this.grid[r][c] = null; }
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
        fontSize: area >= 12 ? "28px" : area >= 9 ? "24px" : "16px",
        color: area >= 12 ? "#ff8800" : area >= 9 ? "#ffdd00" : "#aaddff",
        stroke: "#000000", strokeThickness: 2,
      })
      .setOrigin(0.5).setDepth(15);

    this.tweens.add({
      targets: label, y: label.y - 40, alpha: 0, duration: 800,
      onComplete: () => label.destroy(),
    });
  }

  // --- 重力（グループ単位 + フリーブロック） ---

  private applyGravity(): void {
    if (this.gameOver) return;

    // フリーブロック落下
    this.applyFreeBlockGravity();

    // グループ落下（下のグループから処理）
    const sortedGroups = [...this.groups.values()].sort((a, b) => b.r - a.r);
    let moved = false;

    for (const group of sortedGroups) {
      if (this.canGroupFall(group)) {
        this.moveGroupDown(group);
        moved = true;

        // 落下後にフリーブロックを吸収チェック
        this.absorbAdjacentFreeBlocks(group);

        if (this.isGroupComplete(group)) {
          this.shipGroup(group);
        }
      }
    }

    if (moved) this.redrawOutlines();
  }

  private applyFreeBlockGravity(): void {
    for (let r = GRID_ROWS - 2; r >= 0; r--) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.gridState[r][c] === -1 && this.gridState[r + 1][c] === 0) {
          this.gridState[r + 1][c] = -1;
          this.gridState[r][c] = 0;
          const block = this.grid[r][c];
          this.grid[r][c] = null;
          this.grid[r + 1][c] = block;
          if (block) block.y = (r + 1) * CELL_SIZE + CELL_SIZE / 2;
        }
      }
    }
  }

  /** グループの周囲にあるフリーブロックを吸収 */
  private absorbAdjacentFreeBlocks(group: ScrapGroup): void {
    let absorbed = false;
    // バウンディングボックスの1セル外側もチェック
    const minR = Math.max(0, group.r - 1);
    const maxR = Math.min(GRID_ROWS - 1, group.r + group.h);
    const minC = Math.max(0, group.c - 1);
    const maxC = Math.min(GRID_COLS - 1, group.c + group.w);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (this.gridState[r][c] === -1) {
          // 隣接にグループのセルがあるか
          if (this.isAdjacentToGroup(r, c, group.id)) {
            this.gridState[r][c] = group.id;
            const block = this.grid[r][c];
            if (block) { block.setFillStyle(COLORS.bullet); block.setAlpha(1); }
            absorbed = true;
          }
        }
      }
    }

    if (absorbed) {
      this.recalcBoundingBox(group);
      this.absorbInBoundingBox(group);
    }
  }

  private isAdjacentToGroup(row: number, col: number, groupId: number): boolean {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
        if (this.gridState[nr][nc] === groupId) return true;
      }
    }
    return false;
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
    for (let r = group.r + group.h - 1; r >= group.r; r--) {
      for (let c = group.c; c < group.c + group.w; c++) {
        if (this.gridState[r][c] === group.id) {
          this.gridState[r][c] = 0;
          this.gridState[r + 1][c] = group.id;
          const block = this.grid[r][c];
          this.grid[r][c] = null;
          this.grid[r + 1][c] = block;
          if (block) block.y = (r + 1) * CELL_SIZE + CELL_SIZE / 2;
        }
      }
    }
    group.r += 1;
  }

  // --- 描画 ---

  private redrawOutlines(): void {
    this.outlineGraphics.clear();

    for (const group of this.groups.values()) {
      // 穴を表示
      for (let r = group.r; r < group.r + group.h; r++) {
        for (let c = group.c; c < group.c + group.w; c++) {
          if (this.gridState[r][c] !== group.id) {
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

  /** 射線 + 着弾予測 */
  private drawAimLine(): void {
    this.aimLineGraphics.clear();

    const col = Math.floor(this.cannon.x / CELL_SIZE);
    const clampedCol = Phaser.Math.Clamp(col, 0, GRID_COLS - 1);
    const x = clampedCol * CELL_SIZE + CELL_SIZE / 2;

    // 点線
    this.aimLineGraphics.lineStyle(1, 0xffffff, 0.2);
    const dashLen = 6;
    const gapLen = 8;
    for (let y = GRID_ROWS * CELL_SIZE; y > 0; y -= dashLen + gapLen) {
      this.aimLineGraphics.lineBetween(x, y, x, Math.max(y - dashLen, 0));
    }

    // 着弾予測: 下から上にスキャンして最初に当たるブロックを探す
    let targetRow = -1;
    let targetType: "hole" | "land" | "none" = "none";

    for (let r = GRID_ROWS - 1; r >= 0; r--) {
      if (this.gridState[r][clampedCol] !== 0) {
        // ブロックに当たる → 1つ下に着弾
        if (r + 1 < GRID_ROWS && this.gridState[r + 1][clampedCol] === 0) {
          targetRow = r + 1;
          // 着弾先がグループの穴なら穴表示
          const holeGroup = this.getHoleGroupId(r + 1, clampedCol);
          targetType = holeGroup !== null ? "hole" : "land";
        }
        break;
      }
    }

    if (targetRow >= 0) {
      const color = targetType === "hole" ? 0x88ffaa : 0xffaa44;
      this.aimLineGraphics.lineStyle(2, color, 0.6);
      this.aimLineGraphics.strokeRect(
        clampedCol * CELL_SIZE + 2, targetRow * CELL_SIZE + 2,
        CELL_SIZE - 4, CELL_SIZE - 4
      );
    }
  }

  // --- 難易度上昇 ---

  private increaseDifficulty(): void {
    if (this.gameOver) return;
    this.elapsedSec += 10;

    this.currentSpawnInterval = Math.max(1500, this.currentSpawnInterval * 0.95);
    this.spawnTimer.reset({
      delay: this.currentSpawnInterval, callback: this.spawnGroup,
      callbackScope: this, loop: true,
    });

    this.currentGravityInterval = Math.max(200, this.currentGravityInterval * 0.95);
    this.gravityTimer.reset({
      delay: this.currentGravityInterval, callback: this.applyGravity,
      callbackScope: this, loop: true,
    });
  }

  // --- ゲームオーバー ---

  private checkGameOver(): void {
    const bottomRow = GRID_ROWS - 1;
    for (let c = 0; c < GRID_COLS; c++) {
      if (this.gridState[bottomRow][c] !== 0) {
        this.gameOver = true;
        this.spawnTimer.remove();
        this.gravityTimer.remove();
        this.difficultyTimer.remove();
        this.startGameOverSequence();
        return;
      }
    }
  }

  /** ゲームオーバー演出シーケンス */
  private startGameOverSequence(): void {
    this.aimLineGraphics.clear();

    // ── 1. ヒットストップ: 画面フリーズ + 白フラッシュ ──
    const flash = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0.6
    ).setDepth(30);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 300,
      onComplete: () => flash.destroy(),
    });

    // ── 2. 自機やられエフェクト ──
    // 砲台を赤く点滅させて震わせる
    const cannonX = this.cannon.x;
    this.tweens.add({
      targets: this.cannon,
      x: { value: cannonX + 4, duration: 40, yoyo: true, repeat: 8 },
    });
    this.cannon.setFillStyle(0xff3333);
    this.cannon.setStrokeStyle(2, 0xff0000);

    // 砲台から破片パーティクル
    for (let i = 0; i < 12; i++) {
      const px = this.cannon.x + Phaser.Math.Between(-15, 15);
      const py = CANNON_Y + Phaser.Math.Between(-10, 10);
      const particle = this.add.rectangle(
        px, py,
        Phaser.Math.Between(3, 7), Phaser.Math.Between(3, 7),
        Phaser.Math.RND.pick([0xff4444, 0xff8833, 0xffcc00])
      ).setDepth(25);

      this.tweens.add({
        targets: particle,
        x: px + Phaser.Math.Between(-40, 40),
        y: py + Phaser.Math.Between(-60, 20),
        alpha: 0,
        angle: Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(400, 800),
        ease: "Power2",
        onComplete: () => particle.destroy(),
      });
    }

    // ── 3. ドゥーンドゥーンドゥーン音（0.45秒×3 = 約1.35秒）──
    playGameOver();

    // ── 4. 音が終わった後にハイスコア画面表示 ──
    this.time.delayedCall(1800, () => {
      this.showHighScoreScreen();
    });
  }

  // --- ハイスコア管理 ---

  private static readonly STORAGE_KEY = "iron-forge-high-scores";

  private loadHighScores(): number[] {
    try {
      const data = localStorage.getItem(GameScene.STORAGE_KEY);
      if (data) return JSON.parse(data) as number[];
    } catch { /* ignore */ }
    return [];
  }

  private saveHighScore(score: number): { scores: number[]; rank: number } {
    const scores = this.loadHighScores();
    scores.push(score);
    scores.sort((a, b) => b - a);
    const rank = scores.indexOf(score);
    const top5 = scores.slice(0, 5);
    try {
      localStorage.setItem(GameScene.STORAGE_KEY, JSON.stringify(top5));
    } catch { /* ignore */ }
    return { scores: top5, rank };
  }

  /** ハイスコア画面表示 */
  private showHighScoreScreen(): void {
    const { scores, rank } = this.saveHighScore(this.score);

    // 暗転
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0
    ).setDepth(40);
    this.tweens.add({ targets: overlay, alpha: 0.75, duration: 400 });

    // パネル背景
    const panelY = GAME_HEIGHT / 2;
    const panelH = 320;
    const panel = this.add.rectangle(
      GAME_WIDTH / 2, panelY, GAME_WIDTH - 40, panelH,
      0x1a1a3e, 0.95
    ).setDepth(41).setStrokeStyle(2, 0x4466aa);
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, duration: 400, delay: 100 });

    const elements: Phaser.GameObjects.GameObject[] = [overlay, panel];

    // GAME OVER タイトル
    const title = this.add.text(GAME_WIDTH / 2, panelY - panelH / 2 + 30, "GAME OVER", {
      fontFamily: "monospace", fontSize: "28px", color: "#ff4444",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(42).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 300, delay: 200 });
    elements.push(title);

    // 今回のスコア
    const scoreLabel = this.add.text(
      GAME_WIDTH / 2, panelY - panelH / 2 + 65,
      `YOUR SCORE: ${this.score}`, {
        fontFamily: "monospace", fontSize: "18px", color: "#ffdd44",
        stroke: "#000000", strokeThickness: 2,
      }
    ).setOrigin(0.5).setDepth(42).setAlpha(0);
    this.tweens.add({ targets: scoreLabel, alpha: 1, duration: 300, delay: 300 });
    elements.push(scoreLabel);

    // ハイスコアリスト
    const listStartY = panelY - panelH / 2 + 105;
    const rankLabels = ["1st", "2nd", "3rd", "4th", "5th"];

    for (let i = 0; i < 5; i++) {
      const y = listStartY + i * 30;
      const isCurrentScore = i === rank;
      const scoreVal = scores[i];
      const displayText = scoreVal !== undefined
        ? `${rankLabels[i]}  ${String(scoreVal).padStart(8, " ")}`
        : `${rankLabels[i]}  --------`;

      const color = isCurrentScore ? "#ffcc00" : "#aabbcc";
      const fontSize = isCurrentScore ? "18px" : "16px";

      const entry = this.add.text(GAME_WIDTH / 2, y, displayText, {
        fontFamily: "monospace", fontSize, color,
        stroke: "#000000", strokeThickness: isCurrentScore ? 3 : 1,
      }).setOrigin(0.5).setDepth(42).setAlpha(0);

      this.tweens.add({
        targets: entry, alpha: 1, duration: 250, delay: 400 + i * 80,
      });

      // 今回のスコアは点滅させてハイライト
      if (isCurrentScore) {
        this.tweens.add({
          targets: entry, alpha: 0.4, duration: 500,
          yoyo: true, repeat: -1, delay: 900,
        });
      }
      elements.push(entry);
    }

    // NEW RECORD 表示
    if (rank === 0 && scores.length > 1) {
      const newRecord = this.add.text(
        GAME_WIDTH / 2, panelY - panelH / 2 + 85, "NEW RECORD!", {
          fontFamily: "monospace", fontSize: "14px", color: "#ff8800",
        }
      ).setOrigin(0.5).setDepth(42).setAlpha(0);
      this.tweens.add({
        targets: newRecord, alpha: 1, duration: 300, delay: 500,
      });
      this.tweens.add({
        targets: newRecord, scaleX: 1.1, scaleY: 1.1,
        duration: 400, yoyo: true, repeat: -1, delay: 800,
      });
      elements.push(newRecord);
    }

    // リスタートボタン
    const restartText = this.add.text(
      GAME_WIDTH / 2, panelY + panelH / 2 - 30, "TAP TO RETRY", {
        fontFamily: "monospace", fontSize: "20px", color: "#88aaff",
      }
    ).setOrigin(0.5).setDepth(42).setAlpha(0);
    this.tweens.add({
      targets: restartText, alpha: 1, duration: 300, delay: 900,
    });
    this.tweens.add({
      targets: restartText, alpha: 0.3, duration: 600,
      yoyo: true, repeat: -1, delay: 1200,
    });
    elements.push(restartText);

    // タップで即リスタート（タイトルに戻らない）
    this.time.delayedCall(1000, () => {
      this.input.once("pointerup", () => {
        // 全UI要素を破棄
        for (const el of elements) {
          if (el && "destroy" in el) el.destroy();
        }
        this.scene.restart();
      });
    });
  }
}
