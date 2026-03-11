import React, { useState, useEffect } from 'react';
import { generateStoryTurn } from '../services/ai';
import { GameState, LogEntry } from '../types';
import { Sidebar } from './Sidebar';
import { StoryView } from './StoryView';
import { Chatbot } from './Chatbot';
import { SettingsModal } from './SettingsModal';
import { LogsModal } from './LogsModal';
import { Loader2, Menu, MapPin, Heart, Coins, Scroll } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Game() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [skillCooldowns, setSkillCooldowns] = useState<Record<string, number>>({});

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const startGame = async () => {
    setIsLoading(true);
    setError(null);
    setIsSidebarOpen(false);
    try {
      const state = await generateStoryTurn('', '在一个奇幻世界中开始新的冒险。', [], [], '', { 
        hp: 100, 
        maxHp: 100, 
        gold: 0, 
        level: 1, 
        exp: 0,
        maxExp: 100,
        skillPoints: 0,
        attributes: {
          strength: 10,
          agility: 10,
          intelligence: 10,
          charisma: 10,
          luck: 10
        }
      }, '未知地点');
      
      // Initialize logs
      state.logs = [{
        id: Date.now().toString(),
        timestamp: Date.now(),
        type: 'system',
        text: '冒险开始了...'
      }];
      
      setGameState(state);
      showToast('新冒险已开始');
    } catch (err: any) {
      setError(err.message || '启动游戏失败');
    } finally {
      setIsLoading(false);
    }
  };

  const saveGame = () => {
    if (gameState) {
      try {
        localStorage.setItem('saved_game_state', JSON.stringify(gameState));
        showToast('游戏已手动保存');
        setIsSidebarOpen(false);
      } catch (err) {
        console.error('Failed to save game:', err);
        showToast('保存游戏失败');
      }
    }
  };

  const loadGame = () => {
    try {
      const savedState = localStorage.getItem('saved_game_state');
      if (savedState) {
        setGameState(JSON.parse(savedState));
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

  // Initial load
  useEffect(() => {
    startGame();
  }, []);

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
    if (!gameState) return;
    setIsLoading(true);
    setError(null);
    
    // Check if the choice uses any skills and put them on cooldown
    if (gameState.skills) {
      const usedSkills = gameState.skills.filter(skill => choice.includes(skill.name));
      if (usedSkills.length > 0) {
        setSkillCooldowns(prev => {
          const next = { ...prev };
          const now = Date.now();
          usedSkills.forEach(skill => {
            next[skill.name] = now + 30000; // 30 seconds cooldown
          });
          return next;
        });
      }
    }

    try {
      const newState = await generateStoryTurn(
        gameState.storyText, 
        choice, 
        gameState.inventory, 
        gameState.skills || [],
        gameState.currentQuest,
        gameState.stats,
        gameState.location
      );
      
      // Generate logs based on state changes
      const newLogs: LogEntry[] = [];
      const now = Date.now();
      
      newLogs.push({
        id: `${now}-choice`,
        timestamp: now,
        type: 'choice',
        text: `你选择了: ${choice}`
      });

      if (newState.location && newState.location !== gameState.location) {
        newLogs.push({
          id: `${now}-location`,
          timestamp: now + 1,
          type: 'location',
          text: `到达新地点: ${newState.location}`
        });
      }

      if (newState.stats.level > gameState.stats.level) {
        newLogs.push({
          id: `${now}-level`,
          timestamp: now + 2,
          type: 'level_up',
          text: `升级了！当前等级: ${newState.stats.level}`
        });
      }

      if ((newState.stats.exp || 0) > (gameState.stats.exp || 0) && newState.stats.level === gameState.stats.level) {
        newLogs.push({
          id: `${now}-exp`,
          timestamp: now + 2.5,
          type: 'event',
          text: `获得了 ${newState.stats.exp! - (gameState.stats.exp || 0)} 点经验值`
        });
      }

      const oldAttrs = gameState.stats.attributes || { strength: 10, agility: 10, intelligence: 10, charisma: 10, luck: 10 };
      const newAttrs = newState.stats.attributes || { strength: 10, agility: 10, intelligence: 10, charisma: 10, luck: 10 };
      
      const attrNames: Record<keyof typeof oldAttrs, string> = {
        strength: '力量',
        agility: '敏捷',
        intelligence: '智力',
        charisma: '魅力',
        luck: '幸运'
      };

      (Object.keys(attrNames) as Array<keyof typeof oldAttrs>).forEach((key, index) => {
        if (newAttrs[key] > oldAttrs[key]) {
          newLogs.push({
            id: `${now}-attr-${key}-${index}`,
            timestamp: now + 10 + index,
            type: 'level_up',
            text: `属性提升！${attrNames[key]} +${newAttrs[key] - oldAttrs[key]} (当前: ${newAttrs[key]})`
          });
        }
      });

      const newItems = newState.inventory.filter(item => !gameState.inventory.includes(item));
      newItems.forEach((item, index) => {
        newLogs.push({
          id: `${now}-item-${index}`,
          timestamp: now + 3 + index,
          type: 'item',
          text: `获得了物品: ${item}`
        });
      });

      const newSkills = (newState.skills || []).filter(skill => !(gameState.skills || []).some(s => s.name === skill.name));
      newSkills.forEach((skill, index) => {
        newLogs.push({
          id: `${now}-skill-${index}`,
          timestamp: now + 4 + index,
          type: 'skill',
          text: `学会了新技能: ${skill.name}`
        });
      });

      const leveledUpSkills = (newState.skills || []).filter(skill => {
        const oldSkill = (gameState.skills || []).find(s => s.name === skill.name);
        return oldSkill && skill.level > oldSkill.level;
      });
      leveledUpSkills.forEach((skill, index) => {
        newLogs.push({
          id: `${now}-skill-lvl-${index}`,
          timestamp: now + 4.5 + index,
          type: 'skill',
          text: `技能升级！${skill.name} 达到了等级 ${skill.level}`
        });
      });
      
      if (newState.combatLogs && newState.combatLogs.length > 0) {
        newState.combatLogs.forEach((log, index) => {
          newLogs.push({
            id: `${now}-combat-${index}`,
            timestamp: now + 5 + index,
            type: 'combat',
            text: log
          });
        });
      }

      // Add a generic event log for the story turn (optional, maybe too spammy, let's keep it clean)
      // newLogs.push({
      //   id: `${now}-event`,
      //   timestamp: now + 10,
      //   type: 'event',
      //   text: '经历了一段新的遭遇。'
      // });

      newState.logs = [...(gameState.logs || []), ...newLogs];
      
      setGameState(newState);
    } catch (err: any) {
      setError(err.message || '生成下一回合失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseSkill = (skill: string) => {
    if (isLoading || !gameState) return;
    
    const cooldownEnd = skillCooldowns[skill];
    if (cooldownEnd && Date.now() < cooldownEnd) {
      showToast(`${skill} 正在冷却中...`);
      return;
    }
    
    handleChoice(`使用技能: ${skill}`);
    setIsSidebarOpen(false);
  };

  if (!gameState && isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative">
        <div className="atmosphere-bg" />
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-zinc-400 font-serif italic text-lg tracking-wide">正在编织世界...</p>
      </div>
    );
  }

  if (error && !gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
        <div className="atmosphere-bg" />
        <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-xl text-center max-w-md backdrop-blur-md">
          <h2 className="text-red-400 font-bold mb-2">错误</h2>
          <p className="text-zinc-300 mb-4">{error}</p>
          <button onClick={startGame} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors">
            重试
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="px-4 py-2 ml-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-colors">
            API 设置
          </button>
        </div>
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
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
            {gameState && gameState.location && (
              <span className="text-[10px] text-emerald-400/80 flex items-center gap-1 mt-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {gameState.location}
              </span>
            )}
          </div>
        </div>
      </div>

      <Sidebar 
        inventory={gameState?.inventory || []} 
        skills={gameState?.skills || []}
        skillCooldowns={skillCooldowns}
        currentQuest={gameState?.currentQuest || ''} 
        location={gameState?.location || ''}
        stats={gameState?.stats || { 
          hp: 100, maxHp: 100, gold: 0, level: 1, exp: 0, maxExp: 100, skillPoints: 0, 
          attributes: { strength: 10, agility: 10, intelligence: 10, charisma: 10, luck: 10 } 
        }}
        onOpenSettings={() => { setIsSettingsOpen(true); setIsSidebarOpen(false); }}
        onOpenLogs={() => { setIsLogsOpen(true); setIsSidebarOpen(false); }}
        onSave={saveGame}
        onLoad={loadGame}
        onNewGame={startGame}
        onUseSkill={handleUseSkill}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 relative overflow-y-auto overflow-x-hidden">
        {gameState && (
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
                    {gameState.currentQuest || '自由探索...'}
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
          {gameState && (
            <StoryView 
              gameState={gameState} 
              onChoice={handleChoice} 
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

      <Chatbot gameState={gameState} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <LogsModal isOpen={isLogsOpen} onClose={() => setIsLogsOpen(false)} logs={gameState?.logs || []} />

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
