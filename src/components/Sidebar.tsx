import React, { useState, useEffect } from 'react';
import { Backpack, Scroll, User, Settings, Save, Download, Heart, Coins, Star, Loader2, X, MapPin, Compass, BookOpen, Zap, Swords, Wind, Brain, Sparkles, Gem } from 'lucide-react';
import { CharacterStats, Skill } from '../types';
import { generateItemDescription, generateSkillDescription } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  inventory: string[];
  skills: Skill[];
  skillCooldowns: Record<string, number>;
  currentQuest: string;
  location: string;
  stats: CharacterStats;
  onOpenSettings: () => void;
  onOpenLogs: () => void;
  onSave: () => void;
  onLoad: () => void;
  onNewGame: () => void;
  onUseSkill: (skill: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ inventory, skills, skillCooldowns, currentQuest, location, stats, onOpenSettings, onOpenLogs, onSave, onLoad, onNewGame, onUseSkill, isOpen, onClose }: SidebarProps) {
  const [itemDescriptions, setItemDescriptions] = useState<Record<string, string>>({});
  const [skillDescriptions, setSkillDescriptions] = useState<Record<string, string>>({});
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredSkillIndex, setHoveredSkillIndex] = useState<number | null>(null);
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [loadingSkills, setLoadingSkills] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const [attrAnimations, setAttrAnimations] = useState<Record<string, { diff: number, id: number }>>({});
  const prevStatsRef = React.useRef(stats);

  useEffect(() => {
    const prevStats = prevStatsRef.current;
    const newAnims = { ...attrAnimations };
    let hasDiff = false;

    const attrs = ['strength', 'agility', 'intelligence', 'charisma', 'luck'] as const;
    attrs.forEach(attr => {
      const prevVal = prevStats.attributes?.[attr] || 10;
      const currVal = stats.attributes?.[attr] || 10;
      if (currVal > prevVal) {
        newAnims[attr] = { diff: currVal - prevVal, id: Date.now() + Math.random() };
        hasDiff = true;
      }
    });

    if (stats.level > prevStats.level) {
      newAnims['level'] = { diff: stats.level - prevStats.level, id: Date.now() + Math.random() };
      hasDiff = true;
    }

    if (stats.gold > prevStats.gold) {
      newAnims['gold'] = { diff: stats.gold - prevStats.gold, id: Date.now() + Math.random() };
      hasDiff = true;
    }

    if ((stats.exp || 0) > (prevStats.exp || 0) && stats.level === prevStats.level) {
      newAnims['exp'] = { diff: (stats.exp || 0) - (prevStats.exp || 0), id: Date.now() + Math.random() };
      hasDiff = true;
    }

    prevStatsRef.current = stats;

    if (hasDiff) {
      setAttrAnimations(newAnims);
      const timer = setTimeout(() => {
        setAttrAnimations({});
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [stats]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load saved descriptions on mount
  useEffect(() => {
    try {
      const savedItems = localStorage.getItem('item_descriptions');
      if (savedItems) {
        setItemDescriptions(JSON.parse(savedItems));
      }
      const savedSkills = localStorage.getItem('skill_descriptions');
      if (savedSkills) {
        setSkillDescriptions(JSON.parse(savedSkills));
      }
    } catch (e) {
      console.error("Failed to load descriptions", e);
    }
  }, []);

  // Fetch description when an item is hovered if we don't have it
  const handleItemHover = async (item: string, idx: number) => {
    setHoveredIndex(idx);
    
    if (itemDescriptions[item] || loadingItems.has(item)) {
      return;
    }

    setLoadingItems(prev => new Set(prev).add(item));
    
    try {
      const desc = await generateItemDescription(item, currentQuest);
      
      setItemDescriptions(prev => {
        const next = { ...prev, [item]: desc };
        localStorage.setItem('item_descriptions', JSON.stringify(next));
        return next;
      });
    } catch (e) {
      console.error("Failed to fetch item description", e);
    } finally {
      setLoadingItems(prev => {
        const next = new Set(prev);
        next.delete(item);
        return next;
      });
    }
  };

  // Fetch description when a skill is hovered if we don't have it
  const handleSkillHover = async (skillName: string, idx: number) => {
    setHoveredSkillIndex(idx);
    
    if (skillDescriptions[skillName] || loadingSkills.has(skillName)) {
      return;
    }

    setLoadingSkills(prev => new Set(prev).add(skillName));
    
    try {
      const desc = await generateSkillDescription(skillName, currentQuest);
      
      setSkillDescriptions(prev => {
        const next = { ...prev, [skillName]: desc };
        localStorage.setItem('skill_descriptions', JSON.stringify(next));
        return next;
      });
    } catch (e) {
      console.error("Failed to fetch skill description", e);
    } finally {
      setLoadingSkills(prev => {
        const next = new Set(prev);
        next.delete(skillName);
        return next;
      });
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <aside 
        className={`fixed md:static inset-y-0 left-0 w-80 border-r border-white/5 bg-black/80 md:bg-black/40 backdrop-blur-2xl flex flex-col h-screen overflow-y-auto shrink-0 z-50 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-serif font-semibold tracking-wide text-zinc-100">编年史</h1>
            <p className="text-xs text-indigo-400/80 uppercase tracking-[0.2em] mt-2">无尽冒险</p>
          </div>
          <button 
            onClick={onClose}
            className="md:hidden p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      <div className="p-8 flex-1 flex flex-col gap-10">
        <section>
          <div className="flex items-center gap-2 mb-5 text-zinc-400">
            <User className="w-4 h-4" />
            <h2 className="text-xs font-semibold uppercase tracking-widest">角色状态</h2>
          </div>
          
          <div className="flex flex-col gap-4">
            {/* HP Bar */}
            <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3 relative overflow-hidden group">
              <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Heart className="w-3.5 h-3.5 text-red-400/80" />
                  <span className="text-xs font-semibold uppercase tracking-widest">生命值</span>
                </div>
                <span className="text-xs font-mono text-zinc-300">{stats.hp} / {stats.maxHp}</span>
              </div>
              <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5 relative z-10">
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)] transition-all duration-500 ease-out" 
                  style={{ width: `${Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100))}%` }}
                />
              </div>
            </div>

            {/* EXP Bar */}
            <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3 relative overflow-hidden group">
              <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Star className="w-3.5 h-3.5 text-indigo-400/80" />
                  <span className="text-xs font-semibold uppercase tracking-widest">经验值</span>
                </div>
                <div className="relative">
                  <span className="text-xs font-mono text-zinc-300">{stats.exp || 0} / {stats.maxExp || 100}</span>
                  <AnimatePresence>
                    {attrAnimations['exp'] && (
                      <motion.span
                        key={attrAnimations['exp'].id}
                        initial={{ opacity: 0, y: 10, scale: 0.5 }}
                        animate={{ opacity: 1, y: 0, scale: 1.2 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 -top-4 text-xs font-bold text-indigo-300 drop-shadow-[0_0_5px_rgba(129,140,248,0.8)] z-20"
                      >
                        +{attrAnimations['exp'].diff}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5 relative z-10">
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full shadow-[0_0_10px_rgba(129,140,248,0.5)] transition-all duration-500 ease-out" 
                  style={{ width: `${Math.max(0, Math.min(100, ((stats.exp || 0) / (stats.maxExp || 100)) * 100))}%` }}
                />
              </div>
            </div>

            {/* Level & Gold Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center gap-2 relative overflow-hidden group">
                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="flex items-center gap-1.5 text-zinc-500 relative z-10">
                  <Star className="w-3 h-3 text-indigo-400/80" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest">等级</span>
                </div>
                <div className="relative z-10">
                  <span className="text-2xl font-serif text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.3)]">{stats.level}</span>
                  <AnimatePresence>
                    {attrAnimations['level'] && (
                      <motion.span
                        key={attrAnimations['level'].id}
                        initial={{ opacity: 0, y: 10, scale: 0.5 }}
                        animate={{ opacity: 1, y: 0, scale: 1.2 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute -right-6 -top-2 text-sm font-bold text-indigo-300 drop-shadow-[0_0_5px_rgba(129,140,248,0.8)] z-20"
                      >
                        +{attrAnimations['level'].diff}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                {stats.skillPoints && stats.skillPoints > 0 ? (
                  <span className="absolute top-3 right-3 w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]" title={`${stats.skillPoints} 技能点可用`} />
                ) : null}
              </div>
              <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center gap-2 relative overflow-hidden group">
                <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="flex items-center gap-1.5 text-zinc-500 relative z-10">
                  <Coins className="w-3 h-3 text-yellow-400/80" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest">金币</span>
                </div>
                <div className="relative z-10">
                  <span className="text-2xl font-mono text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]">{stats.gold}</span>
                  <AnimatePresence>
                    {attrAnimations['gold'] && (
                      <motion.span
                        key={attrAnimations['gold'].id}
                        initial={{ opacity: 0, y: 10, scale: 0.5 }}
                        animate={{ opacity: 1, y: 0, scale: 1.2 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute -right-8 -top-2 text-sm font-bold text-yellow-300 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)] z-20"
                      >
                        +{attrAnimations['gold'].diff}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Attributes */}
            <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Swords className="w-3.5 h-3.5 text-red-400/80" />
                    <span className="text-xs font-semibold uppercase tracking-widest">力量</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-300">{stats.attributes?.strength || 10}</span>
                    <AnimatePresence>
                      {attrAnimations['strength'] && (
                        <motion.span
                          key={attrAnimations['strength'].id}
                          initial={{ opacity: 0, y: 10, scale: 0.5 }}
                          animate={{ opacity: 1, y: 0, scale: 1.2 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 -top-4 text-xs font-bold text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)] z-20"
                        >
                          +{attrAnimations['strength'].diff}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Wind className="w-3.5 h-3.5 text-emerald-400/80" />
                    <span className="text-xs font-semibold uppercase tracking-widest">敏捷</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-300">{stats.attributes?.agility || 10}</span>
                    <AnimatePresence>
                      {attrAnimations['agility'] && (
                        <motion.span
                          key={attrAnimations['agility'].id}
                          initial={{ opacity: 0, y: 10, scale: 0.5 }}
                          animate={{ opacity: 1, y: 0, scale: 1.2 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 -top-4 text-xs font-bold text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)] z-20"
                        >
                          +{attrAnimations['agility'].diff}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Brain className="w-3.5 h-3.5 text-blue-400/80" />
                    <span className="text-xs font-semibold uppercase tracking-widest">智力</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-300">{stats.attributes?.intelligence || 10}</span>
                    <AnimatePresence>
                      {attrAnimations['intelligence'] && (
                        <motion.span
                          key={attrAnimations['intelligence'].id}
                          initial={{ opacity: 0, y: 10, scale: 0.5 }}
                          animate={{ opacity: 1, y: 0, scale: 1.2 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 -top-4 text-xs font-bold text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)] z-20"
                        >
                          +{attrAnimations['intelligence'].diff}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400/80" />
                    <span className="text-xs font-semibold uppercase tracking-widest">魅力</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-300">{stats.attributes?.charisma || 10}</span>
                    <AnimatePresence>
                      {attrAnimations['charisma'] && (
                        <motion.span
                          key={attrAnimations['charisma'].id}
                          initial={{ opacity: 0, y: 10, scale: 0.5 }}
                          animate={{ opacity: 1, y: 0, scale: 1.2 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 -top-4 text-xs font-bold text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)] z-20"
                        >
                          +{attrAnimations['charisma'].diff}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div className="flex items-center justify-between col-span-2 relative">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Gem className="w-3.5 h-3.5 text-amber-400/80" />
                    <span className="text-xs font-semibold uppercase tracking-widest">幸运</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-300">{stats.attributes?.luck || 10}</span>
                    <AnimatePresence>
                      {attrAnimations['luck'] && (
                        <motion.span
                          key={attrAnimations['luck'].id}
                          initial={{ opacity: 0, y: 10, scale: 0.5 }}
                          animate={{ opacity: 1, y: 0, scale: 1.2 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 -top-4 text-xs font-bold text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)] z-20"
                        >
                          +{attrAnimations['luck'].diff}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-5 text-zinc-400">
            <MapPin className="w-4 h-4" />
            <h2 className="text-xs font-semibold uppercase tracking-widest">当前位置</h2>
          </div>
          <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group border-emerald-500/20">
            <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent" />
            <div className="absolute right-[-10px] top-[-10px] opacity-10 pointer-events-none">
              <Compass className="w-24 h-24 animate-[spin_60s_linear_infinite]" />
            </div>
            <p className="text-base text-emerald-300 leading-relaxed font-serif relative z-10 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400/80 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse" />
              <span className="drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">{location || '未知地点'}</span>
            </p>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-5 text-zinc-400">
            <Scroll className="w-4 h-4" />
            <h2 className="text-xs font-semibold uppercase tracking-widest">当前任务</h2>
          </div>
          <div className="glass-panel p-5 rounded-2xl">
            <p className="text-sm text-zinc-300 leading-relaxed font-serif">
              {currentQuest || '漫无目的地游荡...'}
            </p>
          </div>
        </section>

        <section>
          <button 
            onClick={onOpenLogs}
            className="w-full glass-panel p-4 rounded-2xl flex items-center justify-between group hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3 text-zinc-300 group-hover:text-indigo-300 transition-colors">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:border-indigo-500/40 transition-colors">
                <BookOpen className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="font-serif font-medium tracking-wide">冒险日志</span>
            </div>
            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
              <span className="text-xs text-zinc-500 group-hover:text-indigo-400">→</span>
            </div>
          </button>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-5 text-zinc-400">
            <Backpack className="w-4 h-4" />
            <h2 className="text-xs font-semibold uppercase tracking-widest">物品栏</h2>
          </div>
          <ul className="space-y-2">
            {inventory.length > 0 ? (
              inventory.map((item, idx) => (
                <li 
                  key={idx} 
                  className="relative group"
                  onMouseEnter={() => handleItemHover(item, idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="glass-panel px-5 py-3.5 rounded-xl text-sm text-zinc-300 flex items-center gap-3 hover:bg-white/5 transition-colors cursor-help">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                    <span className="font-serif">{item}</span>
                  </div>
                  
                  {/* Tooltip */}
                  <AnimatePresence>
                    {hoveredIndex === idx && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="md:absolute md:left-full md:ml-4 md:top-1/2 md:-translate-y-1/2 md:w-64 z-50 pointer-events-none mt-2 md:mt-0"
                      >
                        <div className="glass-panel p-4 rounded-xl border border-indigo-500/20 shadow-2xl bg-black/80 backdrop-blur-2xl relative">
                          {/* Arrow (Desktop only) */}
                          <div className="hidden md:block absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 rotate-45 border-l border-b border-indigo-500/20 bg-black/80" />
                          
                          <h3 className="text-indigo-300 font-serif font-semibold mb-2 text-sm">{item}</h3>
                          
                          {loadingItems.has(item) ? (
                            <div className="flex items-center gap-2 text-zinc-500 text-xs">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>正在鉴定...</span>
                            </div>
                          ) : (
                            <p className="text-zinc-400 text-xs leading-relaxed font-serif">
                              {itemDescriptions[item] || '一个神秘的物品。'}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              ))
            ) : (
              <li className="text-sm text-zinc-500 italic font-serif px-2">你的口袋空空如也。</li>
            )}
          </ul>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-5 text-zinc-400">
            <Zap className="w-4 h-4" />
            <h2 className="text-xs font-semibold uppercase tracking-widest">技能</h2>
            {stats.skillPoints && stats.skillPoints > 0 ? (
              <span className="ml-auto flex items-center justify-center bg-amber-500 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]">
                {stats.skillPoints} 可用
              </span>
            ) : null}
          </div>
          <ul className="space-y-2">
            {skills && skills.length > 0 ? (
              skills.map((skillObj, idx) => {
                const skill = skillObj.name;
                const cooldownEnd = skillCooldowns[skill];
                const isOnCooldown = Boolean(cooldownEnd && now < cooldownEnd);
                const cooldownPercent = isOnCooldown ? Math.max(0, Math.min(100, ((cooldownEnd - now) / 30000) * 100)) : 0;
                
                // Calculate EXP progress
                const expNeeded = skillObj.level === 1 ? 100 : 
                                  skillObj.level === 2 ? 300 : 
                                  skillObj.level === 3 ? 700 : 
                                  skillObj.level === 4 ? 1500 : 
                                  skillObj.level === 5 ? 3100 : 
                                  skillObj.level === 6 ? 6300 : 
                                  skillObj.level === 7 ? 12700 : 
                                  skillObj.level === 8 ? 25500 : 
                                  skillObj.level === 9 ? 51100 : 
                                  skillObj.level === 10 ? 102300 : 
                                  skillObj.level === 11 ? 204700 : 
                                  skillObj.level === 12 ? 409500 : 
                                  skillObj.level === 13 ? 819100 : 
                                  skillObj.level === 14 ? 1638300 : 3276700;
                const expPercent = skillObj.level >= skillObj.maxLevel ? 100 : Math.min(100, (skillObj.exp / expNeeded) * 100);

                return (
                  <li 
                    key={idx}
                    className="relative group"
                    onMouseEnter={() => handleSkillHover(skill, idx)}
                    onMouseLeave={() => setHoveredSkillIndex(null)}
                  >
                    <button 
                      onClick={() => !isOnCooldown && onUseSkill(skill)}
                      disabled={isOnCooldown}
                      className={`w-full text-left relative overflow-hidden glass-panel px-5 py-3.5 rounded-xl text-sm flex flex-col gap-1 transition-all ${
                        isOnCooldown 
                          ? 'opacity-60 cursor-not-allowed border-white/5 bg-black/40' 
                          : 'text-amber-200/80 border-amber-500/10 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/30 cursor-pointer'
                      }`}
                    >
                      {isOnCooldown && (
                        <div 
                          className="absolute bottom-0 left-0 h-1 bg-amber-500/50 transition-all duration-1000 ease-linear"
                          style={{ width: `${cooldownPercent}%` }}
                        />
                      )}
                      
                      {/* EXP Bar */}
                      {!isOnCooldown && (
                         <div 
                          className="absolute bottom-0 left-0 h-0.5 bg-amber-500/30 transition-all duration-500 ease-out"
                          style={{ width: `${expPercent}%` }}
                        />
                      )}

                      <div className="flex items-center gap-3 w-full">
                        <div className={`w-1.5 h-1.5 rounded-full ${isOnCooldown ? 'bg-zinc-600' : 'bg-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
                        <span className={`font-serif flex-1 ${isOnCooldown ? 'text-zinc-400' : ''}`}>{skill}</span>
                        {isOnCooldown && (
                          <span className="text-[10px] font-mono text-amber-500/80">
                            {Math.ceil((cooldownEnd - now) / 1000)}s
                          </span>
                        )}
                        {!isOnCooldown && (
                          <span className="text-[10px] font-mono text-amber-500/60">
                            Lv.{skillObj.level}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Tooltip */}
                    <AnimatePresence>
                      {hoveredSkillIndex === idx && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="md:absolute md:left-full md:ml-4 md:top-1/2 md:-translate-y-1/2 md:w-64 z-50 pointer-events-none mt-2 md:mt-0"
                        >
                          <div className="glass-panel p-4 rounded-xl border border-amber-500/20 shadow-2xl bg-black/80 backdrop-blur-2xl relative">
                            {/* Arrow (Desktop only) */}
                            <div className="hidden md:block absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 rotate-45 border-l border-b border-amber-500/20 bg-black/80" />
                            
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="text-amber-300 font-serif font-semibold text-sm">{skill}</h3>
                              <span className="text-[10px] font-mono text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                {skillObj.level >= skillObj.maxLevel ? 'MAX' : `Lv.${skillObj.level}/${skillObj.maxLevel}`}
                              </span>
                            </div>
                            
                            {loadingSkills.has(skill) ? (
                              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>正在回忆...</span>
                              </div>
                            ) : (
                              <p className="text-zinc-400 text-xs leading-relaxed font-serif mb-3">
                                {skillDescriptions[skill] || '一种强大的能力，蕴含着未知的力量。'}
                              </p>
                            )}

                            {/* EXP Progress inside tooltip */}
                            <div className="mt-2 pt-2 border-t border-white/5">
                              <div className="flex justify-between text-[10px] text-zinc-500 mb-1 font-mono">
                                <span>经验值</span>
                                <span>{skillObj.level >= skillObj.maxLevel ? 'MAX' : `${skillObj.exp} / ${expNeeded}`}</span>
                              </div>
                              <div className="h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
                                <div 
                                  className="h-full bg-amber-500/60 rounded-full transition-all duration-500" 
                                  style={{ width: `${expPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })
            ) : (
              <li className="text-sm text-zinc-500 italic font-serif px-2">尚未掌握任何技能。</li>
            )}
          </ul>
        </section>
      </div>

      <div className="p-6 border-t border-white/5 bg-black/20 flex flex-col gap-2">
        <button 
          onClick={onNewGame}
          className="flex items-center justify-center gap-2 text-zinc-400 hover:text-amber-400 transition-all duration-300 w-full p-3 rounded-xl hover:bg-white/10 border border-transparent hover:border-amber-400/30 mb-2"
          title="开始新游戏"
        >
          <span className="text-sm font-medium tracking-wide">新游戏</span>
        </button>
        <div className="flex gap-2">
          <button 
            onClick={onSave}
            className="flex-1 flex items-center justify-center gap-2 text-zinc-400 hover:text-emerald-400 transition-all duration-300 p-3 rounded-xl hover:bg-white/10 border border-transparent hover:border-emerald-400/30"
            title="保存游戏"
          >
            <Save className="w-4 h-4" />
            <span className="text-sm font-medium tracking-wide">保存</span>
          </button>
          <button 
            onClick={onLoad}
            className="flex-1 flex items-center justify-center gap-2 text-zinc-400 hover:text-blue-400 transition-all duration-300 p-3 rounded-xl hover:bg-white/10 border border-transparent hover:border-blue-400/30"
            title="加载游戏"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium tracking-wide">加载</span>
          </button>
        </div>
        <button 
          onClick={onOpenSettings}
          className="flex items-center justify-center gap-2 text-zinc-400 hover:text-white transition-all duration-300 w-full p-3 rounded-xl hover:bg-white/10 border border-transparent hover:border-white/10"
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium tracking-wide">API 设置</span>
        </button>
      </div>
    </aside>
    </>
  );
}
