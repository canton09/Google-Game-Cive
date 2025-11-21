
import React, { useEffect, useRef } from 'react';
import { GameState, ResourceType } from '../types';
import { COLORS, GRID_H, GRID_W, CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, TERRAIN_MOUNTAIN, TERRAIN_WATER } from '../constants';

interface MiniMapProps {
    gameState: GameState;
}

const MiniMap: React.FC<MiniMapProps> = ({ gameState }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const width = canvas.width;
        const height = canvas.height;

        // Clear Background
        ctx.fillStyle = COLORS.WATER; 
        ctx.fillRect(0, 0, width, height);

        const scaleX = width / CANVAS_WIDTH;
        const scaleY = height / CANVAS_HEIGHT;
        const tileW = TILE_SIZE * scaleX;
        const tileH = TILE_SIZE * scaleY;

        // 1. Draw Terrain
        if (gameState.terrain) {
             for (let y = 0; y < GRID_H; y++) {
                for (let x = 0; x < GRID_W; x++) {
                    const val = gameState.terrain[y][x];
                    if (val >= TERRAIN_MOUNTAIN) {
                        ctx.fillStyle = COLORS.MOUNTAIN; 
                        ctx.fillRect(x * tileW, y * tileH, tileW + 0.5, tileH + 0.5);
                    } else if (val > TERRAIN_WATER) {
                         // Land
                         if (val < TERRAIN_WATER + 0.05) ctx.fillStyle = COLORS.SAND;
                         else ctx.fillStyle = val > 0.60 ? '#334155' : COLORS.GRASS;
                         ctx.fillRect(x * tileW, y * tileH, tileW + 0.5, tileH + 0.5);
                    }
                }
            }
        }

        // 2. Draw Resources
        gameState.nodes.forEach(node => {
            if (node.amount <= 0) return;
            ctx.fillStyle = COLORS[node.type];
            const r = node.type === ResourceType.GOLD ? 2 : 1.5;
            ctx.beginPath();
            ctx.arc(node.position.x * scaleX, node.position.y * scaleY, r, 0, Math.PI * 2);
            ctx.fill();
        });

        // 3. Draw Buildings
        gameState.buildings.forEach(b => {
            ctx.fillStyle = b.type === 'HOUSE' ? COLORS.HOUSE : 
                           b.type === 'STORAGE' ? COLORS.STORAGE : 
                           b.type === 'FARM' ? COLORS.FARM : COLORS.TOWER;
            const s = 3;
            ctx.fillRect((b.position.x * scaleX) - s/2, (b.position.y * scaleY) - s/2, s, s);
        });

        // 4. Draw Agents (Bright dots)
        ctx.fillStyle = '#ffffff';
        gameState.agents.forEach(a => {
            ctx.fillRect(a.position.x * scaleX, a.position.y * scaleY, 1, 1);
        });
        
        // Viewport border
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.strokeRect(0, 0, width, height);

    }, [gameState]);

    return (
        <canvas 
            ref={canvasRef} 
            width={280} 
            height={210} 
            className="w-full h-auto rounded border border-slate-700 bg-slate-950 shadow-md block"
        />
    );
};

export default MiniMap;
