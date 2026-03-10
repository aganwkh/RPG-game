import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Sparkles } from 'lucide-react';
import { chatWithBot } from '../services/ai';
import { GameState, ChatMessage } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

export function Chatbot({ gameState }: { gameState: GameState | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: '你好，旅行者。我是传说守护者。你可以问我关于这个世界、你的任务或你的物品的任何问题。' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !gameState) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const response = await chatWithBot(messages, userMsg, gameState);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: '魔法之风异常狂暴。我现在无法回答。' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-full shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center transition-all duration-300 hover:scale-110 z-40 backdrop-blur-md border border-white/10 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed inset-4 md:inset-auto md:bottom-8 md:right-8 md:w-[26rem] md:h-[36rem] glass-panel rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden"
          >
            <div className="p-5 border-b border-white/5 bg-black/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-zinc-100 tracking-wide">传说守护者</h3>
                  <p className="text-xs text-indigo-400/80 mt-0.5">随时为你解答疑惑</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 scroll-smooth">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600/90 text-white rounded-br-sm shadow-[0_4px_15px_rgba(99,102,241,0.2)]' 
                      : 'bg-black/40 border border-white/5 text-zinc-200 rounded-bl-sm backdrop-blur-md prose prose-invert prose-sm'
                  }`}>
                    {msg.role === 'user' ? msg.text : <Markdown>{msg.text}</Markdown>}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-black/40 p-4 rounded-2xl rounded-bl-sm border border-white/5 flex items-center gap-3 backdrop-blur-md">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span className="text-xs text-zinc-400 tracking-wide">正在查阅古籍...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 border-t border-white/5 bg-black/20">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="询问传说守护者..."
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-5 pr-14 py-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all shadow-inner"
                  disabled={!gameState || isTyping}
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || !gameState || isTyping}
                  className="absolute right-2 p-2.5 text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:hover:text-indigo-400 transition-colors bg-white/5 hover:bg-white/10 rounded-xl"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
