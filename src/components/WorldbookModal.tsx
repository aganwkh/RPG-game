import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface WorldbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldInfo: { keywords: string[], content: string }[];
}

export function WorldbookModal({ isOpen, onClose, worldInfo }: WorldbookModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl relative"
          >
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-zinc-100">世界书</h2>
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {worldInfo.length === 0 ? (
                <p className="text-zinc-500 text-center italic">尚未发现任何世界信息。</p>
              ) : (
                worldInfo.map((info, idx) => (
                  <div key={idx} className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
                    <h3 className="text-sm font-medium text-indigo-400 mb-2">{info.keywords?.join(', ') || '传说'}</h3>
                    <p className="text-sm text-zinc-300">{info.content}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
