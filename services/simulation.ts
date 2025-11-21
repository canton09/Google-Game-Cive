
import { Agent, AgentState, Building, GameState, ResourceNode, ResourceType, Vector2, Stats } from "../types";
import { CANVAS_WIDTH, CANVAS_HEIGHT, COSTS, BASE_STATS, MUTATION_RATE, GRID_W, GRID_H, TILE_SIZE, HOUSE_CAPACITY, COLORS } from "../constants";

// Helper: Distance
const dist = (v1: Vector2, v2: Vector2) => Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));

// Helper: Terrain Generation
export const generateTerrain = (): number[][] => {
    const map: number[][] = [];
    for (let y = 0; y < GRID_H; y++) {
        const row: number[] = [];
        for (let x = 0; x < GRID_W; x++) {
            row.push(Math.random());
        }
        map.push(row);
    }

    for (let i = 0; i < 4; i++) {
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
    return map;
};

// Helper: Biome-aware Random Position
const getSpawnPos = (type: ResourceType | 'ANY', terrain: number[][]): Vector2 => {
    let bestPos = { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 };
    let maxAttempts = 20;

    for (let i = 0; i < maxAttempts; i++) {
        const gx = Math.floor(Math.random() * (GRID_W - 2)) + 1;
        const gy = Math.floor(Math.random() * (GRID_H - 2)) + 1;
        const val = terrain[gy][gx];
        
        const px = gx * TILE_SIZE + (Math.random() * TILE_SIZE);
        const py = gy * TILE_SIZE + (Math.random() * TILE_SIZE);

        let valid = false;
        if (type === ResourceType.FOOD) {
            if (val < 0.48) valid = true; 
        } else if (type === ResourceType.STONE || type === ResourceType.IRON) {
            if (val > 0.52) valid = true; 
        } else if (type === ResourceType.GOLD) {
            if (val > 0.6) valid = true; 
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
const findConstructionSpot = (center: Vector2, buildings: Building[], minRadius: number = 40): Vector2 => {
    let radius = minRadius;
    let angle = 0;
    const maxRadius = 1000;
    const angleStep = 0.5; // roughly 30 degrees
    
    while (radius < maxRadius) {
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;
        
        // Bounds check
        if (x > 50 && x < CANVAS_WIDTH - 50 && y > 50 && y < CANVAS_HEIGHT - 50) {
             // Collision check with other buildings
             const collision = buildings.some(b => dist(b.position, {x,y}) < 25); // 25 radius clearance
             if (!collision) {
                 return {x, y};
             }
        }
        
        angle += angleStep;
        if (angle > Math.PI * 2) {
            angle = 0;
            radius += 20; // Move outward
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

export const initializeGame = (): GameState => {
    const center: Vector2 = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    const terrain = generateTerrain();
    
    // Initial Nodes
    const nodes: ResourceNode[] = [];
    for (let i = 0; i < 6; i++) nodes.push({ id: `f-${i}`, type: ResourceType.FOOD, position: getSpawnPos(ResourceType.FOOD, terrain), amount: 1000, maxAmount: 1000 });
    for (let i = 0; i < 5; i++) nodes.push({ id: `w-${i}`, type: ResourceType.WOOD, position: getSpawnPos(ResourceType.WOOD, terrain), amount: 5000, maxAmount: 5000 });
    for (let i = 0; i < 4; i++) nodes.push({ id: `s-${i}`, type: ResourceType.STONE, position: getSpawnPos(ResourceType.STONE, terrain), amount: 5000, maxAmount: 5000 });
    for (let i = 0; i < 2; i++) nodes.push({ id: `i-${i}`, type: ResourceType.IRON, position: getSpawnPos(ResourceType.IRON, terrain), amount: 2000, maxAmount: 2000 });
    for (let i = 0; i < 1; i++) nodes.push({ id: `g-${i}`, type: ResourceType.GOLD, position: getSpawnPos(ResourceType.GOLD, terrain), amount: 500, maxAmount: 500 });

    // Initial Buildings: CENTRAL STORAGE
    const buildings: Building[] = [
        { id: 'base', type: 'STORAGE', position: center, level: 1, occupants: [] }
    ];

    // Initial Agents & Houses
    const agents: Agent[] = [];
    const initPop = 6;
    
    for (let i = 0; i < initPop; i++) {
        // Create Agent
        const agent: Agent = {
            id: `init-${i}`,
            position: { x: center.x + (Math.random() * 40 - 20), y: center.y + (Math.random() * 40 - 20) },
            target: null,
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

    // Create initial houses for them
    const housesNeeded = Math.ceil(initPop / HOUSE_CAPACITY);
    for(let h=0; h<housesNeeded; h++) {
         const pos = findConstructionSpot(center, buildings, 40);
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
        // Find a house
        let house = buildings.filter(b => b.type === 'HOUSE')[currentHouseIdx];
        if (!house) {
            currentHouseIdx = 0;
            house = buildings.filter(b => b.type === 'HOUSE')[0];
        }
        
        if (house) {
            agent.homeId = house.id;
            house.occupants = house.occupants || [];
            house.occupants.push(agent.id);
            if (house.occupants.length >= HOUSE_CAPACITY) currentHouseIdx++;
        }
    });


    return {
        resources: { FOOD: 50, WOOD: 100, STONE: 0, IRON: 0, GOLD: 0 }, // Start with some wood for walls/homes
        agents,
        buildings,
        nodes,
        terrain,
        generation: 1,
        populationPeak: initPop,
        totalTime: 0,
        disasterActive: false,
        disasterType: null,
        lore: ["第一批家庭建立了他们的家园，围绕着中心仓库开始了新的生活。"]
    };
};

export const tickSimulation = (state: GameState): GameState => {
    const newState = { ...state };
    
    // Initialize checks
    if (!newState.terrain || newState.terrain.length === 0) newState.terrain = generateTerrain();
    if (newState.resources.IRON === undefined) newState.resources.IRON = 0;
    if (newState.resources.GOLD === undefined) newState.resources.GOLD = 0;

    // Ensure center exists (fallback)
    let center = newState.buildings.find(b => b.type === 'STORAGE')?.position;
    if (!center && newState.buildings.length > 0) center = newState.buildings[0].position;
    if (!center) center = { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 };

    newState.totalTime += 1;

    // --- Production & Disaster (Simplified for brevity, same as before) ---
    if (newState.totalTime % 200 === 0) { 
        const farmCount = newState.buildings.filter(b => b.type === 'FARM').length;
        if (farmCount > 0) newState.resources.FOOD += farmCount * 5;
    }

    // Disaster
    if (!newState.disasterActive && Math.random() < 0.00002) { 
        newState.disasterActive = true;
        newState.disasterType = Math.random() > 0.5 ? 'EARTHQUAKE' : 'BLIZZARD';
        newState.lore.unshift(`警报：${newState.disasterType === 'EARTHQUAKE' ? '地震' : '暴风雪'}来袭！`);
    } else if (newState.disasterActive) {
        if (Math.random() < 0.005) { 
            newState.disasterActive = false;
            newState.disasterType = null;
        } else {
            // Damage logic
             if (newState.disasterType === 'EARTHQUAKE') {
                if (Math.random() < 0.01) {
                    // Chance to damage walls first
                    const walls = newState.buildings.filter(b => b.type === 'WALL');
                    if (walls.length > 0) {
                        const victimIdx = Math.floor(Math.random() * walls.length);
                        newState.buildings.splice(newState.buildings.indexOf(walls[victimIdx]), 1);
                    }
                }
            }
        }
    }

    // --- Resource Respawn ---
    newState.nodes.forEach(node => {
        if (node.amount < node.maxAmount && Math.random() < 0.01 && !newState.disasterActive) node.amount++;
        if (node.amount <= 0 && Math.random() < 0.001) {
            node.amount = node.type === ResourceType.GOLD ? 50 : 200;
            node.position = getSpawnPos(node.type, newState.terrain);
        }
    });

    // --- CITY PLANNING & BUILDING ---
    
    // 1. Identify Housing Needs (Homeless Agents)
    const houses = newState.buildings.filter(b => b.type === 'HOUSE');
    const homelessAgents = newState.agents.filter(a => !a.homeId || !houses.find(h => h.id === a.homeId));
    const housingCapacity = houses.length * HOUSE_CAPACITY;
    
    // Need new house if population exceeds capacity OR strictly if homeless exist
    const needsHouse = homelessAgents.length > 0;

    // 2. Build House (Priority: High if homeless)
    if (needsHouse && newState.resources.WOOD >= COSTS.HOUSE.WOOD && newState.resources.STONE >= COSTS.HOUSE.STONE) {
        newState.resources.WOOD -= COSTS.HOUSE.WOOD;
        newState.resources.STONE -= COSTS.HOUSE.STONE;
        
        // Concentric placement: Find spot relative to Center
        const pos = findConstructionSpot(center, newState.buildings, 40);
        
        const newHouse: Building = {
            id: `house-${newState.totalTime}`,
            type: 'HOUSE',
            position: pos,
            level: 1,
            occupants: []
        };
        newState.buildings.push(newHouse);

        // Assign homeless to this new house immediately
        const occupantsToAssign = homelessAgents.slice(0, HOUSE_CAPACITY);
        occupantsToAssign.forEach(a => {
            a.homeId = newHouse.id;
            newHouse.occupants!.push(a.id);
        });
    }

    // 3. Build Wall (Defensive Perimeter)
    // Only build walls if we have basic housing sorted and excess resources
    if (!needsHouse && newState.buildings.length > 5) {
        const useStone = newState.resources.STONE > 100;
        const costAmount = useStone ? COSTS.WALL_STONE.STONE : COSTS.WALL_WOOD.WOOD;
        const resourceKey = useStone ? 'STONE' : 'WOOD';
        
        const canAffordWall = newState.resources[resourceKey] >= costAmount;

        if (canAffordWall && Math.random() < 0.1) { // Build slowly
            // Determine perimeter radius
            // Find furthest non-wall building
            let maxDist = 0;
            newState.buildings.forEach(b => {
                if (b.type !== 'WALL') {
                    const d = dist(center!, b.position);
                    if (d > maxDist) maxDist = d;
                }
            });
            const wallRadius = maxDist + 40; // Padding
            
            // Attempt to build a wall segment on this radius
            // Scan a few random angles to fill gaps
            for(let i=0; i<5; i++) {
                const angle = Math.random() * Math.PI * 2;
                const wx = center!.x + Math.cos(angle) * wallRadius;
                const wy = center!.y + Math.sin(angle) * wallRadius;
                
                // Check if a wall is already nearby (prevent overlap, encourage ring)
                const nearbyWall = newState.buildings.find(b => b.type === 'WALL' && dist(b.position, {x:wx, y:wy}) < 20);
                if (!nearbyWall) {
                    // Check if it hits a resource or building
                    const blocked = newState.buildings.some(b => dist(b.position, {x:wx, y:wy}) < 15) ||
                                    newState.nodes.some(n => dist(n.position, {x:wx, y:wy}) < 15);
                    
                    if (!blocked) {
                        newState.resources[resourceKey] -= costAmount;
                        newState.buildings.push({
                            id: `wall-${newState.totalTime}`,
                            type: 'WALL',
                            position: {x: wx, y: wy},
                            level: useStone ? 2 : 1, // Level 1 = Wood, Level 2 = Stone
                        });
                        break; // Built one, stop for this tick
                    }
                }
            }
        }
    }

    // 4. Build Farm (Standard logic)
    if (newState.resources.WOOD >= COSTS.FARM.WOOD && newState.resources.STONE >= COSTS.FARM.STONE && Math.random() < 0.01) {
        if (newState.buildings.filter(b => b.type === 'FARM').length < newState.agents.length / 3) {
            newState.resources.WOOD -= COSTS.FARM.WOOD;
            newState.resources.STONE -= COSTS.FARM.STONE;
            const pos = findConstructionSpot(center, newState.buildings, 80); // Farms further out
            newState.buildings.push({
                id: `farm-${newState.totalTime}`,
                type: 'FARM',
                position: pos,
                level: 1
            });
        }
    }

    // --- Spawning Logic ---
    // Only spawn if we have capacity (empty slots in houses)
    const currentPop = newState.agents.length;
    const totalCapacity = newState.buildings.filter(b => b.type === 'HOUSE').length * HOUSE_CAPACITY;
    
    if (newState.resources.FOOD >= COSTS.SPAWN.FOOD && currentPop < totalCapacity) {
        newState.resources.FOOD -= COSTS.SPAWN.FOOD;
        // Find parent
        const parent = newState.agents[Math.floor(Math.random() * newState.agents.length)];
        const newStats = parent ? mutate(parent.stats) : { ...BASE_STATS };
        
        const newAgent: Agent = {
            id: `gen-${newState.totalTime}`,
            position: { ...center! },
            target: null,
            state: AgentState.IDLE,
            inventory: null,
            stats: newStats,
            energy: newStats.stamina,
            age: 0,
            gen: (parent?.gen || 0) + 1,
            color: parent ? parent.color : `hsl(${Math.random() * 360}, 70%, 60%)`,
            homeId: null
        };
        
        // Find home for baby
        const home = newState.buildings.find(b => b.type === 'HOUSE' && (b.occupants?.length || 0) < HOUSE_CAPACITY);
        if (home) {
            newAgent.homeId = home.id;
            home.occupants = home.occupants || [];
            home.occupants.push(newAgent.id);
        }

        newState.agents.push(newAgent);
        newState.populationPeak = Math.max(newState.populationPeak, newState.agents.length);
    }


    // --- Agent Loop ---
    newState.agents = newState.agents.filter(a => {
        const alive = a.age < a.stats.lifespan;
        if (!alive && a.homeId) {
             // Remove from home occupancy
             const home = newState.buildings.find(b => b.id === a.homeId);
             if (home && home.occupants) {
                 home.occupants = home.occupants.filter(oid => oid !== a.id);
             }
        }
        return alive;
    });

    // Anti-Extinction
    if (newState.agents.length < 2) {
        for(let i=0; i<2; i++) {
             newState.agents.push({
                id: `nomad-${newState.totalTime}-${i}`,
                position: { x: center!.x + (Math.random() * 100 - 50), y: center!.y + (Math.random() * 100 - 50) },
                target: null,
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
        if (agent.energy === undefined) agent.energy = agent.stats.stamina || 500;

        // Consumption
        if (agent.state !== AgentState.RESTING && agent.state !== AgentState.MOVING_HOME) {
            agent.energy -= 0.5; 
        }

        // Rest Logic: Go to OWN home
        if (agent.energy < (agent.stats.stamina * 0.3) && agent.state !== AgentState.RESTING && agent.state !== AgentState.MOVING_HOME && !newState.disasterActive) {
            agent.state = AgentState.MOVING_HOME;
            
            let homePos = center!; // Fallback
            if (agent.homeId) {
                const home = newState.buildings.find(b => b.id === agent.homeId);
                if (home) homePos = home.position;
                else {
                    // Home destroyed? Find new one
                    const newHome = newState.buildings.find(b => b.type === 'HOUSE' && (b.occupants?.length || 0) < HOUSE_CAPACITY);
                    if (newHome) {
                        agent.homeId = newHome.id;
                        newHome.occupants?.push(agent.id);
                        homePos = newHome.position;
                    }
                }
            }
            agent.target = homePos;
        }

        if (newState.disasterActive && Math.random() > agent.stats.resilience) {
             agent.state = AgentState.FLEEING;
        }

        // State Machine
        switch (agent.state) {
            case AgentState.FLEEING:
                if (dist(agent.position, center!) > 50) {
                     const angle = Math.atan2(center!.y - agent.position.y, center!.x - agent.position.x);
                     agent.position.x += Math.cos(angle) * agent.stats.speed * 1.5;
                     agent.position.y += Math.sin(angle) * agent.stats.speed * 1.5;
                } else if (!newState.disasterActive) {
                    agent.state = AgentState.IDLE;
                }
                break;

            case AgentState.RESTING:
                agent.energy += 5;
                if (agent.energy >= agent.stats.stamina) {
                    agent.energy = agent.stats.stamina;
                    agent.state = AgentState.IDLE;
                }
                break;

            case AgentState.MOVING_HOME:
                if (agent.target) {
                    const d = dist(agent.position, agent.target);
                    if (d < 10) {
                        agent.state = AgentState.RESTING;
                        agent.target = null;
                    } else {
                        const angle = Math.atan2(agent.target.y - agent.position.y, agent.target.x - agent.position.x);
                        agent.position.x += Math.cos(angle) * agent.stats.speed;
                        agent.position.y += Math.sin(angle) * agent.stats.speed;
                    }
                } else {
                    agent.state = AgentState.IDLE;
                }
                break;

            case AgentState.IDLE:
                // Decision making
                let targetType = ResourceType.FOOD;
                const foodStock = newState.resources.FOOD;
                const woodStock = newState.resources.WOOD;
                const stoneStock = newState.resources.STONE;
                
                if (foodStock > 100) targetType = ResourceType.WOOD;
                if (woodStock > 150) targetType = ResourceType.STONE;
                if (woodStock > 300 && stoneStock > 100 && Math.random() < 0.3) targetType = ResourceType.IRON;
                if (woodStock > 500 && Math.random() < 0.1) targetType = ResourceType.GOLD;

                // Find nearest node
                const nodes = newState.nodes.filter(n => n.type === targetType && n.amount > 0);
                if (nodes.length > 0) {
                    // Sort by distance
                    nodes.sort((a,b) => dist(agent.position, a.position) - dist(agent.position, b.position));
                    // Pick one of the closest to avoid stacking
                    const targetNode = nodes[Math.floor(Math.random() * Math.min(3, nodes.length))];
                    agent.target = targetNode.position;
                    agent.state = AgentState.MOVING_TO_RESOURCE;
                } else {
                     // Wander
                     const angle = Math.random() * Math.PI * 2;
                     agent.position.x += Math.cos(angle) * 5;
                     agent.position.y += Math.sin(angle) * 5;
                }
                break;

            case AgentState.MOVING_TO_RESOURCE:
                if (agent.target) {
                    if (dist(agent.position, agent.target) < 5) {
                        agent.state = AgentState.GATHERING;
                    } else {
                         const angle = Math.atan2(agent.target.y - agent.position.y, agent.target.x - agent.position.x);
                         agent.position.x += Math.cos(angle) * agent.stats.speed;
                         agent.position.y += Math.sin(angle) * agent.stats.speed;
                    }
                } else agent.state = AgentState.IDLE;
                break;

            case AgentState.GATHERING:
                const node = newState.nodes.find(n => dist(agent.position, n.position) < 15);
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
                    }
                } else {
                    agent.state = AgentState.RETURNING;
                    agent.target = center!;
                }
                break;

            case AgentState.RETURNING:
                if (dist(agent.position, agent.target || center!) < 10) {
                    if (agent.inventory) {
                        newState.resources[agent.inventory.type] += agent.inventory.amount;
                        agent.inventory = null;
                    }
                    agent.state = AgentState.IDLE;
                } else {
                     const angle = Math.atan2((agent.target?.y || center!.y) - agent.position.y, (agent.target?.x || center!.x) - agent.position.x);
                     agent.position.x += Math.cos(angle) * agent.stats.speed;
                     agent.position.y += Math.sin(angle) * agent.stats.speed;
                }
                break;
        }

        // Bounds
        agent.position.x = Math.max(0, Math.min(CANVAS_WIDTH, agent.position.x));
        agent.position.y = Math.max(0, Math.min(CANVAS_HEIGHT, agent.position.y));
    });

    return newState;
};
