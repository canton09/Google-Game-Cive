
import { Agent, AgentState, Building, GameState, ResourceNode, ResourceType, Vector2, Stats } from "../types";
import { CANVAS_WIDTH, CANVAS_HEIGHT, COSTS, BASE_STATS, MUTATION_RATE, GRID_W, GRID_H, TILE_SIZE, HOUSE_CAPACITY, COLORS, BUILDINGS_CONFIG, TERRAIN_MOUNTAIN, TERRAIN_WATER } from "../constants";

// Helper: Distance
const dist = (v1: Vector2, v2: Vector2) => Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));

// Helper: Terrain Generation with Biomes
export const generateTerrain = (): number[][] => {
    const map: number[][] = [];
    // Init noise
    for (let y = 0; y < GRID_H; y++) {
        const row: number[] = [];
        for (let x = 0; x < GRID_W; x++) {
            row.push(Math.random());
        }
        map.push(row);
    }

    // Smooth (Increased iterations for larger landmasses)
    for (let i = 0; i < 5; i++) {
        const newMap = JSON.parse(JSON.stringify(map));
        for (let y = 0; y < GRID_H; y++) {
            for (let x = 0; x < GRID_W; x++) {
                let sum = 0;
                let count = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const ny = y + dy;
                        const nx = x + dx;
                        if (ny >= 0 && ny < GRID_H && nx >= 0 && nx < GRID_W) {
                            sum += map[ny][nx];
                            count++;
                        }
                    }
                }
                newMap[y][x] = sum / count;
            }
        }
        for(let y=0; y<GRID_H; y++) {
            for(let x=0; x<GRID_W; x++) {
                map[y][x] = newMap[y][x];
            }
        }
    }

    // Increase Contrast to create distinct biomes
    for(let y=0; y<GRID_H; y++) {
        for(let x=0; x<GRID_W; x++) {
            let val = map[y][x];
            val = (val - 0.5) * 2.0 + 0.5; // Stronger contrast
            map[y][x] = Math.max(0, Math.min(1, val));
        }
    }

    return map;
};

// Check if a coordinate is passable (walkable)
const isPassable = (x: number, y: number, terrain: number[][]): boolean => {
    if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) return false;
    const gx = Math.floor(x / TILE_SIZE);
    const gy = Math.floor(y / TILE_SIZE);
    if (gy < 0 || gy >= GRID_H || gx < 0 || gx >= GRID_W) return false;
    
    const val = terrain[gy][gx];
    return val > TERRAIN_WATER && val < TERRAIN_MOUNTAIN;
};

// Check if a spot is valid for building (Passable + Not reserved + Radius check)
const isBuildable = (x: number, y: number, terrain: number[][], radius: number = 5): boolean => {
    // Check center
    if (!isPassable(x, y, terrain)) return false;
    // Check corners of the footprint to ensure building doesn't hang over water
    if (!isPassable(x - radius, y - radius, terrain)) return false;
    if (!isPassable(x + radius, y - radius, terrain)) return false;
    if (!isPassable(x - radius, y + radius, terrain)) return false;
    if (!isPassable(x + radius, y + radius, terrain)) return false;
    return true;
};

// Helper: Biome-aware Random Position
const getSpawnPos = (type: ResourceType | 'ANY', terrain: number[][]): Vector2 => {
    let bestPos = { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 };
    let maxAttempts = 50;

    for (let i = 0; i < maxAttempts; i++) {
        const gx = Math.floor(Math.random() * (GRID_W - 2)) + 1;
        const gy = Math.floor(Math.random() * (GRID_H - 2)) + 1;
        const val = terrain[gy][gx];
        
        const px = gx * TILE_SIZE + (Math.random() * TILE_SIZE);
        const py = gy * TILE_SIZE + (Math.random() * TILE_SIZE);

        // Must be accessible
        if (val <= TERRAIN_WATER || val >= TERRAIN_MOUNTAIN) continue;

        let valid = false;
        if (type === ResourceType.FOOD) {
            if (val < 0.5) valid = true; 
        } else if (type === ResourceType.STONE || type === ResourceType.IRON) {
            if (val > 0.5) valid = true; 
        } else if (type === ResourceType.GOLD) {
            if (val > 0.55) valid = true; 
        } else {
            valid = true;
        }

        if (valid || i === maxAttempts - 1) {
            bestPos = { x: px, y: py };
            if (valid) break;
        }
    }
    return bestPos;
};

// Helper: Find valid building spot using concentric spiral around center
const findConstructionSpot = (center: Vector2, buildings: Building[], terrain: number[][], minRadius: number = 40): Vector2 => {
    let radius = minRadius;
    let angle = 0;
    const maxRadius = 2000; // Increased max radius for expansion
    const angleStep = 0.5; 
    
    while (radius < maxRadius) {
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;
        
        // Bounds & Terrain check (Radius 15 approx for buildings)
        if (x > 50 && x < CANVAS_WIDTH - 50 && y > 50 && y < CANVAS_HEIGHT - 50) {
             if (isBuildable(x, y, terrain, 15)) {
                 // Collision check with other buildings
                 const collision = buildings.some(b => dist(b.position, {x,y}) < 25); 
                 if (!collision) {
                     return {x, y};
                 }
             }
        }
        
        angle += angleStep;
        if (angle > Math.PI * 2) {
            angle = 0;
            radius += 20; 
        }
    }
    return center;
};

const mutate = (parentStats: Stats): Stats => {
    return {
        speed: Math.max(0.5, parentStats.speed * (1 + (Math.random() * 0.2 - 0.1))),
        gatheringSpeed: Math.max(0.1, parentStats.gatheringSpeed * (1 + (Math.random() * 0.2 - 0.1))),
        maxCarry: Math.max(5, parentStats.maxCarry * (1 + (Math.random() * 0.2 - 0.1))),
        lifespan: Math.max(500, parentStats.lifespan * (1 + (Math.random() * 0.2 - 0.1))),
        resilience: Math.min(0.9, Math.max(0, parentStats.resilience + (Math.random() * 0.05 - 0.025))),
        stamina: Math.max(500, parentStats.stamina * (1 + (Math.random() * 0.2 - 0.1))),
    };
};

// --- Helper: Upgrades & Stats ---

const getHouseCapacity = (building: Building) => {
    return HOUSE_CAPACITY + (building.level - 1) * BUILDINGS_CONFIG.HOUSE.CAPACITY_PER_LEVEL;
};

const getFarmProduction = (building: Building) => {
    return BUILDINGS_CONFIG.FARM.BASE_PRODUCTION + (building.level - 1) * BUILDINGS_CONFIG.FARM.PRODUCTION_PER_LEVEL;
};

const getUpgradeCost = (type: 'HOUSE' | 'STORAGE' | 'FARM', currentLevel: number) => {
    const base = type === 'HOUSE' ? COSTS.UPGRADE_HOUSE : 
                 type === 'STORAGE' ? COSTS.UPGRADE_STORAGE : COSTS.UPGRADE_FARM;
    
    const multiplier = Math.pow(1.5, currentLevel - 1);
    return {
        WOOD: Math.floor(base.WOOD * multiplier),
        STONE: Math.floor(base.STONE * multiplier)
    };
};

// --- Pathfinding (A*) ---

const getGridPos = (p: Vector2) => ({ x: Math.floor(p.x / TILE_SIZE), y: Math.floor(p.y / TILE_SIZE) });

const findPath = (start: Vector2, end: Vector2, terrain: number[][]): Vector2[] | null => {
    const startNode = getGridPos(start);
    const endNode = getGridPos(end);

    // Optimization: Check direct line first? No, terrain is complex.
    // Optimization: If straight line distance is small (< 2 tiles), just go direct
    if (Math.abs(startNode.x - endNode.x) <= 1 && Math.abs(startNode.y - endNode.y) <= 1) return [end];

    // Quick bounds check for end node passability (if end is water, find nearest land?)
    // For now, assume targets are valid (resources are on land).

    const openList: any[] = [];
    const closedSet = new Set<string>();
    
    const createNode = (x: number, y: number, parent: any = null) => ({
        x, y, 
        f: 0, g: 0, h: 0, 
        parent,
        id: `${x},${y}`
    });

    const startN = createNode(startNode.x, startNode.y);
    startN.h = Math.abs(startNode.x - endNode.x) + Math.abs(startNode.y - endNode.y);
    startN.f = startN.h;
    openList.push(startN);

    let iterations = 0;
    const MAX_ITERATIONS = 1500; // Limit to prevent freeze

    while (openList.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        // Find lowest F
        let lowInd = 0;
        for(let i=1; i<openList.length; i++) {
            if(openList[i].f < openList[lowInd].f) { lowInd = i; }
        }
        const currentNode = openList[lowInd];

        // Reached target?
        if (Math.abs(currentNode.x - endNode.x) <= 1 && Math.abs(currentNode.y - endNode.y) <= 1) {
             const path: Vector2[] = [];
             let curr = currentNode;
             // Reconstruct
             while(curr.parent) {
                 path.push({ 
                    x: curr.x * TILE_SIZE + TILE_SIZE/2, 
                    y: curr.y * TILE_SIZE + TILE_SIZE/2 
                 });
                 curr = curr.parent;
             }
             // Path is reversed (End -> Start). Reverse it to be Start -> End.
             // Note: We do not include the start node in the path.
             return path.reverse();
        }

        openList.splice(lowInd, 1);
        closedSet.add(currentNode.id);

        // Neighbors: 8 directions for smoother movement
        const neighbors = [
            {x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0},
            {x:-1, y:-1}, {x:1, y:-1}, {x:-1, y:1}, {x:1, y:1}
        ];

        for(let i=0; i<neighbors.length; i++) {
            const nx = currentNode.x + neighbors[i].x;
            const ny = currentNode.y + neighbors[i].y;
            
            if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
            
            // Passability Check
            const val = terrain[ny][nx];
            if (val <= TERRAIN_WATER || val >= TERRAIN_MOUNTAIN) continue;

            const neighborId = `${nx},${ny}`;
            if (closedSet.has(neighborId)) continue;

            const isDiag = neighbors[i].x !== 0 && neighbors[i].y !== 0;
            const moveCost = isDiag ? 1.414 : 1;
            const gScore = currentNode.g + moveCost;
            
            let neighbor = openList.find(n => n.id === neighborId);
            
            if (!neighbor) {
                neighbor = createNode(nx, ny, currentNode);
                neighbor.g = gScore;
                neighbor.h = Math.abs(nx - endNode.x) + Math.abs(ny - endNode.y); // Manhattan Heuristic
                neighbor.f = neighbor.g + neighbor.h;
                openList.push(neighbor);
            } else if (gScore < neighbor.g) {
                neighbor.g = gScore;
                neighbor.parent = currentNode;
                neighbor.f = neighbor.g + neighbor.h;
            }
        }
    }
    
    // Fallback: If pathfinding fails (e.g. island), return direct target to attempt slide
    return [end];
};

// --- Movement Helper ---
const moveAgentTowards = (agent: Agent, target: Vector2, terrain: number[][]) => {
    const dx = target.x - agent.position.x;
    const dy = target.y - agent.position.y;
    const distToTarget = Math.sqrt(dx*dx + dy*dy);
    
    // If close enough to snap
    if (distToTarget < agent.stats.speed) {
        if (isPassable(target.x, target.y, terrain)) {
            agent.position.x = target.x;
            agent.position.y = target.y;
        }
        return;
    }

    const angle = Math.atan2(dy, dx);
    const vx = Math.cos(angle) * agent.stats.speed;
    const vy = Math.sin(angle) * agent.stats.speed;

    const nextX = agent.position.x + vx;
    const nextY = agent.position.y + vy;

    // Collision Check: Try full move
    if (isPassable(nextX, nextY, terrain)) {
        agent.position.x = nextX;
        agent.position.y = nextY;
    } else {
        // Slide along axes
        let moved = false;
        if (isPassable(nextX, agent.position.y, terrain)) {
            agent.position.x = nextX;
            moved = true;
        } else if (isPassable(agent.position.x, nextY, terrain)) {
            agent.position.y = nextY;
            moved = true;
        }
        
        // If blocked completely (corner or dead end)
        if (!moved) {
            // Small random jitter to help unstuck
            const jitterAngle = angle + (Math.random() > 0.5 ? 1.5 : -1.5);
            const jx = agent.position.x + Math.cos(jitterAngle) * (agent.stats.speed * 0.5);
            const jy = agent.position.y + Math.sin(jitterAngle) * (agent.stats.speed * 0.5);
            if (isPassable(jx, jy, terrain)) {
                agent.position.x = jx;
                agent.position.y = jy;
            }
        }
    }
};

// Helper to manage path following
const followPath = (agent: Agent, finalTarget: Vector2, terrain: number[][]) => {
    // 1. Recalculate path if missing or empty (but we have a distinct target)
    if (!agent.path || agent.path.length === 0) {
        // Only pathfind if distant, otherwise direct move
        if (dist(agent.position, finalTarget) > TILE_SIZE) {
             agent.path = findPath(agent.position, finalTarget, terrain);
        } else {
             agent.path = [finalTarget];
        }
    }

    // 2. Follow Waypoints
    if (agent.path && agent.path.length > 0) {
        const nextWaypoint = agent.path[0];
        
        // Move towards current waypoint
        moveAgentTowards(agent, nextWaypoint, terrain);
        
        // If reached waypoint, pop it
        if (dist(agent.position, nextWaypoint) < Math.max(5, agent.stats.speed * 1.5)) {
            agent.path.shift();
        }
    } else {
        // Fallback direct
        moveAgentTowards(agent, finalTarget, terrain);
    }
};


export const initializeGame = (): GameState => {
    const terrain = generateTerrain();
    
    // Find a valid spawn center (not water/mountain)
    let center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    // Search for valid center
    let foundCenter = false;
    // Spiral out from center to find valid land
    let r = 0, a = 0;
    while(!foundCenter && r < 800) {
        const cx = center.x + Math.cos(a) * r;
        const cy = center.y + Math.sin(a) * r;
        // Check radius 20 for spawn center safety
        if (isBuildable(cx, cy, terrain, 20)) {
            center = {x: cx, y: cy};
            foundCenter = true;
        }
        a += 0.5;
        if (a > Math.PI*2) { a=0; r+=20; }
    }

    // Initial Nodes
    const nodes: ResourceNode[] = [];
    for (let i = 0; i < 6; i++) nodes.push({ id: `f-${i}`, type: ResourceType.FOOD, position: getSpawnPos(ResourceType.FOOD, terrain), amount: 1000, maxAmount: 1000 });
    for (let i = 0; i < 5; i++) nodes.push({ id: `w-${i}`, type: ResourceType.WOOD, position: getSpawnPos(ResourceType.WOOD, terrain), amount: 5000, maxAmount: 5000 });
    for (let i = 0; i < 4; i++) nodes.push({ id: `s-${i}`, type: ResourceType.STONE, position: getSpawnPos(ResourceType.STONE, terrain), amount: 5000, maxAmount: 5000 });
    for (let i = 0; i < 2; i++) nodes.push({ id: `i-${i}`, type: ResourceType.IRON, position: getSpawnPos(ResourceType.IRON, terrain), amount: 2000, maxAmount: 2000 });
    for (let i = 0; i < 1; i++) nodes.push({ id: `g-${i}`, type: ResourceType.GOLD, position: getSpawnPos(ResourceType.GOLD, terrain), amount: 500, maxAmount: 500 });

    // Initial Buildings
    const buildings: Building[] = [
        { id: 'base', type: 'STORAGE', position: center, level: 1, occupants: [] }
    ];

    // Initial Agents
    const agents: Agent[] = [];
    const initPop = 6;
    
    for (let i = 0; i < initPop; i++) {
        const agent: Agent = {
            id: `init-${i}`,
            position: { x: center.x + (Math.random() * 20 - 10), y: center.y + (Math.random() * 20 - 10) },
            target: null,
            path: null,
            state: AgentState.IDLE,
            inventory: null,
            stats: { ...BASE_STATS },
            energy: BASE_STATS.stamina,
            age: 0,
            gen: 1,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`,
            homeId: null
        };
        agents.push(agent);
    }

    // Create initial houses
    const housesNeeded = Math.ceil(initPop / HOUSE_CAPACITY);
    for(let h=0; h<housesNeeded; h++) {
         const pos = findConstructionSpot(center, buildings, terrain, 40);
         const houseId = `house-init-${h}`;
         buildings.push({
             id: houseId,
             type: 'HOUSE',
             position: pos,
             level: 1,
             occupants: []
         });
    }

    // Assign homes
    let currentHouseIdx = 0;
    agents.forEach(agent => {
        let house = buildings.filter(b => b.type === 'HOUSE')[currentHouseIdx];
        if (!house) {
            currentHouseIdx = 0;
            house = buildings.filter(b => b.type === 'HOUSE')[0];
        }
        if (house) {
            agent.homeId = house.id;
            house.occupants = house.occupants || [];
            house.occupants.push(agent.id);
            if (house.occupants.length >= getHouseCapacity(house)) currentHouseIdx++;
        }
    });

    return {
        resources: { FOOD: 50, WOOD: 100, STONE: 0, IRON: 0, GOLD: 0 },
        agents,
        buildings,
        nodes,
        terrain,
        generation: 1,
        populationPeak: initPop,
        totalTime: 0,
        disasterActive: false,
        disasterType: null,
        lore: ["第一批家庭建立了他们的家园，在荒野中开辟出第一块立足之地。"],
        reproductionProgress: 0,
    };
};

export const tickSimulation = (state: GameState): GameState => {
    const newState = { ...state };
    
    // Migration safe guard
    if (newState.reproductionProgress === undefined) newState.reproductionProgress = 0;

    // Initialize checks
    if (!newState.terrain || newState.terrain.length === 0) newState.terrain = generateTerrain();
    if (newState.resources.IRON === undefined) newState.resources.IRON = 0;
    if (newState.resources.GOLD === undefined) newState.resources.GOLD = 0;

    let center = newState.buildings.find(b => b.type === 'STORAGE')?.position;
    if (!center && newState.buildings.length > 0) center = newState.buildings[0].position;
    if (!center) center = { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 };

    newState.totalTime += 1;

    // --- Production ---
    // UNLIMITED RESOURCE ACCUMULATION
    if (newState.totalTime % 200 === 0) { 
        const farms = newState.buildings.filter(b => b.type === 'FARM');
        let production = 0;
        farms.forEach(f => production += getFarmProduction(f));
        newState.resources.FOOD += production;
    }

    // --- Disaster ---
    if (!newState.disasterActive && Math.random() < 0.00002) { 
        newState.disasterActive = true;
        newState.disasterType = Math.random() > 0.5 ? 'EARTHQUAKE' : 'BLIZZARD';
        newState.lore.unshift(`警报：${newState.disasterType === 'EARTHQUAKE' ? '地震' : '暴风雪'}来袭！`);
    } else if (newState.disasterActive) {
        if (Math.random() < 0.005) { 
            newState.disasterActive = false;
            newState.disasterType = null;
        } else if (newState.disasterType === 'EARTHQUAKE' && Math.random() < 0.01) {
            const walls = newState.buildings.filter(b => b.type === 'WALL');
            if (walls.length > 0) {
                const victimIdx = Math.floor(Math.random() * walls.length);
                newState.buildings.splice(newState.buildings.indexOf(walls[victimIdx]), 1);
            }
        }
    }

    // --- Resources Regeneration ---
    newState.nodes.forEach(node => {
        if (node.amount < node.maxAmount && Math.random() < 0.01 && !newState.disasterActive) node.amount++;
        if (node.amount <= 0 && Math.random() < 0.001) {
            node.amount = node.type === ResourceType.GOLD ? 50 : 200;
            node.position = getSpawnPos(node.type, newState.terrain);
        }
    });

    const canAfford = (cost: {WOOD: number, STONE: number}, multiplier: number = 1) => 
        newState.resources.WOOD >= cost.WOOD * multiplier && newState.resources.STONE >= cost.STONE * multiplier;

    // --- CITY UPGRADES (AUTOMATED INFINITE) ---
    if (newState.totalTime % 50 === 0 && !newState.disasterActive) {
        
        // Storage
        const storages = newState.buildings.filter(b => b.type === 'STORAGE');
        storages.sort((a,b) => a.level - b.level);
        if (storages[0]) {
            const cost = getUpgradeCost('STORAGE', storages[0].level);
            if (canAfford(cost, 2)) {
                newState.resources.WOOD -= cost.WOOD;
                newState.resources.STONE -= cost.STONE;
                storages[0].level++;
                storages[0].lastLevelUpTime = newState.totalTime;
            }
        }

        // Houses
        const houses = newState.buildings.filter(b => b.type === 'HOUSE');
        const totalPop = newState.agents.length;
        const totalCap = houses.reduce((sum, b) => sum + getHouseCapacity(b), 0);
        
        if (totalPop >= totalCap * 0.8) {
             const upgradeableHouses = houses.filter(b => b.level < BUILDINGS_CONFIG.HOUSE.MAX_LEVEL);
             if (upgradeableHouses.length > 0) {
                upgradeableHouses.sort((a,b) => a.level - b.level);
                const cost = getUpgradeCost('HOUSE', upgradeableHouses[0].level);
                if (canAfford(cost, 1.5)) {
                   newState.resources.WOOD -= cost.WOOD;
                   newState.resources.STONE -= cost.STONE;
                   upgradeableHouses[0].level++;
                   upgradeableHouses[0].lastLevelUpTime = newState.totalTime;
                }
             }
        }

        // Farms
        const farms = newState.buildings.filter(b => b.type === 'FARM');
        if (newState.resources.FOOD < totalPop * 50) {
             const upgradeableFarms = farms.filter(b => b.level < BUILDINGS_CONFIG.FARM.MAX_LEVEL);
             if (upgradeableFarms.length > 0) {
                upgradeableFarms.sort((a,b) => a.level - b.level);
                const cost = getUpgradeCost('FARM', upgradeableFarms[0].level);
                if (canAfford(cost, 1.5)) {
                   newState.resources.WOOD -= cost.WOOD;
                   newState.resources.STONE -= cost.STONE;
                   upgradeableFarms[0].level++;
                   upgradeableFarms[0].lastLevelUpTime = newState.totalTime;
                }
             }
        }
    }

    // --- CITY CONSTRUCTION (AUTOMATED INFINITE) ---
    const houses = newState.buildings.filter(b => b.type === 'HOUSE');
    const homelessAgents = newState.agents.filter(a => !a.homeId || !houses.find(h => h.id === a.homeId));
    const totalCapacity = houses.reduce((acc, b) => acc + getHouseCapacity(b), 0);
    
    const needsHouse = homelessAgents.length > 0 || newState.agents.length > totalCapacity * 0.9;
    
    if (needsHouse && newState.resources.WOOD >= COSTS.HOUSE.WOOD * 1.2 && newState.resources.STONE >= COSTS.HOUSE.STONE * 1.2) {
        newState.resources.WOOD -= COSTS.HOUSE.WOOD;
        newState.resources.STONE -= COSTS.HOUSE.STONE;
        const pos = findConstructionSpot(center, newState.buildings, newState.terrain, 40);
        newState.buildings.push({ id: `house-${newState.totalTime}`, type: 'HOUSE', position: pos, level: 1, occupants: [] });
    }

    if (newState.resources.WOOD >= COSTS.FARM.WOOD * 3 && newState.resources.STONE >= COSTS.FARM.STONE * 3) {
        if (newState.buildings.filter(b => b.type === 'FARM').length < Math.max(2, newState.agents.length / 3)) {
            newState.resources.WOOD -= COSTS.FARM.WOOD;
            newState.resources.STONE -= COSTS.FARM.STONE;
            const pos = findConstructionSpot(center, newState.buildings, newState.terrain, 60);
            newState.buildings.push({ id: `farm-${newState.totalTime}`, type: 'FARM', position: pos, level: 1 });
        }
    }

    // 3. Build DEFENSES (Fences & Walls)
    const walls = newState.buildings.filter(b => b.type === 'WALL');
    
    if (newState.resources.STONE > 200) {
         const woodWalls = walls.filter(w => w.level === 1);
         if (woodWalls.length > 0) {
             const wallToUpgrade = woodWalls[0];
             if (newState.resources.STONE >= COSTS.WALL_STONE.STONE) {
                 newState.resources.STONE -= COSTS.WALL_STONE.STONE;
                 wallToUpgrade.level = 2; // 2 = Stone Wall
             }
         }
    }

    if (newState.resources.WOOD > 300) {
        if (newState.resources.WOOD >= COSTS.WALL_WOOD.WOOD && Math.random() < 0.2) {
            let maxDist = 0;
            newState.buildings.forEach(b => { if (b.type !== 'WALL') maxDist = Math.max(maxDist, dist(center!, b.position)); });
            const wallRadius = Math.max(150, maxDist + 50); 
            
            for(let i=0; i<10; i++) {
                const angle = Math.random() * Math.PI * 2;
                const wx = center!.x + Math.cos(angle) * wallRadius;
                const wy = center!.y + Math.sin(angle) * wallRadius;
                
                if (isBuildable(wx, wy, newState.terrain, 5)) {
                    const nearbyWall = walls.find(b => dist(b.position, {x:wx, y:wy}) < 15);
                    if (!nearbyWall) {
                        const blocked = newState.buildings.some(b => dist(b.position, {x:wx, y:wy}) < 15) ||
                                        newState.nodes.some(n => dist(n.position, {x:wx, y:wy}) < 15);
                        if (!blocked) {
                            newState.resources.WOOD -= COSTS.WALL_WOOD.WOOD;
                            newState.buildings.push({
                                id: `wall-${newState.totalTime}`,
                                type: 'WALL',
                                position: {x: wx, y: wy},
                                level: 1, 
                            });
                            break;
                        }
                    }
                }
            }
        }
    }


    // --- Reproduction (CUMULATIVE PROGRESS) ---
    const currentCapacity = newState.buildings.filter(b => b.type === 'HOUSE').reduce((acc, b) => acc + getHouseCapacity(b), 0);
    const populationCapBuffer = currentCapacity + 2;
    
    if (newState.agents.length < populationCapBuffer && !newState.disasterActive) {
        const SAFETY_FOOD_BUFFER = 100;
        const GROWTH_RATE_PER_TICK = 0.5; 

        if (newState.resources.FOOD > SAFETY_FOOD_BUFFER) {
            newState.resources.FOOD -= GROWTH_RATE_PER_TICK;
            newState.reproductionProgress += GROWTH_RATE_PER_TICK;
        }

        if (newState.reproductionProgress >= COSTS.SPAWN.FOOD) {
             newState.reproductionProgress = 0; 
             
             const parent = newState.agents[Math.floor(Math.random() * newState.agents.length)];
             const newStats = parent ? mutate(parent.stats) : { ...BASE_STATS };
             
             const newAgent: Agent = {
                 id: `gen-${newState.totalTime}`,
                 position: { ...center! },
                 target: null,
                 path: null,
                 state: AgentState.IDLE,
                 inventory: null,
                 stats: newStats,
                 energy: newStats.stamina,
                 age: 0,
                 gen: (parent?.gen || 0) + 1,
                 color: parent ? parent.color : `hsl(${Math.random() * 360}, 70%, 60%)`,
                 homeId: null
             };
             
             const home = newState.buildings.find(b => b.type === 'HOUSE' && (b.occupants?.length || 0) < getHouseCapacity(b));
             if (home) {
                 newAgent.homeId = home.id;
                 home.occupants = home.occupants || [];
                 home.occupants.push(newAgent.id);
             }
             newState.agents.push(newAgent);
             newState.populationPeak = Math.max(newState.populationPeak, newState.agents.length);
        }
    }

    // --- Agent Loop ---
    newState.agents = newState.agents.filter(a => {
        const alive = a.age < a.stats.lifespan;
        if (!alive && a.homeId) {
             const home = newState.buildings.find(b => b.id === a.homeId);
             if (home && home.occupants) home.occupants = home.occupants.filter(oid => oid !== a.id);
        }
        return alive;
    });

    // Anti-Extinction
    if (newState.agents.length < 2) {
        for(let i=0; i<2; i++) {
             newState.agents.push({
                id: `nomad-${newState.totalTime}-${i}`,
                position: { ...center! },
                target: null,
                path: null,
                state: AgentState.IDLE,
                inventory: null,
                stats: { ...BASE_STATS },
                energy: BASE_STATS.stamina,
                age: 0,
                gen: newState.generation, 
                color: `hsl(${Math.random() * 360}, 70%, 60%)`,
                homeId: null
            });
        }
    }

    newState.agents.forEach(agent => {
        agent.age++;
        if (agent.energy === undefined) agent.energy = agent.stats.stamina;

        if (agent.state !== AgentState.RESTING && agent.state !== AgentState.MOVING_HOME) agent.energy -= 0.5;

        if (agent.energy < (agent.stats.stamina * 0.3) && agent.state !== AgentState.RESTING && agent.state !== AgentState.MOVING_HOME && !newState.disasterActive) {
            agent.state = AgentState.MOVING_HOME;
            let homePos = center!; 
            if (agent.homeId) {
                const home = newState.buildings.find(b => b.id === agent.homeId);
                if (home) homePos = home.position;
            }
            agent.target = homePos;
            agent.path = null; // Trigger pathfinding
        }

        if (newState.disasterActive && Math.random() > agent.stats.resilience) {
            agent.state = AgentState.FLEEING;
            agent.path = null; // Reset path
        }

        // State Machine with Collision
        switch (agent.state) {
            case AgentState.FLEEING:
                if (dist(agent.position, center!) > 50) {
                     const angle = Math.atan2(center!.y - agent.position.y, center!.x - agent.position.x);
                     const tX = agent.position.x + Math.cos(angle) * 10;
                     const tY = agent.position.y + Math.sin(angle) * 10;
                     moveAgentTowards(agent, {x: tX, y: tY}, newState.terrain);
                } else if (!newState.disasterActive) agent.state = AgentState.IDLE;
                break;

            case AgentState.RESTING:
                agent.energy += 5;
                if (agent.energy >= agent.stats.stamina) {
                    agent.energy = agent.stats.stamina;
                    agent.state = AgentState.IDLE;
                    agent.target = null;
                    agent.path = null;
                }
                break;

            case AgentState.MOVING_HOME:
                if (agent.target) {
                    if (dist(agent.position, agent.target) < 10) {
                        agent.state = AgentState.RESTING;
                        agent.target = null;
                        agent.path = null;
                    } else {
                        followPath(agent, agent.target, newState.terrain);
                    }
                } else agent.state = AgentState.IDLE;
                break;

            case AgentState.IDLE:
                // Prioritize based on current stockpiles
                let targetType = ResourceType.FOOD;
                
                const r = newState.resources;
                if (r.FOOD > 500) targetType = ResourceType.WOOD;
                if (r.FOOD > 1000 && r.WOOD > 500) targetType = ResourceType.STONE;
                if (r.STONE > 500 && r.WOOD > 1000 && Math.random() < 0.4) targetType = ResourceType.IRON;
                if (r.WOOD > 2000 && Math.random() < 0.1) targetType = ResourceType.GOLD;
                if (r.FOOD < 100) targetType = ResourceType.FOOD;

                const nodes = newState.nodes.filter(n => n.type === targetType && n.amount > 0);
                if (nodes.length > 0) {
                    nodes.sort((a,b) => dist(agent.position, a.position) - dist(agent.position, b.position));
                    // Pick a random one from nearest 3 to avoid clumping
                    const targetNode = nodes[Math.floor(Math.random() * Math.min(3, nodes.length))];
                    agent.target = targetNode.position;
                    agent.path = null; // Reset path for new target
                    agent.state = AgentState.MOVING_TO_RESOURCE;
                } else {
                     // Wander randomly if no target resource found
                     const angle = Math.random() * Math.PI * 2;
                     const wx = agent.position.x + Math.cos(angle) * 20;
                     const wy = agent.position.y + Math.sin(angle) * 20;
                     if (isPassable(wx, wy, newState.terrain)) {
                         moveAgentTowards(agent, {x: wx, y: wy}, newState.terrain);
                     }
                }
                break;

            case AgentState.MOVING_TO_RESOURCE:
                if (agent.target) {
                    if (dist(agent.position, agent.target) < 10) {
                        agent.state = AgentState.GATHERING;
                        agent.path = null;
                    } else {
                        followPath(agent, agent.target, newState.terrain);
                    }
                } else agent.state = AgentState.IDLE;
                break;

            case AgentState.GATHERING:
                const node = newState.nodes.find(n => dist(agent.position, n.position) < 20);
                if (node && node.amount > 0) {
                    agent.inventory = agent.inventory || { type: node.type, amount: 0 };
                    let speedMod = 1;
                    if (node.type === ResourceType.STONE) speedMod = 0.8;
                    if (node.type === ResourceType.IRON) speedMod = 0.6;
                    if (node.type === ResourceType.GOLD) speedMod = 0.4;

                    const take = Math.min(agent.stats.gatheringSpeed * speedMod, node.amount, agent.stats.maxCarry - agent.inventory.amount);
                    node.amount -= take;
                    agent.inventory.amount += take;

                    if (agent.inventory.amount >= agent.stats.maxCarry || node.amount <= 0) {
                        agent.state = AgentState.RETURNING;
                        agent.target = center!;
                        agent.path = null; // Reset path for return trip
                    }
                } else {
                    agent.state = AgentState.IDLE;
                }
                break;

            case AgentState.RETURNING:
                if (dist(agent.position, center!) < 15) {
                    if (agent.inventory) {
                        newState.resources[agent.inventory.type] += agent.inventory.amount;
                        agent.inventory = null;
                    }
                    agent.state = AgentState.IDLE;
                    agent.target = null;
                    agent.path = null;
                } else {
                    followPath(agent, center!, newState.terrain);
                }
                break;
        }
    });

    return newState;
};
