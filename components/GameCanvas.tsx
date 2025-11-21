
import React, { useEffect, useRef } from 'react';
import { GameState, Agent, Building, ResourceNode, AgentState, ResourceType } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, TILE_SIZE, GRID_W, GRID_H, TERRAIN_MOUNTAIN, TERRAIN_WATER } from '../constants';

interface GameCanvasProps {
    gameState: GameState;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const terrainRef = useRef<HTMLCanvasElement | null>(null);
    const terrainVersionRef = useRef<number>(0); 

    // --- Terrain Rendering ---
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

        // Base fill
        tCtx.fillStyle = COLORS.WATER; 
        tCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        for (let y = 0; y < GRID_H; y++) {
            for (let x = 0; x < GRID_W; x++) {
                const val = gameState.terrain[y][x];
                const px = x * TILE_SIZE;
                const py = y * TILE_SIZE;

                if (val >= TERRAIN_MOUNTAIN) {
                    // Mountain
                     tCtx.fillStyle = COLORS.MOUNTAIN; 
                     tCtx.fillRect(px, py, TILE_SIZE + 0.5, TILE_SIZE + 0.5);
                     // Highlights
                     tCtx.strokeStyle = '#334155';
                     tCtx.beginPath(); tCtx.moveTo(px, py+TILE_SIZE); tCtx.lineTo(px+TILE_SIZE, py); tCtx.stroke();
                } else if (val <= TERRAIN_WATER) {
                    // Water (Already filled background, but explicit draw for clarity if needed)
                    tCtx.fillStyle = COLORS.WATER;
                    tCtx.fillRect(px, py, TILE_SIZE + 0.5, TILE_SIZE + 0.5);
                    // Ripple effect
                    if (Math.random() > 0.9) {
                        tCtx.fillStyle = 'rgba(255,255,255,0.1)';
                        tCtx.fillRect(px + 4, py + 8, 8, 2);
                    }
                } else {
                    // Land (Grass/Forest)
                    // Gradient based on height?
                    if (val > 0.55) tCtx.fillStyle = '#1e293b'; // Rocky/Hills
                    else if (val < 0.42) tCtx.fillStyle = '#064e3b'; // Deep Forest
                    else tCtx.fillStyle = '#065f46'; // Grass

                    tCtx.fillRect(px, py, TILE_SIZE + 0.5, TILE_SIZE + 0.5);
                    
                    // Texture
                    if (val < 0.42 && Math.random() > 0.6) {
                        // Forest trees
                        tCtx.fillStyle = 'rgba(0,0,0,0.2)'; 
                        tCtx.beginPath(); tCtx.moveTo(px+10, py+4); tCtx.lineTo(px+4, py+16); tCtx.lineTo(px+16, py+16); tCtx.fill();
                    }
                }
            }
        }
        terrainVersionRef.current = gameState.generation; 
    }, [gameState.terrain]);

    // Helper: Draw Humanoid
    const drawAgent = (ctx: CanvasRenderingContext2D, agent: Agent, time: number) => {
        const { x, y } = agent.position;
        const isMoving = agent.state === AgentState.MOVING_TO_RESOURCE || agent.state === AgentState.RETURNING || agent.state === AgentState.FLEEING || agent.state === AgentState.MOVING_HOME;
        
        ctx.save();
        ctx.translate(x, y);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(0, 3, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();

        // Body
        ctx.fillStyle = agent.color;
        ctx.strokeStyle = agent.color;
        ctx.lineWidth = 2;

        const bounce = isMoving ? Math.sin(time / 100 + parseInt(agent.id.split('-')[1] || '0')) * 2 : 0;
        
        ctx.beginPath(); ctx.arc(0, -12 + bounce, 3, 0, Math.PI * 2); ctx.fill(); // Head
        ctx.beginPath(); ctx.moveTo(0, -9 + bounce); ctx.lineTo(0, -2 + bounce); ctx.stroke(); // Torso

        // Legs
        ctx.beginPath();
        if (isMoving) {
            const walkCycle = Math.sin(time / 50 + parseInt(agent.id));
            ctx.moveTo(0, -2 + bounce); ctx.lineTo(-3 * walkCycle, 5 + bounce);
            ctx.moveTo(0, -2 + bounce); ctx.lineTo(3 * walkCycle, 5 + bounce);
        } else {
            ctx.moveTo(0, -2 + bounce); ctx.lineTo(-2, 5 + bounce);
            ctx.moveTo(0, -2 + bounce); ctx.lineTo(2, 5 + bounce);
        }
        ctx.stroke();

        // Arms
        ctx.beginPath();
        if (agent.inventory) {
            ctx.moveTo(0, -8 + bounce); ctx.lineTo(4, -6 + bounce); 
            ctx.moveTo(0, -8 + bounce); ctx.lineTo(-4, -6 + bounce); 
            ctx.fillStyle = COLORS[agent.inventory.type];
            ctx.beginPath(); ctx.arc(0, -14 + bounce, 2.5, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.moveTo(0, -8 + bounce); ctx.lineTo(-3, -3 + bounce);
            ctx.moveTo(0, -8 + bounce); ctx.lineTo(3, -3 + bounce);
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

        // HOME MOVING INDICATOR
        if (agent.state === AgentState.MOVING_HOME) {
             const bubbleY = -28 + bounce;
             ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
             ctx.beginPath(); ctx.roundRect(-10, bubbleY - 12, 20, 16, 4); ctx.fill();
             ctx.beginPath(); ctx.moveTo(0, bubbleY + 4); ctx.lineTo(-3, bubbleY + 2); ctx.lineTo(3, bubbleY + 2); ctx.fill();
             ctx.fillStyle = '#ec4899';
             ctx.beginPath(); ctx.moveTo(0, bubbleY - 10); ctx.lineTo(-6, bubbleY - 4); ctx.lineTo(6, bubbleY - 4); ctx.fill();
             ctx.fillRect(-4, bubbleY - 4, 8, 6);
        }
        
        ctx.restore();
    };

    const drawBuilding = (ctx: CanvasRenderingContext2D, b: Building, time: number) => {
        const { x, y } = b.position;
        ctx.save();
        ctx.translate(x, y);

        // LEVEL BADGE
        if (b.level > 1) {
            ctx.fillStyle = '#fbbf24';
            for(let i=0; i<b.level; i++) {
                 ctx.beginPath(); ctx.arc(-8 + (i*5), -40, 1.5, 0, Math.PI*2); ctx.fill();
            }
        }

        // WALL RENDERING
        if (b.type === 'WALL') {
            const isStone = b.level > 1;
            ctx.fillStyle = isStone ? '#475569' : '#78350f'; 
            ctx.fillRect(-6, -12, 12, 12);
            ctx.fillStyle = isStone ? '#64748b' : '#92400e';
            ctx.fillRect(-6, -14, 12, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(0, 1, 8, 3, 0, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            return;
        }

        // FOUNDATION
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        if (b.type === 'HOUSE') {
             ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(14, -5); ctx.lineTo(20, 10); ctx.lineTo(-4, 10); ctx.fill();
             ctx.fillStyle = COLORS.HOUSE; 
             const width = 16 + (b.level * 2);
             ctx.fillRect(-width/2, -12, width, 12);
             const roofHeight = 10 + (b.level * 3);
             ctx.fillStyle = '#be185d'; 
             ctx.beginPath(); 
             ctx.moveTo(-width/2 - 2, -12); 
             ctx.lineTo(0, -12 - roofHeight); 
             ctx.lineTo(width/2 + 2, -12); 
             ctx.fill();
             ctx.fillStyle = '#334155'; ctx.fillRect(-3, -5, 6, 5);
        
        } else if (b.type === 'FARM') {
             ctx.fillStyle = 'rgba(40, 60, 20, 0.5)'; ctx.fillRect(-15, -15, 30, 30);
             const rows = 2 + Math.min(3, b.level);
             const cols = 2 + Math.min(3, b.level);
             ctx.fillStyle = COLORS.FARM;
             for(let r=0; r<rows; r++) for(let c=0; c<cols; c++) {
                 const ch = 4 + (Math.sin(time/1000 + r+c)*2);
                 const spacing = 20 / rows;
                 const ox = -12 + c * spacing;
                 const oy = -12 + r * spacing;
                 ctx.fillRect(ox, oy - ch, 3, ch);
                 ctx.fillStyle = '#fef08a'; ctx.fillRect(ox-1, oy - ch - 2, 5, 3); ctx.fillStyle = COLORS.FARM;
             }
        } else if (b.type === 'STORAGE') {
             ctx.fillStyle = COLORS.STORAGE; 
             const baseW = 24 + (b.level * 2);
             ctx.fillRect(-baseW/2, -10, baseW, 10);
             ctx.fillStyle = '#7c3aed'; ctx.fillRect(-(baseW+4)/2, -12, baseW+4, 4);
             ctx.fillStyle = '#4c1d95'; ctx.fillRect(-8, -6, 6, 6);
             const pulse = Math.sin(time / 400) * 0.5 + 0.5; 
             ctx.fillStyle = `rgba(221, 214, 254, ${pulse * 0.8 + 0.2})`; 
             ctx.beginPath(); ctx.arc(0, -14 - (b.level), 3 + (b.level), 0, Math.PI * 2); ctx.fill();
        } else if (b.type === 'TOWER') {
             ctx.fillStyle = COLORS.TOWER; ctx.fillRect(-6, -30, 12, 30);
             ctx.fillStyle = '#475569'; ctx.fillRect(-8, -10, 16, 10);
             ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-7, -34, 14, 6);
        }

        ctx.restore();
    };

    const drawNode = (ctx: CanvasRenderingContext2D, node: ResourceNode, time: number) => {
        if (node.amount <= 0) return;
        const { x, y } = node.position;
        const scale = 0.5 + (node.amount / node.maxAmount) * 0.5;
        ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
        
        ctx.save(); ctx.scale(1, 0.6); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(0, 5, 12, 0, Math.PI*2); ctx.fill(); ctx.restore();

        if (node.type === ResourceType.WOOD) {
            ctx.fillStyle = '#78350f'; ctx.fillRect(-2, -4, 4, 8);
            ctx.fillStyle = COLORS.WOOD; ctx.beginPath(); ctx.arc(0, -10, 12, 0, Math.PI * 2); ctx.fill();
        } else if (node.type === ResourceType.STONE) {
            ctx.fillStyle = COLORS.STONE; ctx.beginPath(); ctx.moveTo(-8, 5); ctx.lineTo(-4, -6); ctx.lineTo(2, -8); ctx.lineTo(8, 4); ctx.lineTo(0, 8); ctx.fill();
            ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(0, -2); ctx.lineTo(2, -8); ctx.fill();
        } else if (node.type === ResourceType.IRON) {
            ctx.fillStyle = COLORS.IRON; ctx.fillRect(-8, -2, 10, 8);
            ctx.fillStyle = '#a1a1aa'; ctx.fillRect(-4, -8, 8, 10);
        } else if (node.type === ResourceType.GOLD) {
             ctx.fillStyle = COLORS.GOLD; ctx.beginPath(); 
             for(let i=0; i<5; i++) { const a = (i/5)*Math.PI*2; ctx.lineTo(Math.cos(a)*8, Math.sin(a)*8); } ctx.fill();
        } else {
            ctx.fillStyle = '#14532d'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = COLORS.FOOD; ctx.beginPath(); ctx.arc(-3, -3, 2, 0, Math.PI*2); ctx.fill();
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
            else { ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); }

            // Sort for depth
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
                     ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0,0,CANVAS_WIDTH, CANVAS_HEIGHT);
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
            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block" />
            {gameState.disasterActive && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-2 rounded-full animate-pulse text-sm font-bold tracking-widest shadow-lg border border-red-400">
                    ⚠ {gameState.disasterType === 'EARTHQUAKE' ? '地震' : '暴风雪'}
                </div>
            )}
        </div>
    );
};

export default GameCanvas;
