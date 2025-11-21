
import { Agent, AgentState, Building, GameState, ResourceNode, ResourceType, Vector2, Stats } from "../types";
import { CANVAS_WIDTH, CANVAS_HEIGHT, COSTS, BASE_STATS, GRID_W, GRID_H, TILE_SIZE, HOUSE_CAPACITY, BUILDINGS_CONFIG, TERRAIN_MOUNTAIN, TERRAIN_WATER } from "../constants";

// 辅助函数：计算距离
const dist = (v1: Vector2, v2: Vector2) => Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));

// 辅助函数：地形生成与生物群落
export const generateTerrain = (): number[][] => {
    const map: number[][] = [];
    // 初始化噪声
    for (let y = 0; y < GRID_H; y++) {
        const row: number[] = [];
        for (let x = 0; x < GRID_W; x++) {
            row.push(Math.random());
        }
        map.push(row);
    }

    // 平滑处理 (增加迭代次数以形成更大的地块)
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

    // 增加对比度以形成明显的生物群落
    for(let y=0; y<GRID_H; y++) {
        for(let x=0; x<GRID_W; x++) {
            let val = map[y][x];
            val = (val - 0.5) * 2.0 + 0.5; 
            map[y][x] = Math.max(0, Math.min(1, val));
        }
    }

    return map;
};

// 检查坐标是否可通行
const isPassable = (x: number, y: number, terrain: number[][]): boolean => {
    if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) return false;
    const gx = Math.floor(x / TILE_SIZE);
    const gy = Math.floor(y / TILE_SIZE);
    if (gy < 0 || gy >= GRID_H || gx < 0 || gx >= GRID_W) return false;
    
    const val = terrain[gy][gx];
    return val > TERRAIN_WATER && val < TERRAIN_MOUNTAIN;
};

// 检查是否可以建造 (可通行 + 未被占用 + 半径检查)
const isBuildable = (x: number, y: number, terrain: number[][], radius: number = 5): boolean => {
    if (!isPassable(x, y, terrain)) return false;
    if (!isPassable(x - radius, y - radius, terrain)) return false;
    if (!isPassable(x + radius, y - radius, terrain)) return false;
    if (!isPassable(x - radius, y + radius, terrain)) return false;
    if (!isPassable(x + radius, y + radius, terrain)) return false;
    return true;
};

// 辅助函数：基于生物群落的随机生成点
const getSpawnPos = (type: ResourceType | 'ANY', terrain: number[][]): Vector2 => {
    let bestPos = { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 };
    let maxAttempts = 50;

    for (let i = 0; i < maxAttempts; i++) {
        const gx = Math.floor(Math.random() * (GRID_W - 2)) + 1;
        const gy = Math.floor(Math.random() * (GRID_H - 2)) + 1;
        const val = terrain[gy][gx];
        
        const px = gx * TILE_SIZE + (Math.random() * TILE_SIZE);
        const py = gy * TILE_SIZE + (Math.random() * TILE_SIZE);

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

// 辅助函数：寻找有效的建筑点 (螺旋搜索)
const findConstructionSpot = (center: Vector2, buildings: Building[], terrain: number[][], minRadius: number = 40): Vector2 => {
    let radius = minRadius;
    let angle = Math.random() * Math.PI * 2; 
    const maxRadius = 2000; 
    const angleStep = 0.5; 
    
    while (radius < maxRadius) {
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;
        
        if (x > 50 && x < CANVAS_WIDTH - 50 && y > 50 && y < CANVAS_HEIGHT - 50) {
             if (isBuildable(x, y, terrain, 15)) {
                 const collision = buildings.some(b => dist(b.position, {x,y}) < 25); 
                 if (!collision) {
                     return {x, y};
                 }
             }
        }
        
        angle += angleStep;
        if (angle > Math.PI * 2 + (Math.random() * 2)) { 
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
        lifespan: Infinity, // 永生
        resilience: Math.min(0.9, Math.max(0, parentStats.resilience + (Math.random() * 0.05 - 0.025))),
        stamina: Math.max(500, parentStats.stamina * (1 + (Math.random() * 0.2 - 0.1))),
    };
};

// --- 升级与属性计算 ---

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

// --- 寻路算法 (A*) ---

const getGridPos = (p: Vector2) => ({ x: Math.floor(p.x / TILE_SIZE), y: Math.floor(p.y / TILE_SIZE) });

const findPath = (start: Vector2, end: Vector2, terrain: number[][]): Vector2[] | null => {
    const startNode = getGridPos(start);
    const endNode = getGridPos(end);

    if (Math.abs(startNode.x - endNode.x) <= 1 && Math.abs(startNode.y - endNode.y) <= 1) return [end];

    // 简化版寻路：如果距离太远，直接直线走，避免卡顿
    if (dist(start, end) > 500) return [end];

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
    const MAX_ITERATIONS = 800; // 性能优化限制

    while (openList.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        let lowInd = 0;
        for(let i=1; i<openList.length; i++) {
            if(openList[i].f < openList[lowInd].f) { lowInd = i; }
        }
        const currentNode = openList[lowInd];

        if (Math.abs(currentNode.x - endNode.x) <= 1 && Math.abs(currentNode.y - endNode.y) <= 1) {
             const path: Vector2[] = [];
             let curr = currentNode;
             while(curr.parent) {
                 path.push({ 
                    x: curr.x * TILE_SIZE + TILE_SIZE/2, 
                    y: curr.y * TILE_SIZE + TILE_SIZE/2 
                 });
                 curr = curr.parent;
             }
             return path.reverse();
        }

        openList.splice(lowInd, 1);
        closedSet.add(currentNode.id);

        const neighbors = [
            {x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0},
            {x:-1, y:-1}, {x:1, y:-1}, {x:-1, y:1}, {x:1, y:1}
        ];

        for(let i=0; i<neighbors.length; i++) {
            const nx = currentNode.x + neighbors[i].x;
            const ny = currentNode.y + neighbors[i].y;
            
            if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
            
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
                neighbor.h = Math.abs(nx - endNode.x) + Math.abs(ny - endNode.y);
                neighbor.f = neighbor.g + neighbor.h;
                openList.push(neighbor);
            } else if (gScore < neighbor.g) {
                neighbor.g = gScore;
                neighbor.parent = currentNode;
                neighbor.f = neighbor.g + neighbor.h;
            }
        }
    }
    
    return [end];
};

// --- 移动辅助 ---
const moveAgentTowards = (agent: Agent, target: Vector2, terrain: number[][]) => {
    const dx = target.x - agent.position.x;
    const dy = target.y - agent.position.y;
    const distToTarget = Math.sqrt(dx*dx + dy*dy);
    
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

    if (isPassable(nextX, nextY, terrain)) {
        agent.position.x = nextX;
        agent.position.y = nextY;
    } else {
        // 简单的碰撞滑行
        let moved = false;
        if (isPassable(nextX, agent.position.y, terrain)) {
            agent.position.x = nextX;
            moved = true;
        } else if (isPassable(agent.position.x, nextY, terrain)) {
            agent.position.y = nextY;
            moved = true;
        }
        
        if (!moved) {
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

const followPath = (agent: Agent, finalTarget: Vector2, terrain: number[][]) => {
    if (!agent.path || agent.path.length === 0) {
        if (dist(agent.position, finalTarget) > TILE_SIZE) {
             agent.path = findPath(agent.position, finalTarget, terrain);
        } else {
             agent.path = [finalTarget];
        }
    }

    if (agent.path && agent.path.length > 0) {
        const nextWaypoint = agent.path[0];
        moveAgentTowards(agent, nextWaypoint, terrain);
        if (dist(agent.position, nextWaypoint) < Math.max(5, agent.stats.speed * 1.5)) {
            agent.path.shift();
        }
    } else {
        moveAgentTowards(agent, finalTarget, terrain);
    }
};


export const initializeGame = (): GameState => {
    const terrain = generateTerrain();
    
    let center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    let foundCenter = false;
    let r = 0, a = 0;
    while(!foundCenter && r < 800) {
        const cx = center.x + Math.cos(a) * r;
        const cy = center.y + Math.sin(a) * r;
        if (isBuildable(cx, cy, terrain, 20)) {
            center = {x: cx, y: cy};
            foundCenter = true;
        }
        a += 0.5;
        if (a > Math.PI*2) { a=0; r+=20; }
    }

    const nodes: ResourceNode[] = [];
    for (let i = 0; i < 8; i++) nodes.push({ id: `f-${i}`, type: ResourceType.FOOD, position: getSpawnPos(ResourceType.FOOD, terrain), amount: 2000, maxAmount: 2000 });
    for (let i = 0; i < 6; i++) nodes.push({ id: `w-${i}`, type: ResourceType.WOOD, position: getSpawnPos(ResourceType.WOOD, terrain), amount: 5000, maxAmount: 5000 });
    for (let i = 0; i < 5; i++) nodes.push({ id: `s-${i}`, type: ResourceType.STONE, position: getSpawnPos(ResourceType.STONE, terrain), amount: 5000, maxAmount: 5000 });
    for (let i = 0; i < 3; i++) nodes.push({ id: `i-${i}`, type: ResourceType.IRON, position: getSpawnPos(ResourceType.IRON, terrain), amount: 3000, maxAmount: 3000 });
    for (let i = 0; i < 2; i++) nodes.push({ id: `g-${i}`, type: ResourceType.GOLD, position: getSpawnPos(ResourceType.GOLD, terrain), amount: 1000, maxAmount: 1000 });

    const buildings: Building[] = [
        { id: 'base', type: 'STORAGE', position: center, level: 1, occupants: [] }
    ];

    const agents: Agent[] = [];
    const initPop = 6;
    
    // 初始房屋
    for(let h=0; h<initPop; h++) {
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

    for (let i = 0; i < initPop; i++) {
        const agent: Agent = {
            id: `init-${i}`,
            position: { x: center.x + (Math.random() * 20 - 10), y: center.y + (Math.random() * 20 - 10) },
            target: null,
            path: null,
            state: AgentState.IDLE,
            inventory: null,
            stats: { ...BASE_STATS, lifespan: Infinity },
            energy: BASE_STATS.stamina,
            age: 0,
            gen: 1,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`,
            homeId: `house-init-${i}`
        };
        const house = buildings.find(b => b.id === agent.homeId);
        if (house) {
            house.occupants = house.occupants || [];
            house.occupants.push(agent.id);
        }
        agents.push(agent);
    }

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
        lore: ["文明的火种已点燃，先驱者们在荒野中建立起第一个聚落。"],
        reproductionProgress: 0,
    };
};

// --- 智能任务选择 ---
const pickResourceTarget = (agent: Agent, state: GameState, needs: Record<ResourceType, number>): ResourceType => {
    // 加权随机选择算法
    const types = [ResourceType.FOOD, ResourceType.WOOD, ResourceType.STONE, ResourceType.IRON, ResourceType.GOLD];
    let totalWeight = 0;
    const weights: number[] = [];

    types.forEach(type => {
        // 基础权重：需求量 (0-10)
        let w = Math.max(0, needs[type]);
        
        // 距离修正：如果附近有该资源，稍微增加权重
        const nearestNode = state.nodes.find(n => n.type === type && n.amount > 0 && dist(agent.position, n.position) < 300);
        if (nearestNode) w *= 1.5;

        // 随机因子 (让个体有差异)
        w *= (0.8 + Math.random() * 0.4);

        weights.push(w);
        totalWeight += w;
    });

    if (totalWeight === 0) return ResourceType.FOOD;

    let random = Math.random() * totalWeight;
    for(let i=0; i<weights.length; i++) {
        random -= weights[i];
        if (random <= 0) return types[i];
    }
    return ResourceType.FOOD;
};

export const tickSimulation = (state: GameState): GameState => {
    const newState = { ...state };
    
    if (newState.reproductionProgress === undefined) newState.reproductionProgress = 0;
    if (!newState.terrain || newState.terrain.length === 0) newState.terrain = generateTerrain();
    if (newState.resources.IRON === undefined) newState.resources.IRON = 0;
    if (newState.resources.GOLD === undefined) newState.resources.GOLD = 0;

    let center = newState.buildings.find(b => b.type === 'STORAGE')?.position;
    if (!center && newState.buildings.length > 0) center = newState.buildings[0].position;
    if (!center) center = { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 };

    newState.totalTime += 1;
    const popCount = newState.agents.length;

    // --- 需求计算 (文明大脑) ---
    // 1. 生存需求: 每个人需要一定的食物储备
    const foodGoal = popCount * 30 + 200; 
    const foodNeed = Math.max(0, (foodGoal - newState.resources.FOOD) / 50); // 范围约 0 - 10+

    // 2. 建设需求: 检查我们是否能负担得起下一个建筑
    const farmCost = COSTS.FARM;
    const storageCost = COSTS.STORAGE;
    const wallCost = COSTS.WALL_WOOD;

    // 如果食物少，需要造农场，对木/石需求增加
    let woodNeed = 1; 
    let stoneNeed = 0.5;
    let ironNeed = 0.1;
    let goldNeed = 0.05;

    // 建筑优先级逻辑
    const numFarms = newState.buildings.filter(b => b.type === 'FARM').length;
    const numStorage = newState.buildings.filter(b => b.type === 'STORAGE').length;
    
    if (newState.resources.FOOD < foodGoal && numFarms < popCount / 2) {
        // 极度需要农场
        woodNeed += 5;
        stoneNeed += 2;
    }

    if (newState.resources.WOOD > 800 || newState.resources.STONE > 500) {
        // 资源快满了，需要仓库
        woodNeed += 3;
        stoneNeed += 3;
    }

    if (newState.resources.WOOD > 300 && newState.resources.STONE > 200) {
        // 资源富裕，可以搞防御和高级资源
        ironNeed += 2;
        goldNeed += 1;
        stoneNeed += 1; // 墙需要石/木
    }

    // 归一化需求权重
    const needs: Record<ResourceType, number> = {
        [ResourceType.FOOD]: Math.min(15, foodNeed * 2), // 食物始终是高优先级如果短缺
        [ResourceType.WOOD]: Math.min(10, woodNeed),
        [ResourceType.STONE]: Math.min(10, stoneNeed),
        [ResourceType.IRON]: Math.min(8, ironNeed),
        [ResourceType.GOLD]: Math.min(5, goldNeed)
    };


    // --- 生产 (农场) ---
    if (newState.totalTime % 200 === 0) { 
        const farms = newState.buildings.filter(b => b.type === 'FARM');
        let production = 0;
        farms.forEach(f => production += getFarmProduction(f));
        newState.resources.FOOD += production;
    }

    // --- 灾难系统 ---
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

    // --- 资源再生 ---
    newState.nodes.forEach(node => {
        if (node.amount < node.maxAmount && Math.random() < 0.01 && !newState.disasterActive) node.amount++;
        if (node.amount <= 0 && Math.random() < 0.001) {
            node.amount = node.type === ResourceType.GOLD ? 50 : 200;
            node.position = getSpawnPos(node.type, newState.terrain);
        }
    });

    const canAfford = (cost: {WOOD: number, STONE: number}, multiplier: number = 1) => 
        newState.resources.WOOD >= cost.WOOD * multiplier && newState.resources.STONE >= cost.STONE * multiplier;

    // --- 自动建造与升级逻辑 ---
    
    // 1. 农场建造 (基于人口压力)
    if (canAfford(COSTS.FARM)) {
        // 如果食物产出跟不上或者人口太多
        const idealFarms = Math.ceil(popCount / 2.5);
        if (numFarms < idealFarms) {
             newState.resources.WOOD -= COSTS.FARM.WOOD;
             newState.resources.STONE -= COSTS.FARM.STONE;
             const pos = findConstructionSpot(center, newState.buildings, newState.terrain, 60);
             newState.buildings.push({ id: `farm-${newState.totalTime}`, type: 'FARM', position: pos, level: 1 });
             newState.lore.unshift("居民们开垦了新的农田以应对人口增长。");
        }
    }

    // 2. 仓库建造/升级 (基于资源溢出)
    const storages = newState.buildings.filter(b => b.type === 'STORAGE');
    if (storages.length > 0) {
        // 升级优先
        const mainStorage = storages[0];
        const upgradeCost = getUpgradeCost('STORAGE', mainStorage.level);
        if (canAfford(upgradeCost)) {
            // 如果资源快满了，升级
            // 简化判定：只要资源足够多就尝试升级，增加宏伟感
            if (newState.resources.WOOD > 1000 && newState.resources.STONE > 500) {
                 newState.resources.WOOD -= upgradeCost.WOOD;
                 newState.resources.STONE -= upgradeCost.STONE;
                 mainStorage.level++;
                 newState.lore.unshift("主城堡进行了扩建，更加宏伟了。");
            }
        }
    }

    // 3. 住宅升级 (提升幸福感/容量 - 虽然现在是自动建房，但升级可以作为资源消耗口)
    if (newState.totalTime % 100 === 0) {
        const houses = newState.buildings.filter(b => b.type === 'HOUSE' && b.level < 3);
        if (houses.length > 0 && canAfford(COSTS.UPGRADE_HOUSE)) {
             const house = houses[Math.floor(Math.random() * houses.length)];
             newState.resources.WOOD -= COSTS.UPGRADE_HOUSE.WOOD;
             newState.resources.STONE -= COSTS.UPGRADE_HOUSE.STONE;
             house.level++;
        }
    }

    // 4. 防御工事 (富余资源)
    const walls = newState.buildings.filter(b => b.type === 'WALL');
    if (newState.resources.WOOD > 400 && newState.resources.STONE > 100) {
        // 尝试建造一圈墙
        if (Math.random() < 0.1) {
            let maxDist = 0;
            newState.buildings.forEach(b => { if (b.type !== 'WALL') maxDist = Math.max(maxDist, dist(center!, b.position)); });
            const wallRadius = Math.max(150, maxDist + 50); 
            
            for(let i=0; i<5; i++) { // 尝试几次找到合适位置
                const angle = Math.random() * Math.PI * 2;
                const wx = center!.x + Math.cos(angle) * wallRadius;
                const wy = center!.y + Math.sin(angle) * wallRadius;
                
                if (isBuildable(wx, wy, newState.terrain, 5)) {
                    const nearbyWall = walls.find(b => dist(b.position, {x:wx, y:wy}) < 15);
                    if (!nearbyWall) {
                        const blocked = newState.buildings.some(b => dist(b.position, {x:wx, y:wy}) < 15) ||
                                        newState.nodes.some(n => dist(n.position, {x:wx, y:wy}) < 15);
                        if (!blocked) {
                            if (newState.resources.STONE > COSTS.WALL_STONE.STONE) {
                                newState.resources.STONE -= COSTS.WALL_STONE.STONE;
                                newState.buildings.push({ id: `wall-s-${newState.totalTime}`, type: 'WALL', position: {x:wx,y:wy}, level: 2 });
                            } else {
                                newState.resources.WOOD -= COSTS.WALL_WOOD.WOOD;
                                newState.buildings.push({ id: `wall-w-${newState.totalTime}`, type: 'WALL', position: {x:wx,y:wy}, level: 1 });
                            }
                            break;
                        }
                    }
                }
            }
        }
    }


    // --- 繁殖 (累积进度) ---
    // 只有食物足够，人口才会增长
    const SAFETY_FOOD_BUFFER = 150;
    const GROWTH_RATE_PER_TICK = 0.8; 

    if (newState.resources.FOOD > SAFETY_FOOD_BUFFER) {
        newState.resources.FOOD -= GROWTH_RATE_PER_TICK;
        newState.reproductionProgress += GROWTH_RATE_PER_TICK;
    }

    if (newState.reproductionProgress >= COSTS.SPAWN.FOOD) {
             newState.reproductionProgress = 0; 
             
             // 1. 自动建房 (必须)
             const housePos = findConstructionSpot(center!, newState.buildings, newState.terrain, 40);
             const newHouse: Building = {
                 id: `house-${newState.totalTime}`,
                 type: 'HOUSE',
                 position: housePos,
                 level: 1,
                 occupants: []
             };
             newState.buildings.push(newHouse);

             // 2. 诞生新居民
             const parent = newState.agents[Math.floor(Math.random() * newState.agents.length)];
             const newStats = parent ? mutate(parent.stats) : { ...BASE_STATS, lifespan: Infinity };
             
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
                 homeId: newHouse.id
             };
             
             newHouse.occupants?.push(newAgent.id);
             newState.agents.push(newAgent);
             newState.populationPeak = Math.max(newState.populationPeak, newState.agents.length);
             
             if (newState.agents.length % 5 === 0) {
                 newState.lore.unshift(`人口突破 ${newState.agents.length} 人，新的家族诞生了。`);
             }
    }

    // --- Agent 循环 ---
    newState.agents.forEach(agent => {
        agent.age++;
        if (agent.energy === undefined) agent.energy = agent.stats.stamina;

        // 能量消耗
        if (agent.state !== AgentState.RESTING && agent.state !== AgentState.MOVING_HOME) agent.energy -= 0.5;

        // 休息逻辑
        if (agent.energy < (agent.stats.stamina * 0.2) && agent.state !== AgentState.RESTING && agent.state !== AgentState.MOVING_HOME && !newState.disasterActive) {
            agent.state = AgentState.MOVING_HOME;
            let homePos = center!; 
            if (agent.homeId) {
                const home = newState.buildings.find(b => b.id === agent.homeId);
                if (home) homePos = home.position;
            }
            agent.target = homePos;
            agent.path = null; 
        }

        // 灾难逃跑
        if (newState.disasterActive && Math.random() > agent.stats.resilience) {
            agent.state = AgentState.FLEEING;
            agent.path = null;
        }

        // 状态机
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
                agent.energy += 8; // 恢复速度
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
                // 智能选择目标
                const targetType = pickResourceTarget(agent, newState, needs);
                
                // 寻找对应资源节点
                const nodes = newState.nodes.filter(n => n.type === targetType && n.amount > 0);
                
                if (nodes.length > 0) {
                    // 寻找最近的几个节点中随机一个 (增加随机性避免所有人去抢同一个)
                    nodes.sort((a,b) => dist(agent.position, a.position) - dist(agent.position, b.position));
                    const targetNode = nodes[Math.floor(Math.random() * Math.min(3, nodes.length))];
                    agent.target = targetNode.position;
                    agent.path = null;
                    agent.state = AgentState.MOVING_TO_RESOURCE;
                } else {
                     // 如果找不到目标资源，随机游荡一下
                     const angle = Math.random() * Math.PI * 2;
                     const wx = agent.position.x + Math.cos(angle) * 30;
                     const wy = agent.position.y + Math.sin(angle) * 30;
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
                        agent.path = null; 
                    }
                } else {
                    agent.state = AgentState.IDLE; // 资源枯竭，重新寻找
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
