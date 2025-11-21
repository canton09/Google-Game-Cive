
export const CANVAS_WIDTH = 1600;
export const CANVAS_HEIGHT = 1200;
export const TILE_SIZE = 20;
export const GRID_W = CANVAS_WIDTH / TILE_SIZE;
export const GRID_H = CANVAS_HEIGHT / TILE_SIZE;

// Terrain Thresholds (0.0 - 1.0)
export const TERRAIN_WATER = 0.32;
export const TERRAIN_SAND = 0.38; // Added distinct sand threshold
export const TERRAIN_FOREST_START = 0.38; 
export const TERRAIN_FOREST_END = 0.55;
export const TERRAIN_MOUNTAIN = 0.72;
export const TERRAIN_SNOW = 0.88; // High peaks

export const COLORS = {
  // Resources - Neon/Vibrant on Dark
  FOOD: '#34d399', // Emerald 400
  WOOD: '#fbbf24', // Amber 400
  STONE: '#94a3b8', // Slate 400
  IRON: '#a1a1aa', // Zinc 400
  GOLD: '#facc15', // Yellow 400
  
  // Agents
  AGENT_BASE: '#0ea5e9', // Sky 500 (Glowing)
  
  // Buildings
  HOUSE: '#f472b6', // Pink 400
  STORAGE: '#8b5cf6', // Violet 500
  FARM: '#84cc16', // Lime 500
  TOWER: '#cbd5e1', // Slate 300
  
  // Terrain Palette (Ethereal/Dark)
  DEEP_WATER: '#0f172a', // Slate 900
  WATER: '#1e3a8a', // Blue 900
  SHALLOW_WATER: '#3b82f6', // Blue 500 (Highlights)
  SAND: '#d97706', // Amber 600 (Muted)
  GRASS: '#065f46', // Emerald 800
  FOREST: '#022c22', // Emerald 950
  ROCK: '#334155', // Slate 700
  SNOW: '#f8fafc', // Slate 50
  
  // UI Elements
  DISASTER: '#ef4444',
  WALL_WOOD: '#78350f',
  WALL_STONE: '#475569', 
};

export const BASE_STATS = {
  speed: 1.5,
  gatheringSpeed: 0.5,
  maxCarry: 10,
  lifespan: 2000, // Ticks
  resilience: 0.1,
  stamina: 1000, // Energy before needing rest
};

export const HOUSE_CAPACITY = 2;

export const BUILDINGS_CONFIG = {
  HOUSE: {
    CAPACITY_PER_LEVEL: 1,
    MAX_LEVEL: 5
  },
  STORAGE: {
    BASE_CAPACITY: 1000,
    CAPACITY_PER_LEVEL: 1000,
    MAX_LEVEL: 10
  },
  FARM: {
    BASE_PRODUCTION: 5,
    PRODUCTION_PER_LEVEL: 3,
    MAX_LEVEL: 5
  }
};

export const COSTS = {
  HOUSE: { WOOD: 60, STONE: 10 },
  STORAGE: { WOOD: 150, STONE: 50 },
  FARM: { WOOD: 80, STONE: 20 },
  TOWER: { STONE: 150, IRON: 50 },
  WALL_WOOD: { WOOD: 15 }, 
  WALL_STONE: { STONE: 15 },
  SPAWN: { FOOD: 200 }, // Increased for cumulative growth mechanism
  UPGRADE_HOUSE: { WOOD: 50, STONE: 20 },
  UPGRADE_STORAGE: { WOOD: 200, STONE: 100 },
  UPGRADE_FARM: { WOOD: 100, STONE: 50 },
};

export const MUTATION_RATE = 0.1;
