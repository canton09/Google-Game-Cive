export enum AgentState {
  IDLE = 'IDLE',
  MOVING_TO_RESOURCE = 'MOVING_TO_RESOURCE',
  GATHERING = 'GATHERING',
  RETURNING = 'RETURNING',
  BUILDING = 'BUILDING',
  FLEEING = 'FLEEING'
}

export enum ResourceType {
  FOOD = 'FOOD',
  WOOD = 'WOOD',
  STONE = 'STONE',
  IRON = 'IRON',
  GOLD = 'GOLD'
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Stats {
  speed: number;
  gatheringSpeed: number;
  maxCarry: number;
  lifespan: number;
  resilience: number; // Resistance to disasters
}

export interface Agent {
  id: string;
  position: Vector2;
  target: Vector2 | null;
  state: AgentState;
  inventory: { type: ResourceType; amount: number } | null;
  stats: Stats;
  age: number;
  gen: number;
  color: string;
}

export interface Building {
  id: string;
  type: 'HOUSE' | 'STORAGE' | 'MONUMENT' | 'FARM' | 'TOWER';
  position: Vector2;
  level: number;
  lastLevelUpTime?: number; // Tick timestamp when last upgraded
}

export interface ResourceNode {
  id: string;
  type: ResourceType;
  position: Vector2;
  amount: number;
  maxAmount: number;
}

export interface GameState {
  resources: {
    [key in ResourceType]: number;
  };
  agents: Agent[];
  buildings: Building[];
  nodes: ResourceNode[];
  terrain: number[][]; // 0.0 to 1.0 heightmap/biomemap
  generation: number;
  populationPeak: number;
  totalTime: number;
  disasterActive: boolean;
  disasterType: string | null;
  lore: string[]; // AI Generated history
}

export interface SimulationConfig {
  width: number;
  height: number;
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}