import React, { useState, useEffect } from 'react';
import { GameState } from '../types';
import { Loader2, Swords, Wind, Brain, Sparkles, Gem } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StoryViewProps {
  gameState: GameState;
  onChoice: (choice: string) => void;
  onRestart: () => void;
  isLoading: boolean;
}

type ASTNode = {
  type: 'root' | 'text' | 'bold' | 'color' | 'anim';
  value?: string;
  tag?: string;
  children: ASTNode[];
};

const renderChoiceText = (choice: string) => {
  const regex = /\[(力量|敏捷|智力|魅力|幸运)(?:检定|鉴定)\]\s*/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(choice)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{choice.substring(lastIndex, match.index)}</span>);
    }
    const attr = match[1];
    let Icon = null;
    let colorClass = '';
    switch (attr) {
      case '力量':
        Icon = Swords;
        colorClass = 'text-red-400/80';
        break;
      case '敏捷':
        Icon = Wind;
        colorClass = 'text-emerald-400/80';
        break;
      case '智力':
        Icon = Brain;
        colorClass = 'text-blue-400/80';
        break;
      case '魅力':
        Icon = Sparkles;
        colorClass = 'text-purple-400/80';
        break;
      case '幸运':
        Icon = Gem;
        colorClass = 'text-amber-400/80';
        break;
    }
    
    parts.push(
      <span key={`icon-${match.index}`} className="inline-flex items-center gap-1.5 mr-2 px-2 py-0.5 rounded-md bg-black/20 border border-white/5 align-middle" title={`${attr}鉴定`}>
        {Icon && <Icon className={`w-3.5 h-3.5 ${colorClass}`} />}
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{attr}</span>
      </span>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < choice.length) {
    parts.push(<span key={`text-${lastIndex}`}>{choice.substring(lastIndex)}</span>);
  }

  return parts.length > 0 ? <>{parts}</> : choice;
};

// Robust parser to handle markdown-like syntax for colors, bold, and animations
// Handles missing closing tags and newlines gracefully.
const renderFormattedText = (text: string): React.ReactNode => {
  if (!text) return null;

  const root: ASTNode = { type: 'root', children: [] };
  const stack: ASTNode[] = [root];

  let lastIndex = 0;
  const tokenRegex = /(\[\/?\s*(?:red|blue|green|yellow|purple|indigo|orange|gold|cyan|pink|teal|lime|fuchsia|rose|sky|amber|gray|white|black|wave|shake|glitch|pulse|bounce|spin|float|flicker|glow)\s*\]|\*\*)/gi;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    const textBefore = text.substring(lastIndex, match.index);
    if (textBefore) {
      stack[stack.length - 1].children.push({ type: 'text', value: textBefore, children: [] });
    }

    const token = match[1].toLowerCase();
    if (token === '**') {
      let foundIndex = -1;
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].type === 'bold') {
          foundIndex = i;
          break;
        }
      }
      if (foundIndex !== -1) {
        stack.length = foundIndex;
      } else {
        const newNode: ASTNode = { type: 'bold', children: [] };
        stack[stack.length - 1].children.push(newNode);
        stack.push(newNode);
      }
    } else if (token.startsWith('[/') || token.startsWith('[ /')) {
      const tag = token.replace(/\[\/?\s*|\s*\]/g, '');
      let foundIndex = -1;
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].tag === tag) {
          foundIndex = i;
          break;
        }
      }
      if (foundIndex !== -1) {
        stack.length = foundIndex;
      } else {
        // Ignore unmatched closing tags to prevent them from showing up as text
      }
    } else {
      const tag = token.replace(/\[\s*|\s*\]/g, '');
      const isAnim = ['wave', 'shake', 'glitch', 'pulse', 'bounce', 'spin', 'float', 'flicker', 'glow'].includes(tag);
      const newNode: ASTNode = { type: isAnim ? 'anim' : 'color', tag, children: [] };
      stack[stack.length - 1].children.push(newNode);
      stack.push(newNode);
    }

    lastIndex = match.index + match[0].length;
  }

  const textAfter = text.substring(lastIndex);
  if (textAfter) {
    stack[stack.length - 1].children.push({ type: 'text', value: textAfter, children: [] });
  }

  const renderNode = (node: ASTNode, index: number): React.ReactNode => {
    if (node.type === 'text') {
      return <React.Fragment key={index}>{node.value}</React.Fragment>;
    }

    const children = node.children.map((child, i) => renderNode(child, i));

    if (node.type === 'bold') {
      return <strong key={index} className="font-bold tracking-wider">{children}</strong>;
    }

    if (node.type === 'color' || node.type === 'anim') {
      const classMap: Record<string, string> = {
        red: 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]',
        blue: 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]',
        green: 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]',
        yellow: 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]',
        purple: 'text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]',
        indigo: 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]',
        orange: 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]',
        gold: 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] font-bold',
        cyan: 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]',
        pink: 'text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.5)]',
        teal: 'text-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]',
        lime: 'text-lime-400 drop-shadow-[0_0_8px_rgba(163,230,53,0.5)]',
        fuchsia: 'text-fuchsia-400 drop-shadow-[0_0_8px_rgba(232,121,249,0.5)]',
        rose: 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]',
        sky: 'text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]',
        amber: 'text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]',
        gray: 'text-gray-400 drop-shadow-[0_0_8px_rgba(156,163,175,0.5)]',
        white: 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]',
        black: 'text-black drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] bg-white/80 px-1 rounded',
        wave: 'animate-wave',
        shake: 'animate-shake',
        glitch: 'animate-glitch',
        pulse: 'animate-pulse',
        bounce: 'animate-bounce inline-block',
        spin: 'animate-spin inline-block',
        float: 'animate-float',
        flicker: 'animate-flicker',
        glow: 'animate-glow',
      };
      const className = classMap[node.tag!] || '';
      return <span key={index} className={className}>{children}</span>;
    }

    return <React.Fragment key={index}>{children}</React.Fragment>;
  };

  return <>{root.children.map((child, i) => renderNode(child, i))}</>;
};

export function StoryView({ gameState, onChoice, onRestart, isLoading }: StoryViewProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    let currentText = '';
    let currentIndex = 0;
    setIsTyping(true);
    setDisplayedText('');

    const intervalId = setInterval(() => {
      if (currentIndex < gameState.storyText.length) {
        currentText += gameState.storyText[currentIndex];
        setDisplayedText(currentText);
        currentIndex++;
      } else {
        setIsTyping(false);
        clearInterval(intervalId);
      }
    }, 30); // 30ms per character for a smooth reading pace

    return () => clearInterval(intervalId);
  }, [gameState.storyText]);

  const handleSkipTyping = () => {
    if (isTyping) {
      setDisplayedText(gameState.storyText);
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <AnimatePresence mode="wait">
        <motion.div 
          key={gameState.storyText}
          initial={{ opacity: 0, scale: 0.98, y: 10, filter: 'blur(4px)' }}
          animate={{ 
            opacity: isLoading ? 0.4 : 1, 
            scale: 1, 
            y: 0,
            filter: isLoading ? 'blur(2px)' : 'blur(0px)'
          }}
          exit={{ opacity: 0, scale: 0.98, y: -10, filter: 'blur(4px)' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-8"
        >
          {/* Story Text */}
          <div 
            className="prose prose-invert max-w-none cursor-pointer"
            onClick={handleSkipTyping}
            title={isTyping ? "点击跳过打字动画" : ""}
          >
            <p className="story-text min-h-[4rem] drop-shadow-md">
              {renderFormattedText(displayedText)}
              {isTyping && <span className="inline-block w-2 h-5 ml-1 bg-indigo-500/80 animate-pulse align-middle shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
            </p>
          </div>

          {/* Choices or Game Over */}
          <motion.div 
            className="grid grid-cols-1 gap-4 mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: isTyping ? 0 : 1 }}
            transition={{ duration: 0.5 }}
          >
            {gameState.isGameOver ? (
              <motion.button
                onClick={onRestart}
                disabled={isLoading || isTyping}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: isTyping ? 0 : 0.5 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="text-center px-6 py-5 md:px-8 glass-panel rounded-2xl bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden border border-red-500/30 hover:border-red-500/50 active:border-red-500/50 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] flex items-center justify-center"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-transparent opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500" />
                <span className="text-red-200 font-serif text-base md:text-lg tracking-wide group-hover:text-white group-active:text-white transition-colors relative z-10 font-bold">重新开始冒险</span>
              </motion.button>
            ) : (
              gameState.choices.map((choice, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => onChoice(choice)}
                  disabled={isLoading || isTyping}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.15 + (isTyping ? 0 : 0.5) }}
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-left px-6 py-5 md:px-8 glass-panel rounded-2xl hover:bg-white/10 active:bg-white/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden border border-white/5 hover:border-indigo-500/30 active:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] flex items-center justify-between"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500" />
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-400 to-purple-500 transform scale-y-0 group-hover:scale-y-100 group-active:scale-y-100 transition-transform origin-top duration-300" />
                  <span className="text-zinc-200 font-serif text-base md:text-lg tracking-wide group-hover:text-white group-active:text-white transition-colors relative z-10">{renderChoiceText(choice)}</span>
                  <span className="text-indigo-400/0 group-hover:text-indigo-400/80 group-active:text-indigo-400/80 transition-colors duration-300 relative z-10 transform translate-x-4 group-hover:translate-x-0 group-active:translate-x-0">
                    →
                  </span>
                </motion.button>
              ))
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-zinc-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
    </div>
  );
}
