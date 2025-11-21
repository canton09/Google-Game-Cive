
import React, { useEffect, useRef } from 'react';
import { GameState, ResourceType } from '../types';
import { COLORS, GRID_H, GRID_W, CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, TERRAIN_MOUNTAIN, TERRAIN_WATER, TERRAIN_SNOW } from '../constants';

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

        // Background
        ctx.fillStyle = COLORS.DEEP_WATER; 
        ctx.fillRect(0, 0, width, height);

        const scaleX = width / CANVAS_WIDTH;
        const scaleY = height / CANVAS_HEIGHT;
        const tileW = TILE_SIZE * scaleX;
        const tileH = TILE_SIZE * scaleY;

        // 1. Terrain
        if (gameState.terrain) {
             for (let y = 0; y < GRID_H; y++) {
                for (let x = 0; x < GRID_W; x++) {
                    const val = gameState.terrain[y][x];
                    const px = x * tileW;
                    const py = y * tileH;

                    if (val > TERRAIN_SNOW) ctx.fillStyle = COLORS.SNOW;
                    else if (val >= TERRAIN_MOUNTAIN) ctx.fillStyle = COLORS.ROCK;
                    else if (val > TERRAIN_WATER) ctx.fillStyle = val > 0.45 ? COLORS.FOREST : COLORS.GRASS;
                    else if (val > 0.2) ctx.fillStyle = COLORS.WATER;
                    else ctx.fillStyle = COLORS.DEEP_WATER;

                    // Only draw if not deep water for optimization/clean look
                    if (val > 0.2) ctx.fillRect(px, py, tileW + 0.2, tileH + 0.2);
                }
            }
        }

        // 2. Agents (Bright dots)
        ctx.fillStyle = '#38bdf8'; // Sky blue
        gameState.agents.forEach(a => {
            ctx.fillRect(a.position.x * scaleX, a.position.y * scaleY, 1.5, 1.5);
        });

        // 3. Buildings
        gameState.buildings.forEach(b => {
            ctx.fillStyle = b.type === 'HOUSE' ? COLORS.HOUSE : 
                           b.type === 'STORAGE' ? COLORS.STORAGE : 
                           b.type === 'FARM' ? COLORS.FARM : '#fff';
            ctx.fillRect((b.position.x * scaleX) - 1, (b.position.y * scaleY) - 1, 2, 2);
        });
        
        // Scanline effect
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        for(let i=0; i<height; i+=2) ctx.fillRect(0, i, width, 1);

    }, [gameState]);

    return (
        <canvas 
            ref={canvasRef} 
            width={280} 
            height={210} 
            className="w-full h-auto bg-[#020617] block opacity-90"
        />
    );
};

export default MiniMap;
