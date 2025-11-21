
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
        // Only regenerate if terrain data changes
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
                    // Deep water base
                    tCtx.fillStyle = val < 0.15 ? COLORS.DEEP_WATER : COLORS.WATER;
                    tCtx.fillRect(px, py, TILE_SIZE + 0.5, TILE_SIZE + 0.5);
                    
                    // Shoreline effect
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
                    // Forest vs Grass based on height/density
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
                // Forest Trees
                if (val > TERRAIN_FOREST_START && val < TERRAIN_FOREST_END) {
                    if ((x + y * 57) % 3 === 0) { // Pseudo-random pattern
                        tCtx.fillStyle = 'rgba(0,0,0,0.2)';
                        tCtx.beginPath();
                        tCtx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, 4, 0, Math.PI*2);
                        tCtx.fill();
                    }
                }
                // Mountain Peaks
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
        
        // Shadow/Glow
        ctx.shadowColor = agent.color;
        ctx.shadowBlur = 6;
        
        // Body
        ctx.fillStyle = agent.color;
        // Simple clean circle for head
        const bounce = isMoving ? Math.sin(time / 100 + parseInt(agent.id.split('-')[1] || '0')) * 2 : 0;
        
        ctx.beginPath(); 
        ctx.arc(0, -8 + bounce, 4, 0, Math.PI * 2); 
        ctx.fill();

        // Minimalist body line
        ctx.strokeStyle = agent.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -4 + bounce);
        ctx.lineTo(0, 2 + bounce);
        
        // Legs
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

        // Carried Item (Floating Orb)
        if (agent.inventory) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = COLORS[agent.inventory.type];
            ctx.beginPath(); ctx.arc(6, -12 + bounce, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 6;
        }

        // State Indicators
        if (agent.state === AgentState.RESTING) {
             ctx.shadowBlur = 0;
             ctx.fillStyle = '#e2e8f0';
             ctx.font = '10px monospace';
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

        // WALLS
        if (b.type === 'WALL') {
            const isStone = b.level > 1;
            ctx.fillStyle = isStone ? COLORS.WALL_STONE : COLORS.WALL_WOOD;
            ctx.fillRect(-8, -12, 16, 12);
            // Detail
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(-8, -12, 16, 2); // Top highlight
            if (isStone) { // Crenellations
                ctx.fillRect(-8, -15, 4, 3);
                ctx.fillRect(4, -15, 4, 3);
            }
            ctx.restore();
            return;
        }

        // BUILDINGS
        const color = b.type === 'HOUSE' ? COLORS.HOUSE : 
                      b.type === 'STORAGE' ? COLORS.STORAGE : 
                      b.type === 'FARM' ? COLORS.FARM : COLORS.TOWER;

        // Glow for high level
        if (b.level > 1) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 5 + b.level;
        }

        if (b.type === 'HOUSE') {
            // Modern A-Frame or Box
            ctx.fillStyle = '#1e293b'; // Dark structure
            ctx.fillRect(-10, -12, 20, 12);
            ctx.fillStyle = color; // Roof/Accent
            ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(0, -20); ctx.lineTo(12, -10); ctx.fill();
            // Door
            ctx.fillStyle = '#0f172a'; ctx.fillRect(-3, -6, 6, 6);
            
        } else if (b.type === 'STORAGE') {
            // Cylinder / Silo look
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-12, -15, 24, 15);
            ctx.fillStyle = color;
            ctx.fillRect(-12, -18, 24, 3); // Band
            // Stacked goods visualization
            const fillPct = Math.min(1, b.level / 5);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.3;
            ctx.fillRect(-10, -5, 20, -10 * fillPct);
            ctx.globalAlpha = 1;

        } else if (b.type === 'FARM') {
            // Plots
            ctx.fillStyle = '#3f6212'; // Dark soil
            ctx.fillRect(-14, -10, 28, 14);
            ctx.fillStyle = color;
            const rows = 3;
            for(let i=0; i<rows; i++) {
                const grow = Math.sin(time/800 + i) * 2;
                ctx.fillRect(-12 + (i*9), -6 - grow, 4, 4 + grow);
            }
        }

        // Level pips
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
        
        // Base
        ctx.fillStyle = COLORS[node.type];
        
        if (node.type === ResourceType.WOOD) {
            // Tree
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#451a03'; ctx.fillRect(-2, 0, 4, 8); // Trunk
            ctx.fillStyle = COLORS.WOOD; 
            ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(0, -12); ctx.lineTo(6, 2); ctx.fill(); // Pine style
            ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(0, -4); ctx.lineTo(8, 6); ctx.fill(); 
        } else if (node.type === ResourceType.STONE) {
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(-2, -2, 3, 0, Math.PI*2); ctx.fill();
        } else if (node.type === ResourceType.GOLD) {
            ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 2); ctx.lineTo(0, 8); ctx.lineTo(-6, 2); ctx.fill();
        } else {
            // Default Orb (Food/Iron)
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
            
            // 1. Draw Cached Terrain
            if (terrainRef.current) ctx.drawImage(terrainRef.current, 0, 0);
            
            // 2. Water Shimmer Overlay (Procedural)
            // We can't easily mask just the water here without complex compositing, 
            // but we can add subtle full-screen atmospherics or just skip for performance.
            // Let's try a very subtle cloud shadow effect
            /*
            const cloudOffset = (time / 100) % CANVAS_WIDTH;
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            // Simplified cloud shadows could go here
            */

            // 3. Sort Objects by Y for Pseudo-Depth
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

            // 4. Disaster Overlay
            if (gameState.disasterActive) {
                 ctx.save();
                 if (gameState.disasterType === 'BLIZZARD') {
                     ctx.fillStyle = 'rgba(255,255,255,0.15)'; 
                     ctx.fillRect(0,0,CANVAS_WIDTH, CANVAS_HEIGHT);
                     // Wind particles
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
            
            {gameState.disasterActive && (
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 
                                bg-red-500/20 backdrop-blur-md border border-red-500/50 
                                text-red-200 px-8 py-3 rounded-full animate-pulse 
                                text-lg font-bold tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.4)]
                                flex items-center gap-3">
                    <span className="animate-bounce">⚠</span>
                    {gameState.disasterType === 'EARTHQUAKE' ? 'EARTHQUAKE' : 'BLIZZARD'}
                    <span className="animate-bounce">⚠</span>
                </div>
            )}
        </div>
    );
};

export default GameCanvas;
