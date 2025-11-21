import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Activity, Box, Database, Users, Zap, Image as ImageIcon, Loader, RefreshCw } from 'lucide-react';
import GameCanvas from './components/GameCanvas';
import { initializeGame, tickSimulation, generateTerrain } from './services/simulation';
import { generateLore, generateCivilizationSnapshot } from './services/geminiService';
import { GameState } from './types';

const OFFLINE_CALCULATION_LIMIT = 3600 * 12; // Max 12 hours offline progress

// Mapping for stat labels
const STAT_LABELS: Record<string, string> = {
    speed: '速度',
    maxCarry: '负重',
    resilience: '韧性'
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initializeGame());
  // Removed isPlaying and speed controls for constant flow
  const [lastSaved, setLastSaved] = useState<number>(Date.now());
  
  // Image Gen State
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [imgSize, setImgSize] = useState<'1K' | '2K' | '4K'>('1K');

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

        // MIGRATION: Ensure terrain exists if loading old save
        if (!loadedState.terrain || loadedState.terrain.length === 0) {
            console.log("Migrating save: Generating terrain...");
            loadedState.terrain = generateTerrain();
        }

        if (diffSeconds > 60) {
          console.log(`Simulating ${diffSeconds} seconds of offline progress...`);
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
                      lore: [text, ...prev.lore].slice(0, 10)
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
        setSnapshot(null);
    }
  };

  const handleSnapshot = async () => {
    try {
        if (window.aistudio && !await window.aistudio.hasSelectedApiKey()) {
            await window.aistudio.openSelectKey();
        }
        
        setIsGeneratingImg(true);
        const imgData = await generateCivilizationSnapshot(gameState, imgSize);
        if (imgData) {
            setSnapshot(imgData);
        }
    } catch (error: any) {
        console.error("Snapshot error:", error);
        if (String(error).includes("Requested entity was not found") && window.aistudio) {
             try {
                 await window.aistudio.openSelectKey();
             } catch (e) { console.error("Key selection failed", e); }
        }
    } finally {
        setIsGeneratingImg(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col lg:flex-row overflow-hidden">
      
      {/* Main Game Area */}
      <main className="flex-1 p-4 lg:p-8 flex flex-col items-center justify-center relative">
        <div className="absolute top-4 left-6 z-10">
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                <Zap className="text-amber-400 fill-amber-400" /> EvoCiv
            </h1>
            <p className="text-slate-500 text-sm mt-1">世代 {gameState.generation} • 年份 {Math.floor(gameState.totalTime / 100)}</p>
        </div>

        <div className="mb-4 w-full max-w-[800px] flex justify-between items-center">
            <div className="flex gap-4 text-sm font-mono flex-wrap">
                <span className="flex items-center gap-2 text-emerald-400" title="食物">
                    <div className="w-2 h-2 lg:w-3 lg:h-3 bg-emerald-500 rounded-full"></div> {Math.floor(gameState.resources.FOOD)}
                </span>
                <span className="flex items-center gap-2 text-amber-500" title="木材">
                    <div className="w-2 h-2 lg:w-3 lg:h-3 bg-amber-600 rounded-full"></div> {Math.floor(gameState.resources.WOOD)}
                </span>
                <span className="flex items-center gap-2 text-slate-400" title="石料">
                    <div className="w-2 h-2 lg:w-3 lg:h-3 bg-slate-500 rounded-full"></div> {Math.floor(gameState.resources.STONE)}
                </span>
                 <span className="flex items-center gap-2 text-zinc-400" title="铁矿">
                    <div className="w-2 h-2 lg:w-3 lg:h-3 bg-zinc-500 rounded-full"></div> {Math.floor(gameState.resources.IRON || 0)}
                </span>
                 <span className="flex items-center gap-2 text-yellow-400" title="黄金">
                    <div className="w-2 h-2 lg:w-3 lg:h-3 bg-yellow-400 rounded-full"></div> {Math.floor(gameState.resources.GOLD || 0)}
                </span>
            </div>
        </div>

        <GameCanvas gameState={gameState} />
        
        <div className="mt-2 text-xs text-slate-600 font-mono">
            自动保存于: {new Date(lastSaved).toLocaleTimeString()}
        </div>
      </main>

      {/* Sidebar / Dashboard */}
      <aside className="w-full lg:w-80 bg-slate-950 border-l border-slate-800 p-6 flex flex-col gap-6 overflow-y-auto max-h-[40vh] lg:max-h-screen">
        
        {/* Population Stats */}
        <section>
            <h3 className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                <Users size={14} /> 人口统计
            </h3>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900 p-3 rounded border border-slate-800">
                    <div className="text-2xl font-light text-white">{gameState.agents.length}</div>
                    <div className="text-xs text-slate-500">当前人口</div>
                </div>
                <div className="bg-slate-900 p-3 rounded border border-slate-800">
                    <div className="text-2xl font-light text-white">{gameState.buildings.length}</div>
                    <div className="text-xs text-slate-500">建筑数量</div>
                </div>
            </div>
        </section>

        {/* Visual History (Image Gen) */}
        <section>
            <h3 className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                <ImageIcon size={14} /> 视觉历史
            </h3>
            <div className="bg-slate-900 p-3 rounded border border-slate-800 space-y-3">
                <div className="flex gap-2">
                     <select 
                        value={imgSize} 
                        onChange={(e) => setImgSize(e.target.value as '1K'|'2K'|'4K')}
                        className="bg-slate-800 text-slate-300 text-xs rounded p-1.5 border border-slate-700 flex-1 focus:outline-none focus:border-indigo-500"
                     >
                         <option value="1K">1K 分辨率</option>
                         <option value="2K">2K 分辨率</option>
                         <option value="4K">4K 分辨率</option>
                     </select>
                     <button 
                        onClick={handleSnapshot}
                        disabled={isGeneratingImg}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white p-2 rounded flex items-center justify-center transition-colors"
                     >
                         {isGeneratingImg ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                     </button>
                </div>

                {snapshot ? (
                    <div className="relative group rounded overflow-hidden border border-slate-700 aspect-square">
                        <img src={snapshot} alt="Civilization Snapshot" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <a href={snapshot} download={`evociv-gen${gameState.generation}.png`} className="text-white text-xs underline">下载</a>
                        </div>
                    </div>
                ) : (
                    <div className="aspect-square rounded border border-slate-800 border-dashed flex flex-col items-center justify-center text-slate-600 text-xs p-4 text-center bg-slate-950">
                        {isGeneratingImg ? (
                            <span className="animate-pulse">正在渲染模拟...</span>
                        ) : (
                            "捕捉你文明的高保真快照。"
                        )}
                    </div>
                )}
            </div>
        </section>

        {/* Evolution Stats */}
        <section>
            <h3 className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                <Activity size={14} /> 平均特征 (世代 {gameState.generation})
            </h3>
            {gameState.agents.length > 0 ? (
                <div className="space-y-2">
                    {['speed', 'maxCarry', 'resilience'].map(stat => {
                        const avg = gameState.agents.reduce((acc, a) => acc + (a.stats as any)[stat], 0) / gameState.agents.length;
                        const max = stat === 'speed' ? 5 : stat === 'maxCarry' ? 50 : 1;
                        const percent = (avg / max) * 100;
                        return (
                            <div key={stat} className="group">
                                <div className="flex justify-between text-xs text-slate-400 mb-1 capitalize">
                                    <span>{STAT_LABELS[stat] || stat}</span>
                                    <span>{avg.toFixed(2)}</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-indigo-500 transition-all duration-1000" 
                                        style={{ width: `${Math.min(100, percent)}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-sm text-red-400 italic">文明已灭绝。需要重置。</div>
            )}
        </section>

        {/* Chronicles Log */}
        <section className="flex-1 min-h-[200px]">
            <h3 className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                <Database size={14} /> 编年史
            </h3>
            <div className="space-y-3 text-sm">
                {gameState.lore.map((entry, idx) => (
                    <div key={idx} className={`pl-3 border-l-2 ${idx === 0 ? 'border-amber-500 text-slate-200' : 'border-slate-800 text-slate-500'}`}>
                        <p className="leading-relaxed">{entry}</p>
                    </div>
                ))}
            </div>
        </section>

        <div className="mt-auto pt-6 border-t border-slate-800">
            <button 
                onClick={resetGame}
                className="w-full py-2 px-4 bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs uppercase font-bold tracking-wider rounded border border-red-900/50 transition-colors"
            >
                开启新文明
            </button>
        </div>

      </aside>
    </div>
  );
}

export default App;