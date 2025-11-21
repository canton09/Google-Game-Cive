
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Activity, Box, Database, Users, Zap, TrendingUp, Home, Wheat, Package, Shield, Heart, Clock, Menu, X, Globe, Baby, AlertTriangle } from 'lucide-react';
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
    const saved = localStorage.getItem('evociv_save_v2');
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
        if (loadedState.reproductionProgress === undefined) {
            loadedState.reproductionProgress = 0;
        }

        // Offline Progress
        if (diffSeconds > 60) {
          loadedState.resources.FOOD += diffSeconds * 0.5;
          loadedState.resources.WOOD += diffSeconds * 0.2;
          loadedState.lore.unshift(`在休眠期间，文明自行演化了 ${Math.floor(diffSeconds)} 个周期。`);
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
    if (confirm("确认要重置整个文明吗？当前的所有进化进度和历史将被永久清除。")) {
        localStorage.removeItem('evociv_save_v2');
        setGameState(initializeGame());
        setShowSidebar(false);
    }
  };

  // --- Derived Stats ---
  const currentYear = Math.floor(gameState.totalTime / 3600) + 1;
  const popCount = gameState.agents.length;
  
  const bldHouse = gameState.buildings.filter(b => b.type === 'HOUSE').length;
  const bldFarm = gameState.buildings.filter(b => b.type === 'FARM').length;
  const bldStorage = gameState.buildings.filter(b => b.type === 'STORAGE').length;
  const bldWall = gameState.buildings.filter(b => b.type === 'WALL').length;

  return (
    <div className="h-screen w-screen bg-[#020617] text-slate-200 overflow-hidden font-sans relative selection:bg-sky-500/30">
      
      {/* Background Decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-[#020617] to-[#020617] pointer-events-none z-0"></div>
      
      {/* HEADER HUD */}
      <header className="fixed top-0 left-0 right-0 z-40 p-3 md:p-4 pointer-events-none flex justify-between items-start transition-all">
        
        {/* Title & Date */}
        <div className="pointer-events-auto bg-black/60 backdrop-blur-md border border-white/5 rounded-2xl p-3 md:p-5 shadow-xl flex flex-col gap-1 transition-all">
            <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2 md:gap-3">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-400 truncate max-w-[160px] md:max-w-none">
                    EvoCiv 文明进化
                </span>
                <span className="text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 rounded bg-white/10 text-white/50 font-mono tracking-widest border border-white/5 whitespace-nowrap">
                    挂机中
                </span>
            </h1>
            <div className="text-xs md:text-sm font-mono text-slate-400 flex items-center gap-3 md:gap-4 mt-0.5 md:mt-1">
                <span className="flex items-center gap-1.5"><Globe size={12} className="md:w-3.5 md:h-3.5" /> {currentYear} 年</span>
                <span className="text-slate-600">|</span>
                <span className="flex items-center gap-1.5 text-sky-400"><Users size={12} className="md:w-3.5 md:h-3.5" /> {popCount} 人</span>
            </div>
        </div>

        {/* Resources HUD - Floating Pill (Hidden on mobile, visible on md+) */}
        <div className="pointer-events-auto hidden lg:flex items-center gap-6 xl:gap-8 bg-black/60 backdrop-blur-xl border border-white/5 rounded-full px-6 py-3 xl:px-10 xl:py-4 shadow-2xl transition-all">
             <ResourceItem label="食物" val={gameState.resources.FOOD} color="text-emerald-400" />
             <ResourceItem label="木材" val={gameState.resources.WOOD} color="text-amber-400" />
             <ResourceItem label="石料" val={gameState.resources.STONE} color="text-slate-400" />
             <ResourceItem label="铁" val={gameState.resources.IRON || 0} color="text-zinc-300" />
             <ResourceItem label="黄金" val={gameState.resources.GOLD || 0} color="text-yellow-400" />
        </div>

        {/* Mobile/Tablet Menu Toggle - Visible up to XL */}
        <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="xl:hidden pointer-events-auto p-3 bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700 text-white shadow-lg hover:bg-slate-700 active:scale-95 transition-all">
            {showSidebar ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* DISASTER ALERT - Global UI Layer */}
      {gameState.disasterActive && (
        <div className="fixed top-20 md:top-28 left-1/2 transform -translate-x-1/2 z-30 w-[90%] md:w-auto pointer-events-none">
            <div className="bg-red-500/20 backdrop-blur-md border border-red-500/50 
                            text-red-100 px-4 py-2 md:px-8 md:py-3 rounded-full animate-pulse 
                            text-lg md:text-2xl font-bold tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.4)]
                            flex items-center justify-center gap-3">
                <AlertTriangle className="animate-bounce w-5 h-5 md:w-8 md:h-8" />
                <span className="truncate">
                    {gameState.disasterType === 'EARTHQUAKE' ? '地震来袭' : '暴风雪来袭'}
                </span>
                <AlertTriangle className="animate-bounce w-5 h-5 md:w-8 md:h-8" />
            </div>
        </div>
      )}

      {/* MAIN CANVAS CONTAINER */}
      <main className="absolute inset-0 z-0 flex items-center justify-center bg-[#050b14] overflow-hidden">
         {/* Responsive Scaling: 0.22x for mobile up to 1.0x for huge screens */}
         <div className="scale-[0.22] min-[375px]:scale-[0.25] min-[450px]:scale-[0.3] sm:scale-[0.4] md:scale-[0.5] lg:scale-[0.65] xl:scale-[0.85] 2xl:scale-100 transition-transform duration-500 ease-out origin-center will-change-transform">
            <GameCanvas gameState={gameState} />
         </div>
      </main>

      {/* SIDEBAR / DASHBOARD */}
      <aside className={`
            fixed z-50 flex flex-col
            
            /* Mobile: Fullscreen/Drawer style */
            top-0 right-0 bottom-0 w-full sm:w-96
            
            /* Desktop: Floating card style */
            sm:top-24 sm:right-6 sm:bottom-6 sm:rounded-2xl
            
            bg-slate-950/90 backdrop-blur-2xl sm:backdrop-blur-xl border-l sm:border border-white/5 shadow-2xl 
            transform transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]
            
            /* Visibility Logic: Hidden by default on Mobile/Tablet (<XL), Visible by default on Desktop (XL+) */
            ${showSidebar ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'}
      `}>
         
         {/* Mobile Header in Sidebar */}
         <div className="flex items-center justify-between p-4 sm:hidden border-b border-white/5 bg-black/20">
             <span className="font-bold text-lg text-white">控制台</span>
             <button onClick={() => setShowSidebar(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                 <X size={20} />
             </button>
         </div>
         
         <div className="p-4 md:p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6 md:space-y-8">
            
            {/* Minimap Section */}
            <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/40">
                <MiniMap gameState={gameState} />
            </div>

             {/* Mobile Resource View (Shown when header pill is hidden) */}
             <div className="lg:hidden grid grid-cols-2 gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                 <ResourceItem label="食物" val={gameState.resources.FOOD} color="text-emerald-400" compact />
                 <ResourceItem label="木材" val={gameState.resources.WOOD} color="text-amber-400" compact />
                 <ResourceItem label="石料" val={gameState.resources.STONE} color="text-slate-400" compact />
                 <ResourceItem label="黄金" val={gameState.resources.GOLD || 0} color="text-yellow-400" compact />
             </div>

            {/* Buildings Grid */}
            <div>
                <SectionHeader icon={<Box size={16}/>} title="基础设施" />
                <div className="grid grid-cols-4 gap-2 md:gap-3">
                    <StatBox icon={<Home size={18}/>} val={bldHouse} label="住宅" color="bg-pink-500/20 text-pink-300 border-pink-500/30" />
                    <StatBox icon={<Wheat size={18}/>} val={bldFarm} label="农场" color="bg-lime-500/20 text-lime-300 border-lime-500/30" />
                    <StatBox icon={<Package size={18}/>} val={bldStorage} label="仓库" color="bg-violet-500/20 text-violet-300 border-violet-500/30" />
                    <StatBox icon={<Shield size={18}/>} val={bldWall} label="防御" color="bg-slate-500/20 text-slate-300 border-slate-500/30" />
                </div>
            </div>

            {/* Genetics/Stats */}
            <div>
                <SectionHeader icon={<Activity size={16}/>} title="文明指数" />
                <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
                    
                    {/* Reproduction Progress */}
                    <div>
                        <div className="flex justify-between text-xs mb-1.5 uppercase tracking-wider text-slate-400 font-bold">
                            <span className="flex items-center gap-1.5"><Baby size={14} /> 人口增长</span>
                            <span className="font-mono text-sky-300">{(gameState.reproductionProgress || 0).toFixed(0)}/{COSTS.SPAWN.FOOD}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-500 shadow-[0_0_10px_currentColor] transition-all duration-500" style={{ width: `${Math.min(100, ((gameState.reproductionProgress || 0) / COSTS.SPAWN.FOOD) * 100)}%` }}></div>
                        </div>
                    </div>

                    <ProgressBar label="移动速度" val={popCount ? gameState.agents.reduce((a, c) => a + c.stats.speed, 0)/popCount : 0} max={4} color="bg-indigo-500" />
                    <ProgressBar label="采集效率" val={popCount ? gameState.agents.reduce((a, c) => a + c.stats.gatheringSpeed, 0)/popCount : 0} max={2} color="bg-emerald-500" />
                </div>
            </div>

            {/* Lore Feed */}
            <div className="flex flex-col h-56">
                <SectionHeader icon={<Database size={16}/>} title="系统日志" />
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 custom-scrollbar mask-linear-fade">
                    {gameState.lore.map((entry, i) => (
                        <div key={i} className={`text-sm p-2.5 rounded-lg border-l-[3px] leading-relaxed ${i===0 ? 'border-sky-500 bg-sky-900/20 text-sky-100 shadow-sm animate-in fade-in slide-in-from-right-2' : 'border-slate-700 text-slate-400'}`}>
                            {entry}
                        </div>
                    ))}
                </div>
            </div>

         </div>

         {/* Footer Controls */}
         <div className="p-5 border-t border-white/5 bg-black/30">
             <button onClick={resetGame} className="w-full py-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-sm uppercase font-bold tracking-widest transition-all hover:shadow-lg hover:shadow-red-900/20 active:scale-[0.98]">
                 重置文明进程
             </button>
             <div className="mt-3 text-[10px] text-center text-slate-600 font-mono">
                 EVOCIV v2.0 • 自动保存 {new Date(lastSaved).toLocaleTimeString()}
             </div>
         </div>
      </aside>

    </div>
  );
}

// --- Sub-components ---

const ResourceItem = ({label, val, color, compact}: {label: string, val: number, color: string, compact?: boolean}) => (
    <div className={`flex flex-col ${compact ? 'items-start' : 'items-center'}`}>
        <span className={`text-[10px] font-bold tracking-wider text-slate-500 ${compact ? '' : 'mb-1'}`}>{label}</span>
        <span className={`font-mono font-bold ${compact ? 'text-sm' : 'text-xl'} ${color} drop-shadow-md`}>
            {Math.floor(val).toLocaleString()}
        </span>
    </div>
);

const SectionHeader = ({icon, title}: {icon: React.ReactNode, title: string}) => (
    <h3 className="text-slate-500 text-xs uppercase font-bold tracking-widest mb-4 flex items-center gap-2.5">
        {icon} {title}
    </h3>
);

const StatBox = ({icon, val, label, color}: any) => (
    <div className={`p-2 md:p-3 rounded-xl border flex flex-col items-center gap-1.5 ${color} transition-transform hover:scale-105 shadow-lg select-none`}>
        {icon}
        <span className="text-lg md:text-xl font-bold font-mono leading-none mt-1">{val}</span>
        <span className="text-[10px] opacity-80 uppercase font-semibold">{label}</span>
    </div>
);

const ProgressBar = ({label, val, max, color}: any) => (
    <div>
        <div className="flex justify-between text-xs mb-1.5 uppercase tracking-wider text-slate-400 font-bold">
            <span>{label}</span>
            <span className="font-mono text-white">{val.toFixed(2)}</span>
        </div>
        <div className="h-1.5 md:h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full ${color} shadow-[0_0_10px_currentColor] transition-all duration-500`} style={{ width: `${Math.min(100, (val / max) * 100)}%` }}></div>
        </div>
    </div>
);

export default App;
