import { Agent, AgentState, Building, GameState, ResourceNode, ResourceType, Vector2, Stats } from "../types";
import { CANVAS_WIDTH, CANVAS_HEIGHT, COSTS, BASE_STATS, MUTATION_RATE, GRID_W, GRID_H, TILE_SIZE } from "../constants";

// Helper: Distance
const dist = (v1: Vector2, v2: Vector2) => Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));

// Helper: Terrain Generation
export const generateTerrain = (): number[][] => {
    const map: number[][] = [];
    // 1. Init Random Noise
    for (let y = 0; y < GRID_H; y++) {
        const row: number[] = [];
        for (let x = 0; x < GRID_W; x++) {
            row.push(Math.random());
        }
        map.push(row);
    }

    // 2. Smooth (Cellular Automata-ish blur)
    // We do multiple passes to create distinct "blobs"
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
        // Update map for next pass
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

        // < 0.45 = Fertile (Food/Farm)
        // > 0.55 = Rocky (Stone/Iron)
        // Middle = Plains (Wood/Any)
        
        let valid = false;
        if (type === ResourceType.FOOD) {
            if (val < 0.48) valid = true; // Prefer fertile
        } else if (type === ResourceType.STONE || type === ResourceType.IRON) {
            if (val > 0.52) valid = true; // Prefer rocky
        } else if (type === ResourceType.GOLD) {
            if (val > 0.6) valid = true; // Very rocky/mountainous
        } else {
            // Wood or Agents: Avoid extreme rocks if possible, but mostly anywhere
            valid = true;
        }

        if (valid || i === maxAttempts - 1) {
            bestPos = { x: px, y: py };
            if (valid) break;
        }
    }
    return bestPos;
};

// Helper: Mutate Stats
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

    // Initial Buildings (Town Center)
    const buildings: Building[] = [
        { id: 'base', type: 'STORAGE', position: center, level: 1 }
    ];

    // Initial Agents
    const agents: Agent[] = [];
    for (let i = 0; i < 5; i++) {
        agents.push({
            id: `init-${i}`,
            position: { x: center.x + (Math.random() * 20 - 10), y: center.y + (Math.random() * 20 - 10) },
            target: null,
            state: AgentState.IDLE,
            inventory: null,
            stats: { ...BASE_STATS },
            energy: BASE_STATS.stamina,
            age: 0,
            gen: 1,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`
        });
    }

    return {
        resources: { FOOD: 50, WOOD: 0, STONE: 0, IRON: 0, GOLD: 0 },
        agents,
        buildings,
        nodes,
        terrain,
        generation: 1,
        populationPeak: 5,
        totalTime: 0,
        disasterActive: false,
        disasterType: null,
        lore: ["模拟开始了。第一批流浪者出现了。"]
    };
};

export const tickSimulation = (state: GameState): GameState => {
    const newState = { ...state };
    // Safety check for terrain if loading old save
    if (!newState.terrain || newState.terrain.length === 0) {
        newState.terrain = generateTerrain();
    }

    // Check and init new resources if they don't exist (migration)
    if (newState.resources.IRON === undefined) newState.resources.IRON = 0;
    if (newState.resources.GOLD === undefined) newState.resources.GOLD = 0;

    const center: Vector2 = newState.buildings[0]?.position || { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 };

    newState.totalTime += 1;

    // --- Farm Production ---
    if (newState.totalTime % 200 === 0) { // Farms produce slowly
        const farmCount = newState.buildings.filter(b => b.type === 'FARM').length;
        if (farmCount > 0) {
            newState.resources.FOOD += farmCount * 5;
        }
    }

    // --- Disaster Logic ---
    if (!newState.disasterActive && Math.random() < 0.0005) { // Small chance per tick
        newState.disasterActive = true;
        newState.disasterType = Math.random() > 0.5 ? 'EARTHQUAKE' : 'BLIZZARD';
        const disasterName = newState.disasterType === 'EARTHQUAKE' ? '地震' : '暴风雪';
        newState.lore.unshift(`一场灾难性的${disasterName}袭击了这片土地！`);
    } else if (newState.disasterActive) {
        if (Math.random() < 0.005) { 
            newState.disasterActive = false;
            newState.disasterType = null;
            newState.lore.unshift(`灾难已平息。重建工作开始。`);
        } else {
            if (newState.disasterType === 'BLIZZARD') {
                newState.nodes.forEach(n => {
                    if (n.type === ResourceType.FOOD && Math.random() < 0.05) n.amount = Math.max(0, n.amount - 1);
                });
            } else if (newState.disasterType === 'EARTHQUAKE') {
                newState.nodes.forEach(n => {
                    if (n.type === ResourceType.STONE && Math.random() < 0.05) n.amount = Math.max(0, n.amount - 5);
                });
            }
        }
    }

    // --- Resource Regeneration ---
    newState.nodes.forEach(node => {
        if (node.amount < node.maxAmount && Math.random() < 0.01 && !newState.disasterActive) {
            node.amount++;
        }
        if (node.amount <= 0 && Math.random() < 0.001) {
            // Respawn with base amount
            node.amount = node.type === ResourceType.GOLD ? 50 : 200;
            // Respawn in biome-appropriate location
            node.position = getSpawnPos(node.type, newState.terrain);
        }
    });

    // Maintain minimum resource nodes if depleted/missing
    const ensureResource = (type: ResourceType, count: number) => {
        const current = newState.nodes.filter(n => n.type === type).length;
        if (current < count) {
            newState.nodes.push({
                id: `${type.toLowerCase()}-${newState.totalTime}`,
                type: type,
                position: getSpawnPos(type, newState.terrain),
                amount: type === ResourceType.GOLD ? 500 : 2000,
                maxAmount: type === ResourceType.GOLD ? 500 : 2000
            });
        }
    };
    ensureResource(ResourceType.IRON, 2);
    ensureResource(ResourceType.GOLD, 1);


    // --- Building Logic ---
    const populationCap = 5 + (newState.buildings.filter(b => b.type === 'HOUSE').length * 5);
    
    // 1. Construct Houses (CLUSTERED)
    if (newState.resources.WOOD >= COSTS.HOUSE.WOOD && newState.resources.STONE >= COSTS.HOUSE.STONE && newState.agents.length >= populationCap) {
        newState.resources.WOOD -= COSTS.HOUSE.WOOD;
        newState.resources.STONE -= COSTS.HOUSE.STONE;
        
        // Find an anchor building to cluster around (House or Storage)
        const residentialBuildings = newState.buildings.filter(b => b.type === 'HOUSE' || b.type === 'STORAGE');
        const anchor = residentialBuildings.length > 0 
            ? residentialBuildings[Math.floor(Math.random() * residentialBuildings.length)]
            : { position: center };

        // Build close to anchor (Cluster)
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 20; // Very tight cluster
        
        newState.buildings.push({
            id: `house-${newState.totalTime}`,
            type: 'HOUSE',
            position: { 
                x: Math.max(20, Math.min(CANVAS_WIDTH-20, anchor.position.x + Math.cos(angle) * distance)), 
                y: Math.max(20, Math.min(CANVAS_HEIGHT-20, anchor.position.y + Math.sin(angle) * distance)) 
            },
            level: 1
        });
    }

    // 2. Construct Farms (Clustered or Outer Ring)
    if (newState.resources.WOOD >= COSTS.FARM.WOOD && newState.resources.STONE >= COSTS.FARM.STONE && Math.random() < 0.01) {
        if (newState.buildings.filter(b => b.type === 'FARM').length < newState.agents.length / 3) {
            newState.resources.WOOD -= COSTS.FARM.WOOD;
            newState.resources.STONE -= COSTS.FARM.STONE;
            
            // Farms slightly further out from center but still relative to town
            const randomOffset = { x: (Math.random() * 300) - 150, y: (Math.random() * 300) - 150 };
            newState.buildings.push({
                id: `farm-${newState.totalTime}`,
                type: 'FARM',
                position: { x: Math.max(20, Math.min(CANVAS_WIDTH-20, center.x + randomOffset.x)), y: Math.max(20, Math.min(CANVAS_HEIGHT-20, center.y + randomOffset.y)) },
                level: 1
            });
        }
    }

    // 3. Construct Towers (Prestige / Defense feel)
    if (newState.resources.STONE >= COSTS.TOWER.STONE && newState.resources.IRON >= COSTS.TOWER.IRON && Math.random() < 0.005) {
         newState.resources.STONE -= COSTS.TOWER.STONE;
         newState.resources.IRON -= COSTS.TOWER.IRON;
         // Towers go on periphery
         const angle = Math.random() * Math.PI * 2;
         const dist = 150 + Math.random() * 50;
         newState.buildings.push({
            id: `tower-${newState.totalTime}`,
            type: 'TOWER',
            position: { 
                x: Math.max(30, Math.min(CANVAS_WIDTH-30, center.x + Math.cos(angle) * dist)), 
                y: Math.max(30, Math.min(CANVAS_HEIGHT-30, center.y + Math.sin(angle) * dist)) 
            },
            level: 1
         });
    }

    // 4. Upgrade existing buildings (Auto-upgrade logic)
    if (newState.resources.WOOD >= COSTS.UPGRADE.WOOD * 1.5 && newState.resources.STONE >= COSTS.UPGRADE.STONE * 1.5 && !newState.disasterActive) {
        if (Math.random() < 0.02) { // Rate limit upgrades
             const upgradable = newState.buildings.filter(b => b.level < 3 && b.type !== 'FARM'); // Farms don't upgrade yet
             if (upgradable.length > 0) {
                 const target = upgradable[Math.floor(Math.random() * upgradable.length)];
                 newState.resources.WOOD -= COSTS.UPGRADE.WOOD;
                 newState.resources.STONE -= COSTS.UPGRADE.STONE;
                 target.level += 1;
                 target.lastLevelUpTime = newState.totalTime;
             }
        }
    }

    // --- Spawning Logic ---
    if (newState.resources.FOOD >= COSTS.SPAWN.FOOD && newState.agents.length < populationCap) {
        newState.resources.FOOD -= COSTS.SPAWN.FOOD;
        const parent = newState.agents[Math.floor(Math.random() * newState.agents.length)];
        const newStats = parent ? mutate(parent.stats) : { ...BASE_STATS };
        
        newState.agents.push({
            id: `gen-${newState.totalTime}`,
            position: { ...center },
            target: null,
            state: AgentState.IDLE,
            inventory: null,
            stats: newStats,
            energy: newStats.stamina,
            age: 0,
            gen: (parent?.gen || 0) + 1,
            color: parent ? parent.color : `hsl(${Math.random() * 360}, 70%, 60%)`
        });
        newState.generation = Math.max(newState.generation, (parent?.gen || 0) + 1);
    }
    newState.populationPeak = Math.max(newState.populationPeak, newState.agents.length);


    // --- Agent Loop ---
    newState.agents = newState.agents.filter(a => a.age < a.stats.lifespan);

    // Anti-Extinction: Nomads
    if (newState.agents.length < 2) {
        const missing = 2 - newState.agents.length;
        for(let i=0; i<missing; i++) {
             newState.agents.push({
                id: `nomad-${newState.totalTime}-${i}`,
                position: { x: center.x + (Math.random() * 200 - 100), y: center.y + (Math.random() * 200 - 100) },
                target: null,
                state: AgentState.IDLE,
                inventory: null,
                stats: { ...BASE_STATS },
                energy: BASE_STATS.stamina,
                age: 0,
                gen: newState.generation, 
                color: `hsl(${Math.random() * 360}, 70%, 60%)`
            });
        }
        if (Math.random() < 0.1) {
             newState.lore.unshift("流浪者加入了你的文明，延续了火种。");
        }
    }

    newState.agents.forEach(agent => {
        agent.age++;
        
        // Safety init for existing saves
        if (agent.energy === undefined) agent.energy = agent.stats.stamina || 500;
        if (!agent.stats.stamina) agent.stats.stamina = 500;

        // --- Energy Consumption ---
        if (agent.state !== AgentState.RESTING) {
            agent.energy -= 0.5; // Burn energy
        }

        // Check for rest need
        if (agent.energy <= 0 && agent.state !== AgentState.RESTING && agent.state !== AgentState.MOVING_HOME && !newState.disasterActive) {
            agent.state = AgentState.MOVING_HOME;
            // Find nearest house
            const homes = newState.buildings.filter(b => b.type === 'HOUSE' || b.type === 'STORAGE');
            if (homes.length > 0) {
                // Find closest
                let closest = homes[0];
                let minD = dist(agent.position, homes[0].position);
                for(const h of homes) {
                    const d = dist(agent.position, h.position);
                    if (d < minD) {
                        minD = d;
                        closest = h;
                    }
                }
                agent.target = closest.position;
            } else {
                agent.target = center;
            }
        }


        if (newState.disasterActive) {
             if (Math.random() > agent.stats.resilience) {
                 agent.age += 5; 
                 agent.state = AgentState.FLEEING;
             }
        }

        switch (agent.state) {
            case AgentState.FLEEING:
                if (dist(agent.position, center) > 50) {
                     const angle = Math.atan2(center.y - agent.position.y, center.x - agent.position.x);
                     agent.position.x += Math.cos(angle) * agent.stats.speed * 1.5;
                     agent.position.y += Math.sin(angle) * agent.stats.speed * 1.5;
                } else {
                    if (!newState.disasterActive) agent.state = AgentState.IDLE;
                }
                break;

            case AgentState.RESTING:
                agent.energy += 5; // Recover fast
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
                let targetType = ResourceType.FOOD;
                
                // Dynamic priorities
                const foodStock = newState.resources.FOOD;
                const woodStock = newState.resources.WOOD;
                const stoneStock = newState.resources.STONE;
                const pop = newState.agents.length;

                if (foodStock > pop * 25) targetType = ResourceType.WOOD;
                if (woodStock > 300 && stoneStock < 200) targetType = ResourceType.STONE;
                if (woodStock > 400 && stoneStock > 200 && Math.random() < 0.4) targetType = ResourceType.IRON;
                if (woodStock > 500 && Math.random() < 0.1) targetType = ResourceType.GOLD;

                const candidates = newState.nodes
                    .filter(n => n.type === targetType && n.amount > 0)
                    .map(n => ({ node: n, dist: dist(agent.position, n.position) }))
                    .sort((a, b) => a.dist - b.dist);
                
                const topN = 5;
                const choicePool = candidates.slice(0, topN);
                
                if (choicePool.length > 0) {
                    const choice = choicePool[Math.floor(Math.random() * choicePool.length)];
                    agent.target = choice.node.position;
                    agent.state = AgentState.MOVING_TO_RESOURCE;
                } else {
                     const angle = Math.random() * Math.PI * 2;
                     agent.position.x += Math.cos(angle) * 2;
                     agent.position.y += Math.sin(angle) * 2;
                }
                break;

            case AgentState.MOVING_TO_RESOURCE:
                if (agent.target) {
                    const d = dist(agent.position, agent.target);
                    if (d < 5) {
                        agent.state = AgentState.GATHERING;
                    } else {
                        const angle = Math.atan2(agent.target.y - agent.position.y, agent.target.x - agent.position.x);
                        agent.position.x += Math.cos(angle) * agent.stats.speed;
                        agent.position.y += Math.sin(angle) * agent.stats.speed;
                    }
                } else {
                    agent.state = AgentState.IDLE;
                }
                break;

            case AgentState.GATHERING:
                const node = newState.nodes.find(n => dist(agent.position, n.position) < 15);
                if (node && node.amount > 0) {
                    agent.inventory = agent.inventory || { type: node.type, amount: 0 };
                    let speedModifier = 1;
                    if (node.type === ResourceType.STONE) speedModifier = 0.8;
                    if (node.type === ResourceType.IRON) speedModifier = 0.6;
                    if (node.type === ResourceType.GOLD) speedModifier = 0.4;

                    const amountToTake = Math.min(agent.stats.gatheringSpeed * speedModifier, node.amount, agent.stats.maxCarry - agent.inventory.amount);
                    node.amount -= amountToTake;
                    agent.inventory.amount += amountToTake;

                    if (agent.inventory.amount >= agent.stats.maxCarry || node.amount <= 0) {
                        agent.state = AgentState.RETURNING;
                        // Return to nearest Storage or House that acts as dropoff?
                        // For now, just return to Center/Base to keep it simple, or find nearest STORAGE
                        const storages = newState.buildings.filter(b => b.type === 'STORAGE');
                        if (storages.length > 0) {
                             let closest = storages[0];
                             let minD = dist(agent.position, storages[0].position);
                             for(const s of storages) {
                                 const d = dist(agent.position, s.position);
                                 if (d < minD) { minD = d; closest = s; }
                             }
                             agent.target = closest.position;
                        } else {
                             agent.target = center;
                        }
                    }
                } else {
                    agent.state = AgentState.RETURNING;
                    agent.target = center;
                }
                break;

            case AgentState.RETURNING:
                // Check if we are close to our target (Storage)
                const d = dist(agent.position, agent.target || center);
                if (d < 10) {
                    if (agent.inventory) {
                        newState.resources[agent.inventory.type] += agent.inventory.amount;
                        agent.inventory = null;
                    }
                    agent.state = AgentState.IDLE;
                } else {
                    const angle = Math.atan2((agent.target?.y || center.y) - agent.position.y, (agent.target?.x || center.x) - agent.position.x);
                    agent.position.x += Math.cos(angle) * agent.stats.speed;
                    agent.position.y += Math.sin(angle) * agent.stats.speed;
                }
                break;
        }
        
        agent.position.x = Math.max(0, Math.min(CANVAS_WIDTH, agent.position.x));
        agent.position.y = Math.max(0, Math.min(CANVAS_HEIGHT, agent.position.y));
    });

    return newState;
};