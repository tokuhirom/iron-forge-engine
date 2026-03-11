// ゲーム画面サイズ（縦画面）
export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 700;

// グリッド設定
export const GRID_COLS = 20;
export const CELL_SIZE = Math.floor(GAME_WIDTH / GRID_COLS); // 19px
export const CANNON_AREA_HEIGHT = 70; // 砲台エリアの高さ
export const GRID_ROWS = Math.floor((GAME_HEIGHT - CANNON_AREA_HEIGHT) / CELL_SIZE); // グリッド行数

// 砲台
export const CANNON_Y = GRID_ROWS * CELL_SIZE + CANNON_AREA_HEIGHT / 2;
export const CANNON_WIDTH = 40;
export const CANNON_HEIGHT = 50;

// 弾
export const BULLET_SPEED = 500;
export const BULLET_RADIUS = 5;

// スクラップ
export const SCRAP_FALL_SPEED = 40; // px/sec（初期値）
export const SCRAP_SPAWN_INTERVAL = 3000; // ms
export const GRAVITY_INTERVAL = 500; // ms（ブロック落下間隔）

// スコア
export const BASE_SCORE = 100;
export const CHAIN_MULTIPLIER = 1.5;

// 色
export const COLORS = {
  background: 0x1a1a2e,
  cannon: 0xc8a850,
  bullet: 0xff6600,
  scrap: 0x666680,
  scrapFilled: 0x8888a0,
  gridLine: 0x333355,
  text: "#e0d0b0",
  steam: 0xcccccc,
};
