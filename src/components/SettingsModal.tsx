import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RefreshCw } from 'lucide-react';
import { getSettings, saveSettings, AppSettings } from '../services/httpClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [models, setModels] = useState<string[]>([]);
  const [bgModels, setBgModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isFetchingBgModels, setIsFetchingBgModels] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getSettings());
    }
  }, [isOpen]);

  const fetchModels = async (isBg: boolean) => {
    const provider = isBg ? settings.bgProvider : settings.provider;
    const baseUrl = isBg ? settings.bgBaseUrl : settings.baseUrl;
    const apiKey = isBg ? settings.bgApiKey : settings.apiKey;
    
    const setFetching = isBg ? setIsFetchingBgModels : setIsFetchingModels;
    const setModelList = isBg ? setBgModels : setModels;
    
    setFetching(true);
    try {
      if (provider === 'gemini') {
        if (!apiKey) {
          alert('请先填入 API Key');
          return;
        }
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (response.ok) {
          const data = await response.json();
          if (data.models && Array.isArray(data.models)) {
            setModelList(data.models.map((m: { name: string }) => m.name.replace('models/', '')));
          }
        } else {
          alert('获取模型失败，请检查 API Key 是否正确');
        }
      } else {
        const url = baseUrl || 'https://api.openai.com/v1';
        if (!url && !apiKey) {
          alert('请先填入 Base URL 或 API Key');
          return;
        }
        const headers: Record<string, string> = {};
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        const response = await fetch(`${url.replace(/\/$/, '')}/models`, {
          headers
        });
        if (response.ok) {
          const data = await response.json();
          if (data.data && Array.isArray(data.data)) {
            setModelList(data.data.map((m: { id: string }) => m.id));
          }
        } else {
          alert('获取模型失败，请检查 Base URL 和 API Key');
        }
      }
    } catch (e) {
      console.error('Failed to fetch models', e);
      alert('获取模型失败，请检查网络连接或跨域设置');
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    saveSettings(settings);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-zinc-100 mb-6">游戏设置</h2>
            
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-zinc-200 border-b border-zinc-800 pb-2">文本生成 API</h3>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-400">提供商</label>
                  <select
                    name="provider"
                    value={settings.provider}
                    onChange={handleChange}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                  >
                    <option value="gemini">Google Gemini (默认)</option>
                    <option value="custom">自定义 (OpenAI 兼容)</option>
                  </select>
                </div>

                {settings.provider === 'custom' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-400">Base URL</label>
                    <input
                      type="text"
                      name="baseUrl"
                      value={settings.baseUrl}
                      onChange={handleChange}
                      placeholder="https://api.openai.com/v1"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-400">API Key</label>
                  <input
                    type="password"
                    name="apiKey"
                    value={settings.apiKey}
                    onChange={handleChange}
                    placeholder={settings.provider === 'gemini' ? "留空使用默认密钥" : "sk-..."}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-zinc-400">模型</label>
                    <button
                      onClick={() => fetchModels(false)}
                      disabled={isFetchingModels}
                      className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
                      扫描模型
                    </button>
                  </div>
                  {models.length > 0 ? (
                    <select
                      name="model"
                      value={settings.model}
                      onChange={handleChange}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                    >
                      <option value="">选择模型...</option>
                      {models.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="model"
                      value={settings.model}
                      onChange={handleChange}
                      placeholder={settings.provider === 'gemini' ? "例如: gemini-2.5-flash" : "例如: gpt-3.5-turbo"}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-zinc-200 border-b border-zinc-800 pb-2">后台任务 API (总结/导演/记忆)</h3>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-400">提供商</label>
                  <select
                    name="bgProvider"
                    value={settings.bgProvider}
                    onChange={handleChange}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                  >
                    <option value="gemini">Google Gemini (默认)</option>
                    <option value="custom">自定义 (OpenAI 兼容)</option>
                  </select>
                </div>

                {settings.bgProvider === 'custom' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-400">Base URL</label>
                    <input
                      type="text"
                      name="bgBaseUrl"
                      value={settings.bgBaseUrl}
                      onChange={handleChange}
                      placeholder="https://api.openai.com/v1"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-400">API Key</label>
                  <input
                    type="password"
                    name="bgApiKey"
                    value={settings.bgApiKey}
                    onChange={handleChange}
                    placeholder={settings.bgProvider === 'gemini' ? "留空使用默认密钥" : "sk-..."}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-zinc-400">模型</label>
                    <button
                      onClick={() => fetchModels(true)}
                      disabled={isFetchingBgModels}
                      className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isFetchingBgModels ? 'animate-spin' : ''}`} />
                      扫描模型
                    </button>
                  </div>
                  {bgModels.length > 0 ? (
                    <select
                      name="bgModel"
                      value={settings.bgModel}
                      onChange={handleChange}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                    >
                      <option value="">选择模型...</option>
                      {bgModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="bgModel"
                      value={settings.bgModel}
                      onChange={handleChange}
                      placeholder={settings.bgProvider === 'gemini' ? "例如: gemini-2.5-flash" : "例如: gpt-3.5-turbo"}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                    />
                  )}
                </div>
              </div>

              <button
                onClick={handleSave}
                className="w-full bg-zinc-100 text-zinc-900 font-medium rounded-lg px-4 py-2 hover:bg-white transition-colors"
              >
                保存设置
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
