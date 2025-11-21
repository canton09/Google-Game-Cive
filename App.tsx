
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Activity, Box, Database, Users, Zap, TrendingUp, Home, Wheat, Package, Shield, Heart, Clock, Menu, X, Globe, Baby } from 'lucide-react';
import GameCanvas from './components/GameCanvas';
import MiniMap from './components/MiniMap';
import { initializeGame, tickSimulation, generateTerrain } from './services/simulation';
import { generateLore } from './services/geminiService';
import { GameState } from './types';
import { GRID_W, GRID_H, COSTS } from './constants';

const OFFLINE_CALCULATION_LIMIT = 3600 * 12; 

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initializeGame());
  const [lastSaved, setLastSaved] = useState<number>(Date.now());
  const [showSidebar, setShowSidebar] = useState(false);

  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem('evociv_save_v2'); // Changed key to reset for new terrain version
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const now = Date.now();
        const diffSeconds = Math.min((now - parsed.timestamp) / 1000, OFFLINE_CALCULATION_LIMIT);
        
        let loadedState = parsed.state;

        // Validation/Migration
        if (!loadedState.terrain || loadedState.terrain.length !== GRID_H) {
            loadedState.terrain = generateTerrain();
        }
        
        // Migration: Ensure reproductionProgress exists
        if (loadedState.reproductionProgress === undefined) {
            loadedState.reproductionProgress = 0;
        }

        // Offline Progress
        if (diffSeconds > 60) {
          loadedState.resources.FOOD += diffSeconds * 0.5;
          loadedState.resources.WOOD += diffSeconds * 0.2;
          loadedState.lore.unshift(`Timeline advanced by ${Math.floor(diffSeconds)} cycles during stasis.`);
        }
        setGameState(loadedState);
      } catch (e) {
        console.error("Save corrupted", e);
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem('evociv_save_v2', JSON.stringify({
        timestamp: Date.now(),
        state: gameState
      }));
      setLastSaved(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, [gameState]);

  // --- Loop ---
  const animate = useCallback((time: number) => {
    setGameState(prev => tickSimulation(prev));
    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [animate]);

  // --- AI Lore ---
  useEffect(() => {
      if (gameState.totalTime > 0 && gameState.totalTime % 3000 === 0) {
          generateLore(gameState).then(text => {
              if (text) {
                  setGameState(prev => ({
                      ...prev,
                      lore: [text, ...prev.lore].slice(12)
                  }));
              }
          });
      }
  }, [gameState.totalTime]);

  const resetGame = () => {
    if (confirm("Initialize new civilization protocol? Current progress will be purged.")) {
        localStorage.removeItem('evociv_save_v2');
        setGameState(initializeGame());
    }
  };

  // --- Derived Stats ---
  const currentYear = Math.floor(gameState.totalTime / 3600) + 1;
  const popCount = gameState.agents.length;
  
  const bldHouse = gameState.buildings.filter(b => b.type === 'HOUSE').length;
  const bldFarm = gameState.buildings.filter(b => b.type === 'FARM').length;
  const bldStorage = gameState.buildings.filter(b => b.type === 'STORAGE').length;
  const bldWall = gameState.buildings.filter(b => b.type === 'WALL').length;

  // Helper for UI values
  const fmt = (n: number) => Math.floor(n).toLocaleString();

  return (
    <div className="h-screen w-screen bg-[#020617] text-slate-200 overflow-hidden font-sans relative selection:bg-sky-500/30">
      
      {/* Background Decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-[#020617] to-[#020617] pointer-events-none z-0"></div>
      
      {/* HEADER HUD */}
      <header className="fixed top-0 left-0 right-0 z-40 p-4 pointer-events-none flex justify-between items-start">
        
        {/* Title & Date */}
        <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-xl flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-400">
                    EvoCiv
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono tracking-widest border border-white/5">IDLE</span>
            </h1>
            <div className="text-xs font-mono text-slate-400 flex items-center gap-3">
                <span className="flex items-center gap-1"><Globe size={12} /> Year {currentYear}</span>
                <span className="text-slate-600">|</span>
                <span className="flex items-center gap-1 text-sky-400"><Users size={12} /> {popCount}</span>
            </div>
        </div>

        {/* Resources HUD - Floating Pill */}
        <div className="pointer-events-auto hidden md:flex items-center gap-6 bg-black/40 backdrop-blur-xl border border-white/5 rounded-full px-8 py-3 shadow-2xl">
             <ResourceItem label="FOOD" val={gameState.resources.FOOD} color="text-emerald-400" />
             <ResourceItem label="WOOD" val={gameState.resources.WOOD} color="text-amber-400" />
             <ResourceItem label="STONE" val={gameState.resources.STONE} color="text-slate-400" />
             <ResourceItem label="IRON" val={gameState.resources.IRON || 0} color="text-zinc-300" />
             <ResourceItem label="GOLD" val={gameState.resources.GOLD || 0} color="text-yellow-400" />
        </div>

        {/* Mobile Menu Toggle */}
        <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="md:hidden pointer-events-auto p-2 bg-slate-800 rounded-lg border border-slate-700 text-white shadow-lg">
            {showSidebar ? <X /> : <Menu />}
        </button>
      </header>

      {/* MAIN CANVAS CONTAINER */}
      <main className="absolute inset-0 z-0 flex items-center justify-center bg-[#050b14]">
         {/* Canvas scales to fit but maintains aspect ratio visually via CSS object-contain equivalent if needed, 
             but here we center it in a flex container. */}
         <div className="scale-[0.4] sm:scale-[0.5] md:scale-[0.7] lg:scale-[0.9] xl:scale-100 transition-transform duration-500 ease-out">
            <GameCanvas gameState={gameState} />
         </div>
      </main>

      {/* SIDEBAR / DASHBOARD - Glassmorphism Panel */}
      <aside className={`
            fixed top-20 right-4 bottom-4 z-30 w-80 
            bg-slate-950/60 backdrop-blur-xl border border-white/5 shadow-2xl rounded-2xl 
            transform transition-transform duration-300 ease-in-out flex flex-col
            ${showSidebar ? 'translate-x-0' : 'translate-x-[110%] md:translate-x-0'}
      `}>
         
         <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-6">
            
            {/* Minimap Section */}
            <div className="rounded-lg overflow-hidden border border-white/10 shadow-lg">
                <MiniMap gameState={gameState} />
            </div>

             {/* Mobile Resource View */}
             <div className="md:hidden grid grid-cols-2 gap-2 p-2 bg-white/5 rounded-xl">
                 <ResourceItem label="FOOD" val={gameState.resources.FOOD} color="text-emerald-400" compact />
                 <ResourceItem label="WOOD" val={gameState.resources.WOOD} color="text-amber-400" compact />
                 <ResourceItem label="STONE" val={gameState.resources.STONE} color="text-slate-400" compact />
                 <ResourceItem label="GOLD" val={gameState.resources.GOLD || 0} color="text-yellow-400" compact />
             </div>

            {/* Buildings Grid */}
            <div>
                <SectionHeader icon={<Box size={14}/>} title="Infrastructure" />
                <div className="grid grid-cols-4 gap-2">
                    <StatBox icon={<Home size={14}/>} val={bldHouse} label="Houses" color="bg-pink-500/20 text-pink-300 border-pink-500/30" />
                    <StatBox icon={<Wheat size={14}/>} val={bldFarm} label="Farms" color="bg-lime-500/20 text-lime-300 border-lime-500/30" />
                    <StatBox icon={<Package size={14}/>} val={bldStorage} label="Stores" color="bg-violet-500/20 text-violet-300 border-violet-500/30" />
                    <StatBox icon={<Shield size={14}/>} val={bldWall} label="Walls" color="bg-slate-500/20 text-slate-300 border-slate-500/30" />
                </div>
            </div>

            {/* Genetics/Stats */}
            <div>
                <SectionHeader icon={<Activity size={14}/>} title="Evolution Metrics" />
                <div className="space-y-3 bg-black/20 p-3 rounded-xl border border-white/5">
                    
                    {/* Reproduction Progress */}
                    <div>
                        <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider text-slate-400">
                            <span className="flex items-center gap-1"><Baby size={10} /> Growth</span>
                            <span className="font-mono text-sky-300">{(gameState.reproductionProgress || 0).toFixed(0)}/{COSTS.SPAWN.FOOD}</span>
                        </div>
                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-500 shadow-[0_0_10px_currentColor]" style={{ width: `${Math.min(100, ((gameState.reproductionProgress || 0) / COSTS.SPAWN.FOOD) * 100)}%` }}></div>
                        </div>
                    </div>

                    <ProgressBar label="Mobility" val={popCount ? gameState.agents.reduce((a, c) => a + c.stats.speed, 0)/popCount : 0} max={4} color="bg-indigo-500" />
                    <ProgressBar label="Productivity" val={popCount ? gameState.agents.reduce((a, c) => a + c.stats.gatheringSpeed, 0)/popCount : 0} max={2} color="bg-emerald-500" />
                    <ProgressBar label="Strength" val={popCount ? gameState.agents.reduce((a, c) => a + c.stats.maxCarry, 0)/popCount : 0} max={30} color="bg-amber-500" />
                </div>
            </div>

            {/* Lore Feed */}
            <div className="flex flex-col h-48">
                <SectionHeader icon={<Database size={14}/>} title="System Logs" />
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar mask-linear-fade">
                    {gameState.lore.map((entry, i) => (
                        <div key={i} className={`text-xs p-2 rounded border-l-2 ${i===0 ? 'border-sky-500 bg-sky-900/10 text-sky-100' : 'border-slate-700 text-slate-500'}`}>
                            {entry}
                        </div>
                    ))}
                </div>
            </div>

         </div>

         {/* Footer Controls */}
         <div className="p-4 border-t border-white/5 bg-black/20">
             <button onClick={resetGame} className="w-full py-2 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs uppercase font-bold tracking-widest transition-all">
                 Reboot System
             </button>
             <div className="mt-2 text-[10px] text-center text-slate-700 font-mono">
                 AUTO-SAVE ACTIVE • {new Date(lastSaved).toLocaleTimeString()}
             </div>
         </div>
      </aside>

    </div>
  );
}

// --- Sub-components for clean code ---

const ResourceItem = ({label, val, color, compact}: {label: string, val: number, color: string, compact?: boolean}) => (
    <div className={`flex flex-col ${compact ? 'items-start' : 'items-center'}`}>
        <span className={`text-[10px] font-bold tracking-wider text-slate-500 ${compact ? '' : 'mb-0.5'}`}>{label}</span>
        <span className={`font-mono font-medium ${compact ? 'text-sm' : 'text-lg'} ${color} drop-shadow-lg`}>
            {Math.floor(val).toLocaleString()}
        </span>
    </div>
);

const SectionHeader = ({icon, title}: {icon: React.ReactNode, title: string}) => (
    <h3 className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-3 flex items-center gap-2">
        {icon} {title}
    </h3>
);

const StatBox = ({icon, val, label, color}: any) => (
    <div className={`p-2 rounded-lg border flex flex-col items-center gap-1 ${color} transition-transform hover:scale-105`}>
        {icon}
        <span className="text-lg font-bold font-mono leading-none mt-1">{val}</span>
        <span className="text-[9px] opacity-70 uppercase">{label}</span>
    </div>
);

const ProgressBar = ({label, val, max, color}: any) => (
    <div>
        <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider text-slate-400">
            <span>{label}</span>
            <span className="font-mono text-white">{val.toFixed(2)}</span>
        </div>
        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full ${color} shadow-[0_0_10px_currentColor]`} style={{ width: `${Math.min(100, (val / max) * 100)}%` }}></div>
        </div>
    </div>
);

export default App;
