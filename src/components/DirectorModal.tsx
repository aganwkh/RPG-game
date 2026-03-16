import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clapperboard, Activity, CalendarClock, Zap } from 'lucide-react';
import { DirectorState } from '../types';

interface DirectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  director?: DirectorState;
}

export function DirectorModal({ isOpen, onClose, director }: DirectorModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
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
          className="relative w-full max-w-2xl bg-zinc-900/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-black/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                <Clapperboard className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-serif font-bold text-zinc-100">大导演 (Director)</h2>
                <p className="text-xs text-zinc-400">全局故事大纲与节奏控制</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
            {!director ? (
              <div className="text-center text-zinc-500 py-8">
                导演正在构思剧本...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-zinc-400 mb-1">
                    <Activity className="w-4 h-4" />
                    <h3 className="text-sm font-medium uppercase tracking-wider">当前故事弧线 (Current Arc)</h3>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-zinc-200 font-serif">
                    {director.currentArc}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-zinc-400 mb-1">
                      <CalendarClock className="w-4 h-4" />
                      <h3 className="text-sm font-medium uppercase tracking-wider">全局节奏 (Pacing)</h3>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <span className="text-zinc-300 capitalize">{director.globalPacing}</span>
                      <div className="flex gap-1">
                        <div className={`w-2 h-8 rounded-full ${director.globalPacing === 'slow' ? 'bg-blue-500' : 'bg-zinc-700'}`} />
                        <div className={`w-2 h-8 rounded-full ${director.globalPacing === 'normal' ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                        <div className={`w-2 h-8 rounded-full ${director.globalPacing === 'fast' ? 'bg-red-500' : 'bg-zinc-700'}`} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-zinc-400 mb-1">
                      <Zap className="w-4 h-4" />
                      <h3 className="text-sm font-medium uppercase tracking-wider">紧张度 (Tension)</h3>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex justify-between text-xs text-zinc-500 mb-2">
                        <span>安全</span>
                        <span className="text-zinc-300">{director.tension}/100</span>
                        <span>危急</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500 transition-all duration-1000"
                          style={{ width: `${director.tension}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-zinc-400 mb-1">
                    <Clapperboard className="w-4 h-4" />
                    <h3 className="text-sm font-medium uppercase tracking-wider">即将发生的事件 (Upcoming Events)</h3>
                  </div>
                  <div className="space-y-2">
                    {director.upcomingEvents.length > 0 ? (
                      director.upcomingEvents.map((event, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/10 text-zinc-300 text-sm flex items-start gap-3">
                          <span className="text-purple-400 font-mono mt-0.5">{idx + 1}.</span>
                          <span>{event}</span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-zinc-500 text-sm italic">
                        暂无计划的事件
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
