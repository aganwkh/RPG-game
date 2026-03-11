import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Plus, Trash2, Upload, Download, BookOpen, BrainCircuit } from 'lucide-react';
import { MemoryState, LorebookEntry, LogEntry } from '../types';
import { regenerateSummary } from '../services/ai';

interface WorldbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory: MemoryState;
  onUpdateMemory: (newMemory: MemoryState) => void;
  logs: LogEntry[];
}

export function WorldbookModal({ isOpen, onClose, memory, onUpdateMemory, logs }: WorldbookModalProps) {
  const [activeTab, setActiveTab] = useState<'worldbook' | 'summary'>('worldbook');
  const [localMemory, setLocalMemory] = useState<MemoryState>(memory);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setLocalMemory(memory);
    }
  }, [isOpen, memory]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateMemory(localMemory);
    onClose();
  };

  const handleAddEntry = () => {
    setLocalMemory(prev => ({
      ...prev,
      worldInfo: [...prev.worldInfo, { keywords: [], content: '' }]
    }));
  };

  const handleUpdateEntry = (index: number, field: keyof LorebookEntry, value: string | string[]) => {
    setLocalMemory(prev => {
      const newWorldInfo = [...prev.worldInfo];
      newWorldInfo[index] = { ...newWorldInfo[index], [field]: value };
      return { ...prev, worldInfo: newWorldInfo };
    });
  };

  const handleDeleteEntry = (index: number) => {
    setLocalMemory(prev => {
      const newWorldInfo = [...prev.worldInfo];
      newWorldInfo.splice(index, 1);
      return { ...prev, worldInfo: newWorldInfo };
    });
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localMemory.worldInfo, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "worldbook.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          // Basic validation
          const isValid = parsed.every(item => item.keywords && Array.isArray(item.keywords) && typeof item.content === 'string');
          if (isValid) {
            setLocalMemory(prev => ({
              ...prev,
              worldInfo: parsed
            }));
            alert('导入成功！');
          } else {
            alert('导入失败：文件格式不正确。请确保包含 keywords 数组和 content 字符串。');
          }
        } else {
          alert('导入失败：文件必须是数组格式。');
        }
      } catch (err) {
        alert('导入失败：无法解析 JSON 文件。');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRegenerateSummary = async () => {
    setIsRegenerating(true);
    try {
      // Get the last 20 logs to keep context manageable
      const recentLogs = logs.slice(-20).map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.text}`);
      const newSummary = await regenerateSummary(localMemory.summary, recentLogs);
      setLocalMemory(prev => ({ ...prev, summary: newSummary }));
    } catch (err) {
      alert('重新生成总结失败，请检查 API 设置。');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-serif font-semibold text-zinc-100">编年史 & 世界书</h2>
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10 bg-zinc-900/30">
            <button
              onClick={() => setActiveTab('worldbook')}
              className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'worldbook' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              世界书 (Worldbook)
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'summary' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <BrainCircuit className="w-4 h-4" />
              AI 总结 (Summary)
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-900/50">
            {activeTab === 'worldbook' ? (
              <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-zinc-400">世界书用于存储游戏中的重要设定、人物和地点。当游戏文本中出现触发词时，AI会自动参考这些设定。</p>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept=".json"
                      ref={fileInputRef}
                      onChange={handleImport}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors border border-white/5"
                    >
                      <Upload className="w-4 h-4" />
                      导入
                    </button>
                    <button
                      onClick={handleExport}
                      className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors border border-white/5"
                    >
                      <Download className="w-4 h-4" />
                      导出
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {localMemory.worldInfo.map((entry, index) => (
                    <div key={index} className="bg-zinc-800/50 border border-white/5 rounded-xl p-4 flex flex-col gap-3 relative group">
                      <button
                        onClick={() => handleDeleteEntry(index)}
                        className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="删除词条"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">触发词 (Keywords, 逗号分隔)</label>
                        <input
                          type="text"
                          value={(entry.keywords || []).join(', ')}
                          onChange={(e) => handleUpdateEntry(index, 'keywords', e.target.value.split(',').map(k => k.trim()).filter(k => k))}
                          className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                          placeholder="例如: 哥布林, 绿皮怪物"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">设定内容 (Content)</label>
                        <textarea
                          value={entry.content}
                          onChange={(e) => handleUpdateEntry(index, 'content', e.target.value)}
                          className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-y min-h-[80px]"
                          placeholder="描述这个设定的详细信息..."
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleAddEntry}
                  className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-white/10 hover:border-indigo-500/50 text-zinc-400 hover:text-indigo-400 rounded-xl transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  添加新词条
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 h-full">
                <div className="flex justify-between items-start">
                  <p className="text-sm text-zinc-400 max-w-2xl">AI 总结记录了您冒险的长期摘要。它会在每次重要事件后自动更新，您也可以在此手动编辑以修正或补充细节。</p>
                  <button
                    onClick={handleRegenerateSummary}
                    disabled={isRegenerating}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-sm rounded-lg transition-colors border border-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    <BrainCircuit className={`w-4 h-4 ${isRegenerating ? 'animate-pulse' : ''}`} />
                    {isRegenerating ? '生成中...' : '重新生成总结'}
                  </button>
                </div>
                <textarea
                  value={localMemory.summary}
                  onChange={(e) => setLocalMemory(prev => ({ ...prev, summary: e.target.value }))}
                  className="w-full flex-1 bg-zinc-900/50 border border-white/10 rounded-xl p-4 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none leading-relaxed"
                  placeholder="冒险摘要将在这里显示..."
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/10 bg-zinc-900/80 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存更改
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
