import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BookOpen, MapPin, Star, Coins, Scroll, Zap, Swords, Flame } from 'lucide-react';
import { LogEntry } from '../types';

interface LogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
}

export function LogsModal({ isOpen, onClose, logs }: LogsModalProps) {
  if (!isOpen) return null;

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'choice': return <Zap className="w-4 h-4 text-amber-400" />;
      case 'location': return <MapPin className="w-4 h-4 text-emerald-400" />;
      case 'level_up': return <Star className="w-4 h-4 text-indigo-400" />;
      case 'item': return <Coins className="w-4 h-4 text-yellow-400" />;
      case 'event': return <Scroll className="w-4 h-4 text-blue-400" />;
      case 'system': return <BookOpen className="w-4 h-4 text-zinc-400" />;
      case 'combat': return <Swords className="w-4 h-4 text-red-400" />;
      case 'skill': return <Flame className="w-4 h-4 text-orange-400" />;
      default: return <BookOpen className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'choice': return 'border-amber-500/20 bg-amber-500/5 text-amber-200';
      case 'location': return 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200';
      case 'level_up': return 'border-indigo-500/20 bg-indigo-500/5 text-indigo-200';
      case 'item': return 'border-yellow-500/20 bg-yellow-500/5 text-yellow-200';
      case 'event': return 'border-blue-500/20 bg-blue-500/5 text-blue-200';
      case 'system': return 'border-zinc-500/20 bg-zinc-500/5 text-zinc-300';
      case 'combat': return 'border-red-500/20 bg-red-500/5 text-red-200';
      case 'skill': return 'border-orange-500/20 bg-orange-500/5 text-orange-200';
      default: return 'border-zinc-500/20 bg-zinc-500/5 text-zinc-300';
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Sort logs in reverse chronological order
  const sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl max-h-[80vh] flex flex-col glass-panel rounded-2xl border border-white/10 shadow-2xl overflow-hidden bg-black/80"
        >
          <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <BookOpen className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-serif font-semibold text-zinc-100 tracking-wide">冒险日志</h2>
                <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">Chronicles</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            {sortedLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-500 font-serif italic">
                <BookOpen className="w-8 h-8 mb-3 opacity-50" />
                <p>日志中还没有记录任何事情...</p>
              </div>
            ) : (
              <div className="relative border-l border-white/10 ml-4 space-y-6 pb-4">
                {sortedLogs.map((log, index) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={log.id} 
                    className="relative pl-6"
                  >
                    {/* Timeline dot */}
                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-black border border-white/30" />
                    
                    <div className={`p-4 rounded-xl border ${getLogColor(log.type)} backdrop-blur-sm`}>
                      <div className="flex items-center gap-2 mb-2">
                        {getLogIcon(log.type)}
                        <span className="text-xs font-mono opacity-60">{formatDate(log.timestamp)}</span>
                      </div>
                      <p className="text-sm font-serif leading-relaxed">
                        {log.text}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
