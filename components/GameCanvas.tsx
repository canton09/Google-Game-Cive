import React, { useEffect, useRef } from 'react';
import { GameState, Agent, Building, ResourceNode, AgentState, ResourceType } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, TILE_SIZE, GRID_W, GRID_H } from '../constants';

interface GameCanvasProps {
    gameState: GameState;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const terrainRef = useRef<HTMLCanvasElement | null>(null);
    const terrainVersionRef = useRef<number>(0); // Track if we need to redraw terrain

    // --- Terrain Rendering (Optimized) ---
    useEffect(() => {
        // Only regenerate offscreen terrain if it doesn't exist or if we loaded a new map
        // Simple check: if we have terrain data but no image, or if we force it.
        // Since terrain is static per session usually, we just check if current matches.
        if (terrainRef.current && terrainVersionRef.current === gameState.generation && gameState.totalTime > 10) return; 
        
        // Initial render or re-render if strictly needed
        if (!gameState.terrain || gameState.terrain.length === 0) return;

        if (!terrainRef.current) {
             const offscreen = document.createElement('canvas');
             offscreen.width = CANVAS_WIDTH;
             offscreen.height = CANVAS_HEIGHT;
             terrainRef.current = offscreen;
        }
        
        const tCtx = terrainRef.current!.getContext('2d');
        if (!tCtx) return;

        // Fill Base
        tCtx.fillStyle = '#0f172a'; // Slate 900
        tCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        for (let y = 0; y < GRID_H; y++) {
            for (let x = 0; x < GRID_W; x++) {
                const val = gameState.terrain[y][x];
                const px = x * TILE_SIZE;
                const py = y * TILE_SIZE;

                if (val > 0.6) {
                     // --- MOUNTAIN/GOLD BIOME (> 0.6) ---
                     tCtx.fillStyle = '#0f172a'; // Darkest Slate
                     tCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                     // Cracks
                     tCtx.strokeStyle = '#334155';
                     tCtx.beginPath();
                     tCtx.moveTo(px, py+TILE_SIZE);
                     tCtx.lineTo(px+TILE_SIZE, py);
                     tCtx.stroke();
                } else if (val > 0.52) {
                    // --- ROCKY BIOME (> 0.52) ---
                    tCtx.fillStyle = '#1e293b'; // Slate 800
                    tCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    
                    // Detail: Stone pebbles
                    if (Math.random() > 0.7) {
                        tCtx.fillStyle = '#334155'; // Slate 700
                        const s = Math.random() * 5 + 2;
                        tCtx.fillRect(px + Math.random() * (TILE_SIZE - s), py + Math.random() * (TILE_SIZE - s), s, s);
                    }
                } else if (val < 0.45) {
                    // --- FERTILE BIOME (< 0.45) ---
                    tCtx.fillStyle = '#0f2926'; // Deep Dark Green
                    tCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

                    // Detail: Grass bits
                    if (Math.random() > 0.6) {
                        tCtx.strokeStyle = 'rgba(16, 185, 129, 0.2)'; // Emerald faint
                        tCtx.lineWidth = 1;
                        tCtx.beginPath();
                        const gx = px + Math.random() * TILE_SIZE;
                        const gy = py + Math.random() * TILE_SIZE;
                        tCtx.moveTo(gx, gy);
                        tCtx.lineTo(gx - 1, gy - 3);
                        tCtx.stroke();
                    }
                } else {
                    // --- PLAINS BIOME (0.45 - 0.52) ---
                    // Standard ground, keep dark
                    if ((x + y) % 2 === 0 && Math.random() > 0.5) {
                        tCtx.fillStyle = 'rgba(255,255,255,0.02)';
                        tCtx.fillRect(px + 8, py + 8, 2, 2);
                    }
                }
            }
        }
        
        terrainVersionRef.current = gameState.generation; // Just a marker to prevent running every frame
    }, [gameState.terrain]);

    // Helper: Draw Humanoid
    const drawAgent = (ctx: CanvasRenderingContext2D, agent: Agent, time: number) => {
        const { x, y } = agent.position;
        const isMoving = agent.state === AgentState.MOVING_TO_RESOURCE || agent.state === AgentState.RETURNING || agent.state === AgentState.FLEEING || agent.state === AgentState.MOVING_HOME;
        
        ctx.save();
        ctx.translate(x, y);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 3, 5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body/Color
        ctx.fillStyle = agent.color;
        ctx.strokeStyle = agent.color;
        ctx.lineWidth = 2;

        // Bobbing animation
        const bounce = isMoving ? Math.sin(time / 100 + parseInt(agent.id.split('-')[1] || '0')) * 2 : 0;
        
        // Head
        ctx.beginPath();
        ctx.arc(0, -12 + bounce, 3, 0, Math.PI * 2);
        ctx.fill();

        // Torso
        ctx.beginPath();
        ctx.moveTo(0, -9 + bounce);
        ctx.lineTo(0, -2 + bounce);
        ctx.stroke();

        // Legs
        ctx.beginPath();
        if (isMoving) {
            const walkCycle = Math.sin(time / 50 + parseInt(agent.id));
            ctx.moveTo(0, -2 + bounce);
            ctx.lineTo(-3 * walkCycle, 5 + bounce);
            ctx.moveTo(0, -2 + bounce);
            ctx.lineTo(3 * walkCycle, 5 + bounce);
        } else {
            ctx.moveTo(0, -2 + bounce);
            ctx.lineTo(-2, 5 + bounce);
            ctx.moveTo(0, -2 + bounce);
            ctx.lineTo(2, 5 + bounce);
        }
        ctx.stroke();

        // Arms
        ctx.beginPath();
        if (agent.inventory) {
            ctx.moveTo(0, -8 + bounce);
            ctx.lineTo(4, -6 + bounce); 
            ctx.moveTo(0, -8 + bounce); 
            ctx.lineTo(-4, -6 + bounce); 
            
            // Held item (Visual in arms)
            ctx.fillStyle = COLORS[agent.inventory.type];
            ctx.beginPath();
            ctx.arc(0, -14 + bounce, 2.5, 0, Math.PI * 2); 
            ctx.fill();
        } else {
            ctx.moveTo(0, -8 + bounce);
            ctx.lineTo(-3, -3 + bounce);
            ctx.moveTo(0, -8 + bounce);
            ctx.lineTo(3, -3 + bounce);
        }
        ctx.stroke();

        // RESTING INDICATOR
        if (agent.state === AgentState.RESTING) {
             ctx.fillStyle = '#e2e8f0';
             const zOffset = (time / 20) % 20;
             ctx.font = '10px monospace';
             ctx.globalAlpha = 1 - (zOffset / 20);
             ctx.fillText("Z", 6, -15 - zOffset);
             ctx.fillText("z", 10, -20 - zOffset);
             ctx.globalAlpha = 1.0;
        }

        // --- Resource Indicator (Above Head) ---
        if (agent.inventory && agent.inventory.amount > 0) {
            const percent = Math.min(1, agent.inventory.amount / agent.stats.maxCarry);
            const bubbleY = -26 + bounce; // Position above head

            // Background bubble
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; 
            ctx.beginPath();
            ctx.roundRect(-10, bubbleY - 10, 20, 14, 4);
            ctx.fill();
            
            // Border
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Icon
            ctx.fillStyle = COLORS[agent.inventory.type];
            
            if (agent.inventory.type === ResourceType.FOOD) {
                ctx.beginPath(); ctx.arc(0, bubbleY - 4, 3, 0, Math.PI * 2); ctx.fill();
            } else if (agent.inventory.type === ResourceType.WOOD) {
                ctx.fillRect(-3, bubbleY - 7, 6, 6);
            } else if (agent.inventory.type === ResourceType.STONE) {
                ctx.beginPath(); ctx.moveTo(0, bubbleY - 8); ctx.lineTo(4, bubbleY - 2); ctx.lineTo(-4, bubbleY - 2); ctx.fill();
            } else if (agent.inventory.type === ResourceType.IRON) {
                ctx.fillRect(-3, bubbleY - 6, 6, 4); // Bar
            } else if (agent.inventory.type === ResourceType.GOLD) {
                ctx.beginPath(); ctx.moveTo(0, bubbleY - 8); ctx.lineTo(3, bubbleY - 4); ctx.lineTo(0, bubbleY); ctx.lineTo(-3, bubbleY - 4); ctx.fill();
            }

            // Progress Bar (Amount)
            const barW = 14;
            const barH = 2;
            const barX = -7;
            const barY = bubbleY + 1;
            
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(barX, barY, barW, barH);
            
            ctx.fillStyle = COLORS[agent.inventory.type];
            ctx.fillRect(barX, barY, barW * percent, barH);
        }

        ctx.restore();
    };

    // Helper: Draw Foundation (Ground under building)
    const drawFoundation = (ctx: CanvasRenderingContext2D, b: Building) => {
        const { x, y } = b.position;
        ctx.save();
        ctx.translate(x, y);
        
        if (b.type === 'HOUSE') {
            ctx.fillStyle = 'rgba(60, 40, 30, 0.6)';
            ctx.beginPath();
            ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (b.type === 'FARM') {
            ctx.fillStyle = 'rgba(40, 60, 20, 0.5)';
            ctx.fillRect(-15, -15, 30, 30);
            ctx.strokeStyle = 'rgba(100, 150, 50, 0.3)';
            ctx.strokeRect(-15, -15, 30, 30);
        } else if (b.type === 'TOWER') {
             ctx.fillStyle = 'rgba(20, 20, 20, 0.6)';
             ctx.beginPath();
             ctx.ellipse(0, 2, 12, 6, 0, 0, Math.PI * 2);
             ctx.fill();
        } else {
            ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
            ctx.fillRect(-16, -12, 32, 24);
        }
        ctx.restore();
    };

    // Helper: Draw Building
    const drawBuilding = (ctx: CanvasRenderingContext2D, b: Building, time: number) => {
        const { x, y } = b.position;
        ctx.save();
        ctx.translate(x, y);

        const ticksSinceLevelUp = gameState.totalTime - (b.lastLevelUpTime || -999);
        const isLevelingUp = ticksSinceLevelUp >= 0 && ticksSinceLevelUp < 60;
        
        if (isLevelingUp) {
            const progress = ticksSinceLevelUp / 60;
            const scale = 1 + Math.sin(progress * Math.PI) * 0.2;
            ctx.scale(scale, scale);
        }

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        
        if (b.type === 'HOUSE') {
            // Shadow
            ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(14, -5); ctx.lineTo(20, 10); ctx.lineTo(-4, 10); ctx.fill();

            ctx.fillStyle = COLORS.HOUSE; 
            ctx.fillRect(-8, -12, 16, 12);
            
            const roofHeight = 10 + (b.level * 2);
            ctx.fillStyle = '#be185d'; 
            ctx.beginPath();
            ctx.moveTo(-10, -12);
            ctx.lineTo(0, -12 - roofHeight);
            ctx.lineTo(10, -12);
            ctx.fill();
            
            ctx.fillStyle = '#334155';
            ctx.fillRect(-3, -5, 6, 5);
            
            if (b.level > 1) {
                ctx.fillStyle = '#881337';
                ctx.fillRect(4, -18, 4, 6); 
            }

        } else if (b.type === 'FARM') {
             // Crops
             const growth = (time % 2000) / 2000;
             ctx.fillStyle = COLORS.FARM;
             for(let r=0; r<3; r++) {
                 for(let c=0; c<3; c++) {
                     const ch = 4 + (Math.sin(time/1000 + r+c)*2);
                     ctx.fillRect(-12 + c*10, -12 + r*10 - ch, 4, ch);
                     // wheat head
                     ctx.fillStyle = '#fef08a'; // yellow
                     ctx.fillRect(-13 + c*10, -14 + r*10 - ch, 6, 3);
                     ctx.fillStyle = COLORS.FARM;
                 }
             }
        } else if (b.type === 'TOWER') {
             // Tall structure
             ctx.fillStyle = COLORS.TOWER;
             ctx.fillRect(-6, -30, 12, 30);
             // Base
             ctx.fillStyle = '#475569';
             ctx.fillRect(-8, -10, 16, 10);
             // Top
             ctx.fillStyle = '#cbd5e1';
             ctx.fillRect(-7, -34, 14, 6);
             // Light
             ctx.fillStyle = '#ef4444';
             if (Math.floor(time / 500) % 2 === 0) {
                 ctx.beginPath(); ctx.arc(0, -36, 2, 0, Math.PI*2); ctx.fill();
             }

        } else {
            // STORAGE
            ctx.fillStyle = COLORS.STORAGE; 
            ctx.fillRect(-12, -10, 24, 10);
            ctx.fillStyle = '#7c3aed';
            ctx.fillRect(-14, -12, 28, 4);
            
            ctx.fillStyle = '#4c1d95';
            ctx.fillRect(-8, -6, 6, 6);
            if (b.level > 1) ctx.fillRect(2, -6, 6, 6);
            if (b.level > 2) ctx.fillRect(-3, -16, 6, 4);

            const pulse = Math.sin(time / 400) * 0.5 + 0.5; 
            ctx.fillStyle = `rgba(221, 214, 254, ${pulse * 0.8 + 0.2})`; 
            ctx.beginPath(); ctx.arc(0, -12, 2 + (b.level), 0, Math.PI * 2); ctx.fill();
        }

        // Level Up Particles (Generic)
        if (isLevelingUp) {
             const progress = ticksSinceLevelUp / 60;
             ctx.fillStyle = '#fcd34d'; 
             for(let i=0; i < 5; i++) {
                 const pX = (Math.random() - 0.5) * 30; 
                 const pY = -15 - (progress * 40) - (Math.random() * 20); 
                 const size = (1 - progress) * 4;
                 if (size > 0) {
                     ctx.globalAlpha = (1 - progress);
                     ctx.beginPath(); ctx.rect(pX, pY, size, size); ctx.fill();
                 }
             }
             ctx.globalAlpha = 1.0;
        }

        ctx.restore();
    };

    // Helper: Draw Resource Node
    const drawNode = (ctx: CanvasRenderingContext2D, node: ResourceNode, time: number) => {
        if (node.amount <= 0) return;
        const { x, y } = node.position;
        const scale = 0.5 + (node.amount / node.maxAmount) * 0.5;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        // Ground patch
        ctx.save();
        ctx.scale(1, 0.6); 
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.arc(0, 5, 12, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        if (node.type === ResourceType.WOOD) {
            ctx.fillStyle = '#78350f'; 
            ctx.fillRect(-2, -4, 4, 8);
            ctx.fillStyle = COLORS.WOOD;
            ctx.beginPath(); ctx.arc(0, -10, 12, 0, Math.PI * 2); ctx.fill();
            
            const sway = Math.sin(time / 500 + x) * 2;
            ctx.globalCompositeOperation = 'source-atop'; 
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath(); ctx.arc(sway, -12, 8, 0, Math.PI * 2); ctx.fill();

        } else if (node.type === ResourceType.STONE) {
            ctx.fillStyle = COLORS.STONE;
            ctx.beginPath();
            ctx.moveTo(-8, 5); ctx.lineTo(-4, -6); ctx.lineTo(2, -8); ctx.lineTo(8, 4); ctx.lineTo(0, 8);
            ctx.fill();
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(0, -2); ctx.lineTo(2, -8); ctx.fill();

        } else if (node.type === ResourceType.IRON) {
            ctx.fillStyle = COLORS.IRON;
            // Cubist metallic rocks
            ctx.fillRect(-8, -2, 10, 8);
            ctx.fillStyle = '#a1a1aa'; // Lighter
            ctx.fillRect(-4, -8, 8, 10);
            ctx.fillStyle = '#52525b'; // Darker side
            ctx.fillRect(4, -2, 2, 8);

        } else if (node.type === ResourceType.GOLD) {
             ctx.fillStyle = COLORS.GOLD;
             // Spiky shiny clusters
             ctx.beginPath();
             for(let i=0; i<5; i++) {
                 const angle = (i / 5) * Math.PI * 2;
                 const r = 8;
                 ctx.lineTo(Math.cos(angle)*r, Math.sin(angle)*r);
                 ctx.lineTo(Math.cos(angle + 0.5)*r*0.4, Math.sin(angle + 0.5)*r*0.4);
             }
             ctx.fill();
             
             // Sparkle
             if (Math.random() < 0.1) {
                 ctx.fillStyle = 'white';
                 ctx.fillRect(-2, -15, 4, 4);
             }

        } else {
            // FOOD
            ctx.fillStyle = '#14532d'; 
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.arc(-6, 4, 8, 0, Math.PI * 2); ctx.arc(6, 4, 8, 0, Math.PI * 2); ctx.fill();
            
            ctx.fillStyle = COLORS.FOOD;
            ctx.beginPath(); ctx.arc(-3, -3, 2, 0, Math.PI * 2); ctx.arc(4, -2, 2, 0, Math.PI * 2); ctx.arc(0, 4, 2.5, 0, Math.PI * 2); ctx.fill();
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

            // Clear & Draw Static Terrain
            ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            if (terrainRef.current) {
                ctx.drawImage(terrainRef.current, 0, 0);
            } else {
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            }

            // Agent Targets
            ctx.globalAlpha = 0.1;
            ctx.strokeStyle = '#cbd5e1';
            ctx.setLineDash([2, 4]);
            gameState.agents.forEach(agent => {
                if (agent.target && agent.state !== AgentState.IDLE && agent.state !== AgentState.RESTING) {
                    ctx.beginPath();
                    ctx.moveTo(agent.position.x, agent.position.y);
                    ctx.lineTo(agent.target.x, agent.target.y);
                    ctx.stroke();
                }
            });
            ctx.setLineDash([]);
            ctx.globalAlpha = 1.0;

            gameState.buildings.forEach(b => drawFoundation(ctx, b));

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

            // Disaster Effects
            if (gameState.disasterActive) {
                ctx.save();
                if (gameState.disasterType === 'EARTHQUAKE') {
                    const shakeX = Math.random() * 4 - 2;
                    const shakeY = Math.random() * 4 - 2;
                    ctx.translate(shakeX, shakeY);
                    
                    ctx.fillStyle = 'rgba(120, 113, 108, 0.4)';
                    for (let i = 0; i < 10; i++) {
                         ctx.beginPath();
                         ctx.arc(Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT, Math.random() * 10 + 5, 0, Math.PI * 2);
                         ctx.fill();
                    }
                } else if (gameState.disasterType === 'BLIZZARD') {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                    
                    ctx.fillStyle = 'white';
                    for(let i=0; i<100; i++) {
                        const snowX = (Math.random() * CANVAS_WIDTH + time/5) % CANVAS_WIDTH;
                        const snowY = (Math.random() * CANVAS_HEIGHT + time/2) % CANVAS_HEIGHT;
                        ctx.fillRect(snowX, snowY, 2, 2);
                    }
                }
                ctx.restore();
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationFrameId);

    }, [gameState]);

    return (
        <div className="relative rounded-lg overflow-hidden shadow-2xl border border-slate-700 bg-slate-800">
            <canvas 
                ref={canvasRef} 
                width={CANVAS_WIDTH} 
                height={CANVAS_HEIGHT}
                className="block"
            />
            {gameState.disasterActive && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-2 rounded-full animate-pulse text-sm font-bold tracking-widest shadow-lg border border-red-400">
                    ⚠ 事件: {gameState.disasterType === 'EARTHQUAKE' ? '地震' : '暴风雪'}
                </div>
            )}
        </div>
    );
};

export default GameCanvas;