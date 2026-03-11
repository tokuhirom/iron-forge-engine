// ゲーム画面サイズ（縦画面）
export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 700;

// グリッド設定
export const GRID_COLS = 13;
export const CELL_SIZE = Math.floor(GAME_WIDTH / GRID_COLS); // 30px
export const CANNON_AREA_HEIGHT = 70;
export const GRID_ROWS = Math.floor((GAME_HEIGHT - CANNON_AREA_HEIGHT) / CELL_SIZE);

// 砲台
export const CANNON_Y = GRID_ROWS * CELL_SIZE + CANNON_AREA_HEIGHT / 2;
export const CANNON_WIDTH = CELL_SIZE;
export const CANNON_HEIGHT = CELL_SIZE * 1.5;

// 弾（ブロック射出）
export const BULLET_SPEED = 600; // px/sec

// スクラップ（テトロミノ）
export const SCRAP_SPAWN_INTERVAL = 3500; // ms
export const GRAVITY_INTERVAL = 600; // ms

// 矩形判定の最小面積
export const MIN_RECT_AREA = 4; // 2x2以上

// スコア
export const BASE_SCORE = 100;
export const CHAIN_MULTIPLIER = 1.5;

// テトロミノ定義（各形状のセルオフセット [row, col][]）
export const TETROMINOS: { name: string; cells: [number, number][] }[] = [
  { name: "T", cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { name: "L", cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { name: "J", cells: [[0, 1], [1, 1], [2, 0], [2, 1]] },
  { name: "S", cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  { name: "Z", cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
  { name: "I", cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
];

// 色
export const COLORS = {
  background: 0x1a1a2e,
  cannon: 0xc8a850,
  bullet: 0xdd8833,
  scrap: 0x667788,
  gridLine: 0x333355,
  text: "#e0d0b0",
  shipFlash: 0xffff66,
  shipStroke: 0xffcc00,
};
