import React, { useState, useEffect } from 'react';
import { generateStoryStream, extractStateUpdates, updateGameMemory, updateDirectorState } from '../services/ai';
import { evaluateAction, calculateTension } from '../services/arbitrator';
import { applyStateUpdates } from '../services/stateReducer';
import { backgroundTaskQueue } from '../services/taskQueue';
import { GameState, LogEntry } from '../types';
import { Sidebar } from './Sidebar';
import { StoryView } from './StoryView';
import { LogsModal } from './LogsModal';
import { WorldbookModal } from './WorldbookModal';
import { DirectorModal } from './DirectorModal';
import { Loader2, Menu, MapPin, Heart, Coins, Scroll } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { useGameStore } from '../store/gameStore';

export function Game() {
  const gameState = useGameStore();
  const setGameState = useGameStore(state => state.setGameState);
  const skillCooldowns = useGameStore(state => state.skillCooldowns);
  
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isWorldbookOpen, setIsWorldbookOpen] = useState(false);
  const [isDirectorOpen, setIsDirectorOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const buildNextSkillCooldowns = (currentCooldowns: Record<string, number>, usedSkills: string[]) => {
    const nextCooldowns = { ...currentCooldowns };

    for (const skillName of Object.keys(nextCooldowns)) {
      if (nextCooldowns[skillName] > 0) {
        nextCooldowns[skillName] -= 1;
      }

      if (nextCooldowns[skillName] <= 0) {
        delete nextCooldowns[skillName];
      }
    }

    for (const skillName of usedSkills) {
      nextCooldowns[skillName] = 3;
    }

    return nextCooldowns;
  };

  const startGame = async () => {
    setIsLoading(true);
    setError(null);
    setIsSidebarOpen(false);
    try {
      const initialState: GameState = {
        version: gameState.version,
        storyText: '',
        choices: [],
        inventory: [],
        skills: [],
        quests: [],
        npcStates: [],
        location: '未知地点',
        stats: {
          hp: 100, maxHp: 100, gold: 0, level: 1, exp: 0, maxExp: 100, skillPoints: 0,
          attributes: { strength: 10, agility: 10, intelligence: 10, charisma: 10, luck: 10 }
        },
        memory: { summary: '', worldInfo: [] },
        logs: [{
          id: Date.now().toString(),
          timestamp: Date.now(),
          type: 'system',
          text: '冒险开始了...'
        }],
        recentHistory: []
      };
      
      setGameState(initialState);
      setIsGameStarted(true);
      
      let fullStory = '';
      const stream = generateStoryStream(initialState, '在一个奇幻世界中开始新的冒险。');
      for await (const chunk of stream) {
        fullStory += chunk;
        setGameState(prev => ({ ...prev, storyText: fullStory }));
      }
      
      // Parse choices
      let choices: string[] = [];
      const choicesMatch = fullStory.match(/选项:\n([\s\S]*)/);
      if (choicesMatch) {
        choices = choicesMatch[1].split('\n').filter(c => c.trim()).map(c => c.replace(/^\d+\.\s*/, '').trim());
        fullStory = fullStory.replace(/选项:\n[\s\S]*/, '').trim();
      }
      
      setGameState(prev => ({ ...prev, storyText: fullStory, choices }));
      
      const updates = await extractStateUpdates(initialState, '在一个奇幻世界中开始新的冒险。', fullStory);
      setGameState(prev => applyStateUpdates(prev, updates));
      
      showToast('新冒险已开始');
    } catch (err: unknown) {
      setError((err as Error).message || '启动游戏失败');
      setIsGameStarted(false);
    } finally {
      setIsLoading(false);
    }
  };

  const saveGame = async () => {
    if (isGameStarted) {
      try {
        // Strip functions before saving to IndexedDB (structured clone doesn't support functions)
        const stateToSave: Partial<GameState> & Record<string, unknown> = { ...gameState };
        delete stateToSave.setGameState;
        delete stateToSave.addLog;
        delete stateToSave.addRecentHistory;
        delete stateToSave.useSkill;
        delete stateToSave.decrementCooldowns;
        delete stateToSave.loadGame;
        
        await idbSet('saved_game_state', stateToSave);
        showToast('游戏已手动保存');
        setIsSidebarOpen(false);
      } catch (err) {
        console.error('Failed to save game:', err);
        showToast('保存游戏失败');
      }
    }
  };

  const loadGame = async () => {
    try {
      const savedState = await idbGet('saved_game_state');
      if (savedState) {
        useGameStore.getState().loadGame(savedState);
        setIsGameStarted(true);
        showToast('已加载手动存档');
        setIsSidebarOpen(false);
      } else {
        showToast('没有找到手动存档');
      }
    } catch (err) {
      console.error('Failed to load game:', err);
      showToast('加载游戏失败');
    }
  };

  const exportSave = () => {
    if (isGameStarted) {
      try {
        const stateToExport: Partial<GameState> & Record<string, unknown> = { ...gameState };
        delete stateToExport.setGameState;
        delete stateToExport.addLog;
        delete stateToExport.addRecentHistory;
        delete stateToExport.useSkill;
        delete stateToExport.decrementCooldowns;
        delete stateToExport.loadGame;

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stateToExport));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `chronicles_save_${new Date().getTime()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showToast('存档已导出');
        setIsSidebarOpen(false);
      } catch (err) {
        console.error('Failed to export save:', err);
        showToast('导出存档失败');
      }
    }
  };

  const importSave = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          if (parsed && parsed.stats && parsed.memory) {
            useGameStore.getState().loadGame(parsed);
            setIsGameStarted(true);
            showToast('存档已导入');
            setIsSidebarOpen(false);
          } else {
            showToast('导入失败：无效的存档文件');
          }
        } catch (err) {
          console.error('Failed to import save:', err);
          showToast('导入存档失败：文件格式错误');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Handle body scroll lock on mobile when sidebar is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  const handleChoice = async (choice: string) => {
    if (!isGameStarted) return;
    setIsLoading(true);
    setError(null);
    
    // Save previous state to restore on error
    const previousState = { ...gameState };
    const previousCooldowns = { ...useGameStore.getState().skillCooldowns };
    const usedSkills = (gameState.skills || [])
      .filter(skill => choice.includes(skill.name))
      .map(skill => skill.name);

    // Evaluate action with arbitrator
    const tension = gameState.director?.tension || 10;
    const { rollMessage, actionType } = evaluateAction(choice, gameState.stats, tension);
    const actionWithRoll = `${choice}\n${rollMessage}`;

    try {
      // Clear previous choices and start streaming
      setGameState(prev => ({ ...prev, choices: [], storyText: '' }));
      
      let fullStory = '';
      const stream = generateStoryStream(gameState, actionWithRoll);
      for await (const chunk of stream) {
        fullStory += chunk;
        setGameState(prev => ({ ...prev, storyText: fullStory }));
      }
      
      // Parse choices
      let choices: string[] = [];
      const choicesMatch = fullStory.match(/选项:\n([\s\S]*)/);
      if (choicesMatch) {
        choices = choicesMatch[1].split('\n').filter(c => c.trim()).map(c => c.replace(/^\d+\.\s*/, '').trim());
        fullStory = fullStory.replace(/选项:\n[\s\S]*/, '').trim();
      }
      
      setGameState(prev => ({ ...prev, storyText: fullStory, choices }));
      
      const now = Date.now();
      useGameStore.getState().addLog({
        id: `${now}-choice`,
        timestamp: now,
        type: 'choice',
        text: `你选择了: ${choice}`
      });
      
      useGameStore.getState().addRecentHistory({ action: actionWithRoll, story: fullStory });
      
      const updates = await backgroundTaskQueue.enqueue(() => extractStateUpdates(gameState, actionWithRoll, fullStory));
      setGameState(prev => applyStateUpdates(prev, updates));
      useGameStore.setState({
        skillCooldowns: buildNextSkillCooldowns(previousCooldowns, usedSkills)
      });
      
      // Asynchronously update memory every 5 turns
      const currentState = useGameStore.getState();
      const choiceLogs = currentState.logs?.filter(l => l.type === 'choice') || [];
      
      if (choiceLogs.length > 0) {
        const recentHistory = currentState.recentHistory || [];
        const historyToPass = [];
        let currentLength = 0;
        for (let i = recentHistory.length - 1; i >= 0; i--) {
          const entry = recentHistory[i];
          const entryLength = entry.action.length + entry.story.length;
          if (currentLength + entryLength > 2000 && historyToPass.length > 0) {
            break;
          }
          historyToPass.unshift(entry);
          currentLength += entryLength;
        }

        // Update memory every 5 turns
        if (choiceLogs.length % 5 === 0) {
          backgroundTaskQueue.enqueue(() => updateGameMemory(currentState.memory || { summary: '', worldInfo: [] }, historyToPass))
            .then(updatedMemory => {
              setGameState(current => ({ ...current, memory: updatedMemory }));
            })
            .catch(err => console.error('Failed to update memory:', err));
        }

        // Update director every 3 turns
        if (choiceLogs.length % 3 === 0) {
          backgroundTaskQueue.enqueue(() => updateDirectorState(currentState, historyToPass))
            .then(updatedDirector => {
              setGameState(current => ({ ...current, director: updatedDirector }));
            })
            .catch(err => console.error('Failed to update director:', err));
        }
      }

    } catch (err: unknown) {
      setError((err as Error).message || '生成下一回合失败');
      // Restore previous state so user can retry
      setGameState(prev => ({
        ...prev,
        choices: previousState.choices,
        storyText: previousState.storyText
      }));
      useGameStore.setState({ skillCooldowns: previousCooldowns });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseSkill = (skill: string) => {
    if (isLoading || !isGameStarted) return;
    
    const cooldownEnd = skillCooldowns[skill];
    if (cooldownEnd && cooldownEnd > 0) {
      showToast(`${skill} 正在冷却中...`);
      return;
    }
    
    handleChoice(`使用技能: ${skill}`);
    setIsSidebarOpen(false);
  };

  if (!isGameStarted && isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative">
        <div className="atmosphere-bg" />
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-zinc-400 font-serif italic text-lg tracking-wide">正在编织世界...</p>
      </div>
    );
  }

  if (!isGameStarted && !isLoading && !error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative p-6">
        <div className="atmosphere-bg" />
        <div className="z-10 text-center max-w-2xl w-full">
          <h1 className="text-5xl md:text-7xl font-serif font-bold text-zinc-100 mb-6 tracking-wider drop-shadow-2xl">
            编年史
          </h1>
          <p className="text-zinc-400 font-serif italic text-lg md:text-xl mb-12 max-w-md mx-auto leading-relaxed">
            一个由人工智能驱动的无尽文字冒险游戏。你的每一个选择，都将重塑这个世界的命运。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={startGame}
              className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 text-lg"
            >
              开始新冒险
            </button>
            <button
              onClick={loadGame}
              className="px-8 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-medium transition-all border border-white/10 text-lg"
            >
              继续游戏
            </button>
            <button
              onClick={importSave}
              className="px-8 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-medium transition-all border border-white/10 text-lg"
            >
              导入存档
            </button>
          </div>
        </div>
        
        {/* Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-white/10 text-zinc-200 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (error && !isGameStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
        <div className="atmosphere-bg" />
        <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-xl text-center max-w-md backdrop-blur-md">
          <h2 className="text-red-400 font-bold mb-2">错误</h2>
          <p className="text-zinc-300 mb-4">{error}</p>
          <button onClick={startGame} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden relative">
      <div className="atmosphere-bg" />
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-black/40 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors relative"
          >
            <Menu className="w-5 h-5" />
            {gameState?.stats?.skillPoints && gameState.stats.skillPoints > 0 ? (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-black animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            ) : null}
          </button>
          <div className="flex flex-col">
            <h1 className="text-lg font-serif font-semibold tracking-wide text-zinc-100 leading-tight">编年史</h1>
            {isGameStarted && gameState.location && (
              <span className="text-[10px] text-emerald-400/80 flex items-center gap-1 mt-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {gameState.location}
              </span>
            )}
          </div>
        </div>
      </div>

      <Sidebar 
        onOpenWorldbook={() => { setIsWorldbookOpen(true); setIsSidebarOpen(false); }}
        onOpenLogs={() => { setIsLogsOpen(true); setIsSidebarOpen(false); }}
        onOpenDirector={() => { setIsDirectorOpen(true); setIsSidebarOpen(false); }}
        onSave={saveGame}
        onLoad={loadGame}
        onExport={exportSave}
        onImport={importSave}
        onNewGame={startGame}
        onUseSkill={handleUseSkill}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 relative overflow-y-auto overflow-x-hidden">
        {isGameStarted && (
          <div className="sticky top-0 z-30 p-4 md:p-6 pointer-events-none flex justify-center">
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="glass-panel pointer-events-auto px-4 py-3 md:px-6 md:py-4 rounded-2xl flex items-center justify-between gap-4 md:gap-8 shadow-2xl border-white/10 bg-black/60 backdrop-blur-xl w-full max-w-3xl mx-auto"
            >
              {/* HP */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                  <Heart className="w-4 h-4 md:w-5 md:h-5 text-red-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider hidden md:block mb-0.5">生命值</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm md:text-lg font-mono text-red-400 font-bold drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]">{gameState.stats.hp}</span>
                    <span className="text-[10px] md:text-xs text-zinc-600 font-mono">/{gameState.stats.maxHp}</span>
                  </div>
                </div>
              </div>

              <div className="w-px h-8 md:h-10 bg-white/10 shrink-0" />

              {/* Quest */}
              <div className="flex-1 min-w-0 flex items-center gap-3 justify-center">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shrink-0 hidden sm:flex shadow-[0_0_10px_rgba(99,102,241,0.1)]">
                  <Scroll className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
                </div>
                <div className="flex flex-col min-w-0 items-center sm:items-start text-center sm:text-left">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider hidden md:block mb-0.5">当前任务</span>
                  <span className="text-xs md:text-sm text-indigo-200 truncate font-serif w-full max-w-[120px] sm:max-w-[200px] md:max-w-[300px]">
                    {gameState.quests && gameState.quests.length > 0 ? gameState.quests[0].name : '自由探索...'}
                  </span>
                </div>
              </div>

              <div className="w-px h-8 md:h-10 bg-white/10 shrink-0" />

              {/* Gold */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider hidden md:block mb-0.5">金币</span>
                  <span className="text-sm md:text-lg font-mono text-yellow-400 font-bold drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">{gameState.stats.gold}</span>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
                  <Coins className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" />
                </div>
              </div>
            </motion.div>
          </div>
        )}

        <div className="max-w-4xl mx-auto p-4 md:p-12 pb-32 pt-2 md:pt-4">
          {isGameStarted && (
            <StoryView 
              onChoice={handleChoice} 
              onRestart={startGame}
              isLoading={isLoading} 
            />
          )}
          {error && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      </main>

      <LogsModal isOpen={isLogsOpen} onClose={() => setIsLogsOpen(false)} logs={gameState?.logs || []} />
      <DirectorModal isOpen={isDirectorOpen} onClose={() => setIsDirectorOpen(false)} director={gameState?.director} />
      <WorldbookModal
        isOpen={isWorldbookOpen}
        onClose={() => setIsWorldbookOpen(false)}
        worldInfo={gameState?.memory?.worldInfo || []}
      />

      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-50 glass-panel px-6 py-3 rounded-full border border-emerald-500/30 text-emerald-400 text-sm shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center gap-2 whitespace-nowrap"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
