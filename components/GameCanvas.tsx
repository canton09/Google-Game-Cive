
import React, { useEffect, useRef } from 'react';
import { GameState, Agent, Building, ResourceNode, AgentState, ResourceType } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, TILE_SIZE, GRID_W, GRID_H, TERRAIN_MOUNTAIN, TERRAIN_WATER, TERRAIN_SNOW, TERRAIN_SAND, TERRAIN_FOREST_START, TERRAIN_FOREST_END } from '../constants';

interface GameCanvasProps {
    gameState: GameState;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const terrainRef = useRef<HTMLCanvasElement | null>(null);
    const terrainVersionRef = useRef<number>(0); 

    // --- Terrain Rendering (Cached) ---
    useEffect(() => {
        if (terrainRef.current && terrainVersionRef.current === gameState.generation && gameState.totalTime > 10) return; 
        if (!gameState.terrain || gameState.terrain.length === 0) return;

        if (!terrainRef.current) {
             const offscreen = document.createElement('canvas');
             offscreen.width = CANVAS_WIDTH;
             offscreen.height = CANVAS_HEIGHT;
             terrainRef.current = offscreen;
        }
        
        const tCtx = terrainRef.current!.getContext('2d');
        if (!tCtx) return;

        // Clear
        tCtx.fillStyle = COLORS.DEEP_WATER; 
        tCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        for (let y = 0; y < GRID_H; y++) {
            for (let x = 0; x < GRID_W; x++) {
                const val = gameState.terrain[y][x];
                const px = x * TILE_SIZE;
                const py = y * TILE_SIZE;

                // --- Water Logic ---
                if (val <= TERRAIN_WATER) {
                    tCtx.fillStyle = val < 0.15 ? COLORS.DEEP_WATER : COLORS.WATER;
                    tCtx.fillRect(px, py, TILE_SIZE + 0.5, TILE_SIZE + 0.5);
                    if (val > TERRAIN_WATER - 0.05) {
                        tCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                        tCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    }
                    continue;
                }

                // --- Land Logic ---
                if (val < TERRAIN_SAND) {
                    tCtx.fillStyle = COLORS.SAND;
                } else if (val < TERRAIN_MOUNTAIN) {
                    if (val > TERRAIN_FOREST_START && val < TERRAIN_FOREST_END) {
                        tCtx.fillStyle = COLORS.FOREST;
                    } else {
                        tCtx.fillStyle = COLORS.GRASS;
                    }
                } else if (val < TERRAIN_SNOW) {
                    tCtx.fillStyle = COLORS.ROCK;
                } else {
                    tCtx.fillStyle = COLORS.SNOW;
                }

                tCtx.fillRect(px, py, TILE_SIZE + 0.5, TILE_SIZE + 0.5);

                // --- Texture Details ---
                if (val > TERRAIN_FOREST_START && val < TERRAIN_FOREST_END) {
                    if ((x + y * 57) % 3 === 0) { 
                        tCtx.fillStyle = 'rgba(0,0,0,0.2)';
                        tCtx.beginPath();
                        tCtx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, 4, 0, Math.PI*2);
                        tCtx.fill();
                    }
                }
                if (val >= TERRAIN_MOUNTAIN && val < TERRAIN_SNOW) {
                     tCtx.fillStyle = 'rgba(255,255,255,0.05)';
                     tCtx.beginPath(); tCtx.moveTo(px, py+TILE_SIZE); tCtx.lineTo(px+TILE_SIZE, py); tCtx.stroke();
                }
            }
        }
        terrainVersionRef.current = gameState.generation; 
    }, [gameState.terrain]);

    // --- Dynamic Drawing Helpers ---

    const drawAgent = (ctx: CanvasRenderingContext2D, agent: Agent, time: number) => {
        const { x, y } = agent.position;
        const isMoving = agent.state !== AgentState.IDLE && agent.state !== AgentState.RESTING;
        
        ctx.save();
        ctx.translate(x, y);
        
        ctx.shadowColor = agent.color;
        ctx.shadowBlur = 6;
        
        ctx.fillStyle = agent.color;
        const bounce = isMoving ? Math.sin(time / 100 + parseInt(agent.id.split('-')[1] || '0')) * 2 : 0;
        
        ctx.beginPath(); 
        ctx.arc(0, -8 + bounce, 4, 0, Math.PI * 2); 
        ctx.fill();

        ctx.strokeStyle = agent.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -4 + bounce);
        ctx.lineTo(0, 2 + bounce);
        
        if (isMoving) {
            const walk = Math.sin(time / 60 + parseInt(agent.id));
            ctx.lineTo(-3 * walk, 8 + bounce);
            ctx.moveTo(0, 2 + bounce);
            ctx.lineTo(3 * walk, 8 + bounce);
        } else {
            ctx.lineTo(-2, 8 + bounce);
            ctx.moveTo(0, 2 + bounce);
            ctx.lineTo(2, 8 + bounce);
        }
        ctx.stroke();

        if (agent.inventory) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = COLORS[agent.inventory.type];
            ctx.beginPath(); ctx.arc(6, -12 + bounce, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 6;
        }

        if (agent.state === AgentState.RESTING) {
             ctx.shadowBlur = 0;
             ctx.fillStyle = '#e2e8f0';
             ctx.font = '18px monospace';
             const zOffset = (time / 20) % 30;
             ctx.globalAlpha = Math.max(0, 1 - (zOffset / 30));
             ctx.fillText("z", 5, -15 - zOffset/2);
             ctx.globalAlpha = 1.0;
        }
        
        ctx.restore();
    };

    const drawBuilding = (ctx: CanvasRenderingContext2D, b: Building, time: number) => {
        const { x, y } = b.position;
        ctx.save();
        ctx.translate(x, y);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(0, 5, 12, 6, 0, 0, Math.PI*2); ctx.fill();

        if (b.type === 'STORAGE') {
            // --- MAJESTIC CASTLE ---
            ctx.fillStyle = '#4c1d95';
            ctx.fillRect(-25, -20, 50, 20);
            
            ctx.fillStyle = COLORS.STORAGE;
            ctx.fillRect(-18, -45, 36, 45);
            
            ctx.fillStyle = '#5b21b6';
            ctx.fillRect(-30, -30, 12, 30);
            ctx.fillRect(18, -30, 12, 30);
            
            ctx.fillStyle = '#c084fc'; 
            ctx.fillRect(-18, -45, 6, 4);
            ctx.fillRect(-6, -45, 6, 4);
            ctx.fillRect(6, -45, 6, 4);
            
            ctx.fillStyle = '#fcd34d';
            ctx.beginPath(); ctx.moveTo(-30, -30); ctx.lineTo(-24, -45); ctx.lineTo(-18, -30); ctx.fill();
            ctx.beginPath(); ctx.moveTo(18, -30); ctx.lineTo(24, -45); ctx.lineTo(30, -30); ctx.fill();
            
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath(); ctx.moveTo(-18, -45); ctx.lineTo(0, -70); ctx.lineTo(18, -45); ctx.fill();
            
            ctx.fillStyle = '#0f172a';
            ctx.beginPath(); ctx.arc(0, 0, 10, Math.PI, 0); ctx.fill();
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, -85); ctx.stroke();
            ctx.fillStyle = '#ef4444';
            ctx.beginPath(); ctx.moveTo(0, -85); ctx.lineTo(12, -78); ctx.lineTo(0, -71); ctx.fill();

            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 15;
            ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
            ctx.beginPath(); ctx.arc(0, -30, 40, 0, Math.PI*2); ctx.fill();

            ctx.restore();
            return;
        }

        if (b.type === 'WALL') {
            const isStone = b.level > 1;
            ctx.fillStyle = isStone ? COLORS.WALL_STONE : COLORS.WALL_WOOD;
            ctx.fillRect(-8, -12, 16, 12);
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(-8, -12, 16, 2);
            if (isStone) { 
                ctx.fillRect(-8, -15, 4, 3);
                ctx.fillRect(4, -15, 4, 3);
            }
            ctx.restore();
            return;
        }

        const color = b.type === 'HOUSE' ? COLORS.HOUSE : 
                      b.type === 'FARM' ? COLORS.FARM : COLORS.TOWER;

        if (b.level > 1) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 5 + b.level;
        }

        if (b.type === 'HOUSE') {
            ctx.fillStyle = '#1e293b'; 
            ctx.fillRect(-10, -12, 20, 12);
            ctx.fillStyle = color; 
            ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(0, -20); ctx.lineTo(12, -10); ctx.fill();
            ctx.fillStyle = '#0f172a'; ctx.fillRect(-3, -6, 6, 6);
            
        } else if (b.type === 'FARM') {
            ctx.fillStyle = '#3f6212'; 
            ctx.fillRect(-14, -10, 28, 14);
            ctx.fillStyle = color;
            const rows = 3;
            for(let i=0; i<rows; i++) {
                const grow = Math.sin(time/800 + i) * 2;
                ctx.fillRect(-12 + (i*9), -6 - grow, 4, 4 + grow);
            }
        }

        if (b.level > 1) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fbbf24';
            const pips = Math.min(b.level, 5);
            for(let i=0; i<pips; i++) {
                ctx.fillRect(-8 + (i*4), -25, 2, 2);
            }
        }

        ctx.restore();
    };

    const drawNode = (ctx: CanvasRenderingContext2D, node: ResourceNode, time: number) => {
        if (node.amount <= 0) return;
        const { x, y } = node.position;
        const scale = 0.6 + (node.amount / node.maxAmount) * 0.4;
        
        ctx.save(); 
        ctx.translate(x, y); 
        ctx.scale(scale, scale);

        ctx.shadowColor = COLORS[node.type];
        ctx.shadowBlur = 10;
        
        ctx.fillStyle = COLORS[node.type];
        
        if (node.type === ResourceType.WOOD) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#451a03'; ctx.fillRect(-2, 0, 4, 8); 
            ctx.fillStyle = COLORS.WOOD; 
            ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(0, -12); ctx.lineTo(6, 2); ctx.fill(); 
            ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(0, -4); ctx.lineTo(8, 6); ctx.fill(); 
        } else if (node.type === ResourceType.STONE) {
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(-2, -2, 3, 0, Math.PI*2); ctx.fill();
        } else if (node.type === ResourceType.GOLD) {
            ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 2); ctx.lineTo(0, 8); ctx.lineTo(-6, 2); ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill();
        }

        ctx.restore();
    };

    useEffect(() => {
        let animationFrameId: number;
        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const time = Date.now();

            ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            
            if (terrainRef.current) ctx.drawImage(terrainRef.current, 0, 0);
            
            const renderList = [
                ...gameState.nodes.map(n => ({ type: 'node', y: n.position.y, data: n })),
                ...gameState.buildings.map(b => ({ type: 'building', y: b.position.y, data: b })),
                ...gameState.agents.map(a => ({ type: 'agent', y: a.position.y, data: a }))
            ].sort((a, b) => a.y - b.y);

            renderList.forEach(item => {
                if (item.type === 'node') drawNode(ctx, item.data as ResourceNode, time);
                if (item.type === 'building') drawBuilding(ctx, item.data as Building, time);
                if (item.type === 'agent') drawAgent(ctx, item.data as Agent, time);
            });

            if (gameState.disasterActive) {
                 ctx.save();
                 if (gameState.disasterType === 'BLIZZARD') {
                     ctx.fillStyle = 'rgba(255,255,255,0.15)'; 
                     ctx.fillRect(0,0,CANVAS_WIDTH, CANVAS_HEIGHT);
                     ctx.fillStyle = '#fff';
                     for(let i=0; i<20; i++) {
                         const px = (time * 0.5 + i * 100) % CANVAS_WIDTH;
                         const py = (time * 0.2 + i * 137) % CANVAS_HEIGHT;
                         ctx.fillRect(px, py, 2, 1);
                     }
                 } else if (gameState.disasterType === 'EARTHQUAKE') {
                     const shakeX = Math.random() * 4 - 2;
                     const shakeY = Math.random() * 4 - 2;
                     ctx.translate(shakeX, shakeY);
                 }
                 ctx.restore();
            }

            animationFrameId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [gameState]);

    return (
        <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-white/5 bg-[#020617]">
            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block w-full h-full object-cover" />
        </div>
    );
};

export default GameCanvas;
