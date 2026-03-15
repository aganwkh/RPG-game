import React, { useEffect, useRef, useState } from "react";
import { GameProvider, useGame } from "./engine/GameEngine";
import { Send, Shield, Sword, Map, Backpack, Scroll, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { Item, QuestNode } from "./types";

const ChatMessage = ({ role, content }: { role: string; content: string }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        "p-4 rounded-xl max-w-[85%] mb-4 leading-relaxed",
        role === "user"
          ? "bg-indigo-600 text-white self-end ml-auto"
          : role === "system"
            ? "bg-zinc-800 text-zinc-400 text-sm italic mx-auto text-center"
            : "bg-zinc-900 text-zinc-100 border border-zinc-800",
      )}
    >
      {content}
    </motion.div>
  );
};

const ChatWindow = () => {
  const { messages, processAction, isProcessing } = useGame();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    processAction(input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-black rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
      <div className="flex-1 overflow-y-auto p-6 flex flex-col scroll-smooth">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-zinc-500 italic">
            The weave of fate awaits your first thread...
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage
            key={msg.id || i}
            role={msg.role}
            content={msg.content}
          />
        ))}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-zinc-500 italic text-sm p-4"
          >
            The world is reacting...
          </motion.div>
        )}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={handleSubmit}
        className="p-4 bg-zinc-900 border-t border-zinc-800 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What do you do?"
          className="flex-1 bg-zinc-950 text-zinc-100 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-zinc-800"
          disabled={isProcessing}
        />
        <button
          type="submit"
          disabled={!input.trim() || isProcessing}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg px-6 py-3 transition-colors flex items-center justify-center"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

const InventoryItem = ({
  item,
  onUse,
}: {
  item: Item;
  onUse: (id: string) => void;
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 mb-2">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <span className="font-medium text-zinc-200">{item.name}</span>
        <span className="text-xs px-2 py-1 bg-zinc-800 rounded-full text-zinc-400">
          {item.type}
        </span>
      </div>
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-2 text-sm text-zinc-400"
          >
            <p className="mb-2">{item.surfaceDescription}</p>
            {item.usageCondition && (
              <p className="text-amber-500/80 text-xs mb-2">
                Condition: {item.usageCondition}
              </p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUse(item.id);
              }}
              className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors"
            >
              Use Item
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Sidebar = () => {
  const { state, useItem } = useGame();

  return (
    <div className="w-80 flex flex-col gap-4 h-full overflow-y-auto pr-2 custom-scrollbar">
      {/* Stats */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4 text-zinc-100">
          <Map size={18} className="text-indigo-400" />
          <span className="font-medium truncate">{state.currentLocation}</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400 flex items-center gap-1">
              <Shield size={14} /> HP
            </span>
            <span
              className={clsx(
                "font-mono",
                state.hp < 30 ? "text-red-400" : "text-emerald-400",
              )}
            >
              {state.hp} / {state.maxHp}
            </span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5">
            <div
              className={clsx(
                "h-1.5 rounded-full transition-all duration-500",
                state.hp < 30 ? "bg-red-500" : "bg-emerald-500",
              )}
              style={{ width: `${(state.hp / state.maxHp) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Active Mysteries */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Eye size={14} /> Active Mysteries
        </h3>
        <ul className="space-y-2">
          {state.activeMysteries.length === 0 ? (
            <li className="text-sm text-zinc-600 italic">None</li>
          ) : (
            state.activeMysteries.map((mystery) => (
              <li key={mystery} className="text-sm text-zinc-300 leading-snug">
                • {mystery}
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Quests */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Scroll size={14} /> Quests
        </h3>
        <div className="space-y-3">
          {Object.values(state.questDAG).filter((q) => q.status === "active")
            .length === 0 ? (
            <div className="text-sm text-zinc-600 italic">No active quests</div>
          ) : (
            Object.values(state.questDAG)
              .filter((q) => q.status === "active")
              .map((quest) => (
                <div key={quest.id} className="text-sm">
                  <div className="font-medium text-amber-400/90 mb-1">
                    {quest.title}
                  </div>
                  <div className="text-zinc-400 text-xs leading-relaxed">
                    {quest.description}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Inventory */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex-1">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Backpack size={14} /> Inventory
        </h3>
        <div className="space-y-2">
          {state.inventory.length === 0 ? (
            <div className="text-sm text-zinc-600 italic">
              Your pack is empty
            </div>
          ) : (
            state.inventory.map((item) => (
              <InventoryItem key={item.id} item={item} onUse={useItem} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const GameLayout = () => {
  const { startGame, messages } = useGame();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) {
      startGame();
      setStarted(true);
    }
  }, [startGame, started]);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans p-6 gap-6 max-w-7xl mx-auto">
      <div className="flex-1 min-w-0">
        <ChatWindow />
      </div>
      <Sidebar />
    </div>
  );
};

function App() {
  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  );
}

export default App;
