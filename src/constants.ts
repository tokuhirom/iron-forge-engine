// ゲーム画面サイズ（縦画面）
export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 700;

// グリッド設定
export const GRID_COLS = 20;
export const CELL_SIZE = Math.floor(GAME_WIDTH / GRID_COLS); // 19px
export const CANNON_AREA_HEIGHT = 70;
export const GRID_ROWS = Math.floor((GAME_HEIGHT - CANNON_AREA_HEIGHT) / CELL_SIZE);

// 砲台
export const CANNON_Y = GRID_ROWS * CELL_SIZE + CANNON_AREA_HEIGHT / 2;
export const CANNON_WIDTH = CELL_SIZE;
export const CANNON_HEIGHT = CELL_SIZE * 1.5;

// 弾（ブロック射出）
export const BULLET_SPEED = 600;

// スクラップ
export const SCRAP_SPAWN_INTERVAL = 4000; // ms
export const GRAVITY_INTERVAL = 600; // ms

// 矩形判定の最小面積
export const MIN_RECT_AREA = 4;

// スコア
export const BASE_SCORE = 100;
export const CHAIN_MULTIPLIER = 1.5;

// スクラップ形状（矩形の一部が欠けた形）
// filled: 最初から埋まっているセル [row, col]
// 穴（矩形の中で filledに含まれないセル）は全て最下行にあるため下から撃てる
export const SCRAP_SHAPES: { w: number; h: number; filled: [number, number][] }[] = [
  // --- 小型 (2×2) ---
  // 穴1つ
  { w: 2, h: 2, filled: [[0, 0], [0, 1], [1, 0]] },
  { w: 2, h: 2, filled: [[0, 0], [0, 1], [1, 1]] },

  // --- 中型 (3×2) ---
  // 穴1つ
  { w: 3, h: 2, filled: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2]] },
  // 穴2つ
  { w: 3, h: 2, filled: [[0, 0], [0, 1], [0, 2], [1, 0]] },
  { w: 3, h: 2, filled: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { w: 3, h: 2, filled: [[0, 0], [0, 1], [0, 2], [1, 1]] },

  // --- 中型 (4×2) ---
  { w: 4, h: 2, filled: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 3]] },
  { w: 4, h: 2, filled: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0]] },

  // --- 中型 (2×3, 2×4) ---
  { w: 2, h: 3, filled: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]] },
  { w: 2, h: 3, filled: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 1]] },
  { w: 2, h: 4, filled: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0]] },

  // --- 大型 (3×3) ---
  // 穴2つ
  { w: 3, h: 3, filled: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0]] },
  { w: 3, h: 3, filled: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 2]] },
  // 穴3つ（底一列抜き）
  { w: 3, h: 3, filled: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },

  // --- 大型 (4×3) ---
  // 穴3つ
  { w: 4, h: 3, filled: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3], [2, 0]] },
  // 穴4つ（底一列抜き）
  { w: 4, h: 2, filled: [[0, 0], [0, 1], [0, 2], [0, 3]] },

  // --- 大型 (5×2) ---
  { w: 5, h: 2, filled: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 4]] },
  { w: 5, h: 2, filled: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 2], [1, 4]] },

  // --- 特大 (5×3) ---
  { w: 5, h: 3, filled: [
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
    [2, 0], [2, 4],
  ]},

  // --- 縦長 (2×5) ---
  { w: 2, h: 5, filled: [
    [0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1],
    [3, 0], [3, 1], [4, 0],
  ]},
  { w: 2, h: 5, filled: [
    [0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1],
    [3, 0], [3, 1], [4, 1],
  ]},

  // --- 縦長 (2×6) ---
  { w: 2, h: 6, filled: [
    [0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1],
    [3, 0], [3, 1], [4, 0], [4, 1], [5, 0],
  ]},

  // --- 縦長 (3×5) ---
  { w: 3, h: 5, filled: [
    [0, 0], [0, 1], [0, 2],
    [1, 0], [1, 1], [1, 2],
    [2, 0], [2, 1], [2, 2],
    [3, 0], [3, 1], [3, 2],
    [4, 0], [4, 2],
  ]},
  { w: 3, h: 5, filled: [
    [0, 0], [0, 1], [0, 2],
    [1, 0], [1, 1], [1, 2],
    [2, 0], [2, 1], [2, 2],
    [3, 0], [3, 1], [3, 2],
    [4, 0],
  ]},

  // --- 縦長 (1×4, 1×5) 棒状 穴1つ ---
  { w: 1, h: 4, filled: [[0, 0], [1, 0], [2, 0]] },
  { w: 1, h: 5, filled: [[0, 0], [1, 0], [2, 0], [3, 0]] },
];

// 色
export const COLORS = {
  background: 0x1a1a2e,
  cannon: 0xc8a850,
  bullet: 0xdd8833,
  scrap: 0x667788,
  hole: 0x334455,
  holeStroke: 0x5588aa,
  groupOutline: 0x88bbdd,
  gridLine: 0x333355,
  text: "#e0d0b0",
  shipFlash: 0xffff66,
  shipStroke: 0xffcc00,
};
