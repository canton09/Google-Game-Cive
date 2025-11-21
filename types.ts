
export enum AgentState {
  IDLE = 'IDLE',
  MOVING_TO_RESOURCE = 'MOVING_TO_RESOURCE',
  GATHERING = 'GATHERING',
  RETURNING = 'RETURNING',
  BUILDING = 'BUILDING',
  FLEEING = 'FLEEING',
  MOVING_HOME = 'MOVING_HOME',
  RESTING = 'RESTING'
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
  stamina: number; // Max energy
}

export interface Agent {
  id: string;
  position: Vector2;
  target: Vector2 | null;
  path?: Vector2[] | null; // List of waypoints to follow
  state: AgentState;
  inventory: { type: ResourceType; amount: number } | null;
  stats: Stats;
  energy: number; // Current energy
  age: number;
  gen: number;
  color: string;
  homeId: string | null; // The ID of the house this agent owns/lives in
}

export interface Building {
  id: string;
  type: 'HOUSE' | 'STORAGE' | 'MONUMENT' | 'FARM' | 'TOWER' | 'WALL';
  position: Vector2;
  level: number;
  lastLevelUpTime?: number; // Tick timestamp when last upgraded
  occupants?: string[]; // IDs of agents living here
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
  reproductionProgress: number; // 0 to SPAWN_COST, accumulates food to create agent
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
