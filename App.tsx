
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Activity, Box, Database, Users, Zap, TrendingUp, Home, Wheat, Package, Shield, Heart, Clock } from 'lucide-react';
import GameCanvas from './components/GameCanvas';
import { initializeGame, tickSimulation, generateTerrain } from './services/simulation';
import { generateLore } from './services/geminiService';
import { GameState, AgentState } from './types';
import { GRID_W, GRID_H } from './constants';

const OFFLINE_CALCULATION_LIMIT = 3600 * 12; // Max 12 hours offline progress

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initializeGame());
  const [lastSaved, setLastSaved] = useState<number>(Date.now());

  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem('evociv_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const now = Date.now();
        const diffSeconds = Math.min((now - parsed.timestamp) / 1000, OFFLINE_CALCULATION_LIMIT);
        
        // Simulate offline progress
        let loadedState = parsed.state;

        // MIGRATION: Ensure terrain exists and matches current grid size
        if (!loadedState.terrain || loadedState.terrain.length === 0 || loadedState.terrain.length !== GRID_H || loadedState.terrain[0]?.length !== GRID_W) {
            console.log("Migrating save: Regenerating terrain due to size change...");
            loadedState.terrain = generateTerrain();
        }

        if (diffSeconds > 60) {
          console.log(`Simulating ${diffSeconds} seconds of offline progress...`);
          // Estimate max storage roughly
          const offlineGain = 5000; 
          loadedState.resources.FOOD += diffSeconds * 0.5;
          loadedState.resources.WOOD += diffSeconds * 0.2;
          loadedState.lore.unshift(`在你沉睡时，${Math.floor(diffSeconds)} 个瞬间过去了。`);
        }
        setGameState(loadedState);
      } catch (e) {
        console.error("Save file corrupted", e);
      }
    }
  }, []);

  // Auto-save every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem('evociv_save', JSON.stringify({
        timestamp: Date.now(),
        state: gameState
      }));
      setLastSaved(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, [gameState]);

  // --- Game Loop ---
  const animate = useCallback((time: number) => {
    // Constant speed loop
    setGameState(prev => tickSimulation(prev));
    
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [animate]);

  // --- AI Lore Trigger ---
  useEffect(() => {
      // Trigger lore every 3000 ticks (approx 50s at 60fps) to avoid rate limits
      if (gameState.totalTime > 0 && gameState.totalTime % 3000 === 0) {
          generateLore(gameState).then(text => {
              if (text) {
                  setGameState(prev => ({
                      ...prev,
                      lore: [text, ...prev.lore].slice(10)
                  }));
              }
          });
      }
  }, [gameState.totalTime]);

  // --- Handlers ---
  const resetGame = () => {
    if (confirm("确定要毁灭这个文明并重新开始吗？")) {
        localStorage.removeItem('evociv_save');
        setGameState(initializeGame());
    }
  };

  // Calculate Calendar
  const totalDays = Math.floor(gameState.totalTime / 10); // 10 ticks = 1 day
  const currentYear = Math.floor(totalDays / 360) + 1;
  const dayOfYear = totalDays % 360;
  
  // --- Derived Stats for Dashboard ---
  const popCount = gameState.agents.length;
  const avgSpeed = popCount ? gameState.agents.reduce((acc, a) => acc + a.stats.speed, 0) / popCount : 0;
  const avgCarry = popCount ? gameState.agents.reduce((acc, a) => acc + a.stats.maxCarry, 0) / popCount : 0;
  const avgWork = popCount ? gameState.agents.reduce((acc, a) => acc + a.stats.gatheringSpeed, 0) / popCount : 0;
  const avgResilience = popCount ? gameState.agents.reduce((acc, a) => acc + a.stats.resilience, 0) / popCount : 0;
  const avgLifespan = popCount ? gameState.agents.reduce((acc, a) => acc + a.stats.lifespan, 0) / popCount : 0;
  
  const bldHouse = gameState.buildings.filter(b => b.type === 'HOUSE').length;
  const bldFarm = gameState.buildings.filter(b => b.type === 'FARM').length;
  const bldStorage = gameState.buildings.filter(b => b.type === 'STORAGE').length;
  const bldWall = gameState.buildings.filter(b => b.type === 'WALL').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col lg:flex-row overflow-hidden">
      
      {/* Main Game Area */}
      <main className="flex-1 p-4 lg:p-8 flex flex-col items-center relative overflow-auto">
        <div className="sticky top-0 z-20 w-full flex justify-between items-start mb-4 pointer-events-none">
             <div className="pointer-events-auto">
                <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2 drop-shadow-lg">
                    <Zap className="text-amber-400 fill-amber-400" /> EvoCiv
                </h1>
                <p className="text-slate-400 text-sm mt-1 font-mono bg-slate-900/80 px-2 rounded inline-block">
                    年份 {currentYear} • 天数 {dayOfYear}
                </p>
            </div>
        </div>

        <div className="mb-4 w-full max-w-[1600px] flex justify-between items-center bg-slate-800/50 p-2 rounded-lg backdrop-blur-sm border border-slate-700/50 sticky top-20 z-10">
            <div className="flex gap-4 text-sm font-mono flex-wrap justify-center w-full">
                <span className="flex items-center gap-2 text-emerald-400" title="食物">
                    <div className="w-2 h-2 lg:w-3 lg:h-3 bg-emerald-500 rounded-full"></div> 食物 {Math.floor(gameState.resources.FOOD)}
                </span>
                <span className="flex items-center gap-2 text-amber-500" title="木材">
                    <div className="w-2 h-2 lg:w-3 lg:h-3 bg-amber-600 rounded-full"></div> 木材 {Math.floor(gameState.resources.WOOD)}
                </span>
                <span className="flex items-center gap-2 text-slate-400" title="石料">
                    <div className="w-2 h-2 lg:w-3 lg:h-3 bg-slate-500 rounded-full"></div> 石料 {Math.floor(gameState.resources.STONE)}
                </span>
                 <span className="flex items-center gap-2 text-zinc-400" title="铁矿">
                    <div className="w-2 h-2 lg:w-3 lg:h-3 bg-zinc-500 rounded-full"></div> 铁矿 {Math.floor(gameState.resources.IRON || 0)}
                </span>
                 <span className="flex items-center gap-2 text-yellow-400" title="黄金">
                    <div className="w-2 h-2 lg:w-3 lg:h-3 bg-yellow-400 rounded-full"></div> 黄金 {Math.floor(gameState.resources.GOLD || 0)}
                </span>
            </div>
        </div>

        <div className="flex-1 flex items-center justify-center min-w-min">
            <GameCanvas gameState={gameState} />
        </div>
        
        <div className="mt-2 text-xs text-slate-600 font-mono">
            自动保存于: {new Date(lastSaved).toLocaleTimeString()}
        </div>
      </main>

      {/* Sidebar / Dashboard */}
      <aside className="w-full lg:w-80 bg-slate-950 border-l border-slate-800 p-6 flex flex-col gap-6 overflow-y-auto max-h-[40vh] lg:max-h-screen shrink-0 z-30 shadow-xl scrollbar-hide">
        
        {/* Section: Demographics */}
        <section>
            <h3 className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                <Users size={14} /> 人口统计
            </h3>
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900/50 p-3 rounded border border-slate-800/50 flex flex-col justify-between">
                    <div className="text-slate-400 text-xs mb-1">当前人口</div>
                    <div className="text-xl text-white font-medium">{popCount}</div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded border border-slate-800/50 flex flex-col justify-between">
                    <div className="text-slate-400 text-xs mb-1">历史峰值</div>
                    <div className="text-xl text-emerald-400 font-medium">{gameState.populationPeak}</div>
                </div>
                 <div className="bg-slate-900/50 p-3 rounded border border-slate-800/50 flex flex-col justify-between">
                    <div className="text-slate-400 text-xs mb-1">繁衍代数</div>
                    <div className="text-lg text-indigo-400 font-mono">Gen {gameState.generation}</div>
                </div>
                 <div className="bg-slate-900/50 p-3 rounded border border-slate-800/50 flex flex-col justify-between">
                    <div className="text-slate-400 text-xs mb-1">预期寿命</div>
                    <div className="text-lg text-amber-200 font-mono">{Math.floor(avgLifespan)} <span className="text-xs opacity-50">ticks</span></div>
                </div>
            </div>
        </section>

        {/* Section: Infrastructure */}
        <section>
             <h3 className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                <Box size={14} /> 城市基建
            </h3>
            <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-900 p-2 rounded border border-slate-800 flex flex-col items-center gap-1" title="住宅">
                    <Home size={16} className="text-pink-400" />
                    <span className="text-sm font-bold text-slate-200">{bldHouse}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800 flex flex-col items-center gap-1" title="农场">
                    <Wheat size={16} className="text-lime-500" />
                    <span className="text-sm font-bold text-slate-200">{bldFarm}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800 flex flex-col items-center gap-1" title="仓库">
                    <Package size={16} className="text-violet-400" />
                    <span className="text-sm font-bold text-slate-200">{bldStorage}</span>
                </div>
                 <div className="bg-slate-900 p-2 rounded border border-slate-800 flex flex-col items-center gap-1" title="防御">
                    <Shield size={16} className="text-slate-400" />
                    <span className="text-sm font-bold text-slate-200">{bldWall}</span>
                </div>
            </div>
        </section>

        {/* Section: Genetic Evolution (Detailed) */}
        <section>
            <h3 className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                <Activity size={14} /> 基因进化趋势
            </h3>
            {popCount > 0 ? (
                <div className="space-y-3 bg-slate-900/30 p-3 rounded-lg border border-slate-800/50">
                    {/* Speed */}
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400 flex items-center gap-1"><TrendingUp size={10}/> 移动速度</span>
                            <span className="text-sky-300 font-mono">{avgSpeed.toFixed(2)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-500" style={{ width: `${Math.min(100, (avgSpeed / 4) * 100)}%` }}></div>
                        </div>
                    </div>

                     {/* Gathering */}
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400 flex items-center gap-1"><Clock size={10}/> 采集效率</span>
                            <span className="text-emerald-300 font-mono">{avgWork.toFixed(2)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (avgWork / 2) * 100)}%` }}></div>
                        </div>
                    </div>

                    {/* Strength */}
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400 flex items-center gap-1"><Box size={10}/> 负重能力</span>
                            <span className="text-amber-300 font-mono">{avgCarry.toFixed(1)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, (avgCarry / 30) * 100)}%` }}></div>
                        </div>
                    </div>

                     {/* Resilience */}
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400 flex items-center gap-1"><Heart size={10}/> 灾难抗性</span>
                            <span className="text-rose-300 font-mono">{(avgResilience * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500" style={{ width: `${Math.min(100, avgResilience * 100)}%` }}></div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-sm text-red-400 italic text-center py-4 border border-red-900/30 rounded bg-red-900/10">
                    文明已灭绝，等待重生...
                </div>
            )}
        </section>

        {/* Chronicles Log */}
        <section className="flex-1 flex flex-col min-h-[200px]">
            <h3 className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                <Database size={14} /> 历史编年史
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 text-sm max-h-[300px] custom-scrollbar">
                {gameState.lore.map((entry, idx) => (
                    <div key={idx} className={`pl-3 border-l-2 py-1 ${idx === 0 ? 'border-amber-500 text-slate-200 bg-amber-500/5' : 'border-slate-800 text-slate-500'}`}>
                        <p className="leading-relaxed text-xs lg:text-sm">{entry}</p>
                    </div>
                ))}
            </div>
        </section>

        <div className="mt-auto pt-6 border-t border-slate-800">
            <button 
                onClick={resetGame}
                className="w-full py-3 px-4 bg-red-950/30 hover:bg-red-900/30 text-red-400 hover:text-red-300 text-xs uppercase font-bold tracking-widest rounded border border-red-900/30 transition-all duration-300 flex justify-center items-center gap-2 group"
            >
                <Zap size={14} className="group-hover:text-red-200 transition-colors" /> 开启新文明
            </button>
        </div>

      </aside>
    </div>
  );
}

export default App;
