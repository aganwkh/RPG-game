import React from 'react';
import { motion } from 'motion/react';
import { useGameStore } from '../store/gameStore';
import { Loader2 } from 'lucide-react';
import { FormattedText } from './FormattedText';

interface StoryViewProps {
  onChoice: (choice: string) => void;
  onRestart: () => void;
  isLoading: boolean;
}

export function StoryView({ onChoice, onRestart, isLoading }: StoryViewProps) {
  const storyText = useGameStore(state => state.storyText);
  const choices = useGameStore(state => state.choices);

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="prose prose-invert max-w-none prose-p:leading-relaxed prose-p:mb-4 text-zinc-300 text-lg md:text-xl font-serif"
      >
        <div className="markdown-body">
          <FormattedText text={storyText || ''} />
        </div>
      </motion.div>

      {isLoading && (
        <div className="flex items-center gap-3 text-zinc-500 italic mt-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>世界正在发生变化...</span>
        </div>
      )}

      {!isLoading && choices && choices.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col gap-3 mt-8"
        >
          {choices.map((choice, idx) => (
            <button
              key={idx}
              onClick={() => onChoice(choice)}
              className="text-left p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all text-zinc-300 hover:text-white"
            >
              <FormattedText text={choice} className="text-base" />
            </button>
          ))}
        </motion.div>
      )}

      {!isLoading && (!choices || choices.length === 0) && storyText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 pt-8 border-t border-zinc-800"
        >
          <button
            onClick={onRestart}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
          >
            开始新的旅程
          </button>
        </motion.div>
      )}
    </div>
  );
}
