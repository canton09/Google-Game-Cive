export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const TILE_SIZE = 20;
export const GRID_W = CANVAS_WIDTH / TILE_SIZE;
export const GRID_H = CANVAS_HEIGHT / TILE_SIZE;

export const COLORS = {
  FOOD: '#10b981', // Emerald 500
  WOOD: '#d97706', // Amber 600
  STONE: '#64748b', // Slate 500
  IRON: '#71717a', // Zinc 500
  GOLD: '#fbbf24', // Amber 400
  AGENT_BASE: '#38bdf8', // Sky 400
  HOUSE: '#f472b6', // Pink 400
  STORAGE: '#a78bfa', // Violet 400
  FARM: '#84cc16', // Lime 500
  TOWER: '#94a3b8', // Slate 400
  DISASTER: '#ef4444', // Red 500
};

export const BASE_STATS = {
  speed: 1.5,
  gatheringSpeed: 0.5,
  maxCarry: 10,
  lifespan: 2000, // Ticks
  resilience: 0.1,
};

export const COSTS = {
  HOUSE: { WOOD: 50, STONE: 10 },
  STORAGE: { WOOD: 100, STONE: 50 },
  FARM: { WOOD: 80, STONE: 20 },
  TOWER: { STONE: 150, IRON: 50 },
  UPGRADE: { WOOD: 100, STONE: 50 },
  SPAWN: { FOOD: 25 },
};

export const MUTATION_RATE = 0.1; // 10% change per gen