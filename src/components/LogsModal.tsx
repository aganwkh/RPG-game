import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { LogEntry } from '../types';

interface LogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
}

export function LogsModal({ isOpen, onClose, logs }: LogsModalProps) {
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
              <h2 className="text-xl font-semibold text-zinc-100">Adventure Logs</h2>
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {logs.length === 0 ? (
                <p className="text-zinc-500 text-center italic">No logs yet.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="border-l-2 border-indigo-500/30 pl-4 py-1">
                    <span className="text-xs text-zinc-500 block mb-1">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <p className="text-sm text-zinc-300">{log.message}</p>
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
