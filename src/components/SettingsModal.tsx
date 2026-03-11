import React, { useState, useEffect } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import { ApiSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<ApiSettings>({ provider: 'default', bgProvider: 'default' });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'main' | 'bg'>('main');

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('api_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSettings({
            ...parsed,
            bgProvider: parsed.bgProvider || 'default'
          });
        } catch (e) {
          console.error('Failed to parse settings', e);
        }
      }
      // Reset scan state on open
      setAvailableModels([]);
      setScanError(null);
      setActiveTab('main');
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('api_settings', JSON.stringify(settings));
    onClose();
  };

  const handleScanModels = async () => {
    const isBg = activeTab === 'bg';
    const baseUrl = isBg ? settings.bgBaseUrl : settings.baseUrl;
    const apiKey = isBg ? settings.bgApiKey : settings.apiKey;

    if (!baseUrl || !apiKey) {
      setScanError('请先输入 Base URL 和 API Key');
      return;
    }
    setIsScanning(true);
    setScanError(null);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP 错误! 状态码: ${response.status}`);
      }
      
      const data = await response.json();
      if (data && data.data && Array.isArray(data.data)) {
        const models = data.data.map((m: any) => m.id).filter(Boolean);
        setAvailableModels(models);
        
        // Auto-select the first model if current model is not in the list
        const currentModel = isBg ? settings.bgModel : settings.model;
        if (models.length > 0 && (!currentModel || !models.includes(currentModel))) {
          if (isBg) {
            setSettings({ ...settings, bgModel: models[0] });
          } else {
            setSettings({ ...settings, model: models[0] });
          }
        }
        
        if (models.length === 0) {
          setScanError('未找到可用模型');
        }
      } else {
        throw new Error('无效的响应格式，请确认该接口兼容 OpenAI 规范');
      }
    } catch (err: any) {
      setScanError(err.message || '获取模型列表失败');
    } finally {
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  const isBg = activeTab === 'bg';
  const currentProvider = isBg ? settings.bgProvider : settings.provider;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-serif font-semibold text-white tracking-wide">API 设置</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex bg-black/40 p-1 rounded-xl mb-6">
          <button
            onClick={() => { setActiveTab('main'); setAvailableModels([]); setScanError(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'main' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            主线故事
          </button>
          <button
            onClick={() => { setActiveTab('bg'); setAvailableModels([]); setScanError(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'bg' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            后台总结
          </button>
        </div>
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2 tracking-wide">API 提供商</label>
            <div className="relative">
              <select 
                value={currentProvider || 'default'}
                onChange={e => {
                  const val = e.target.value as 'default' | 'custom';
                  if (isBg) {
                    setSettings({...settings, bgProvider: val});
                  } else {
                    setSettings({...settings, provider: val});
                  }
                }}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-white outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all shadow-inner appearance-none"
              >
                <option value="default" className="bg-zinc-900 text-white">默认 (Gemini)</option>
                <option value="custom" className="bg-zinc-900 text-white">自定义 (OpenAI 兼容)</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-zinc-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {currentProvider === 'custom' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
              {isBg && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setSettings({
                        ...settings,
                        bgBaseUrl: settings.baseUrl,
                        bgApiKey: settings.apiKey,
                        bgModel: settings.model
                      });
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1.5 rounded-lg"
                  >
                    复制主线配置
                  </button>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2 tracking-wide">Base URL</label>
                <input 
                  type="text" 
                  value={(isBg ? settings.bgBaseUrl : settings.baseUrl) || ''}
                  onChange={e => {
                    if (isBg) setSettings({...settings, bgBaseUrl: e.target.value});
                    else setSettings({...settings, baseUrl: e.target.value});
                  }}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-white outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all shadow-inner placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2 tracking-wide">API Key</label>
                <input 
                  type="password" 
                  value={(isBg ? settings.bgApiKey : settings.apiKey) || ''}
                  onChange={e => {
                    if (isBg) setSettings({...settings, bgApiKey: e.target.value});
                    else setSettings({...settings, apiKey: e.target.value});
                  }}
                  placeholder="sk-..."
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-white outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all shadow-inner placeholder:text-zinc-600"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-zinc-300 tracking-wide">模型名称 (Model)</label>
                  <button 
                    onClick={handleScanModels} 
                    disabled={isScanning}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 disabled:opacity-50 transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg"
                  >
                    {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    扫描可用模型
                  </button>
                </div>
                
                {availableModels.length > 0 ? (
                  <div className="relative">
                    <select
                      value={(isBg ? settings.bgModel : settings.model) || ''}
                      onChange={e => {
                        if (isBg) setSettings({...settings, bgModel: e.target.value});
                        else setSettings({...settings, model: e.target.value});
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl pl-5 pr-24 py-3.5 text-white outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all shadow-inner appearance-none"
                    >
                      <option value="" disabled className="bg-zinc-900 text-zinc-500">请选择模型</option>
                      {availableModels.map(m => (
                        <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-20 flex items-center px-2 pointer-events-none text-zinc-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <button 
                      onClick={() => setAvailableModels([])}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-colors z-10"
                      title="切换为手动输入"
                    >
                      手动输入
                    </button>
                  </div>
                ) : (
                  <input 
                    type="text" 
                    value={(isBg ? settings.bgModel : settings.model) || ''}
                    onChange={e => {
                      if (isBg) setSettings({...settings, bgModel: e.target.value});
                      else setSettings({...settings, model: e.target.value});
                    }}
                    placeholder="gpt-4o-mini 或点击上方扫描"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-white outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all shadow-inner placeholder:text-zinc-600"
                  />
                )}
                {scanError && <p className="text-xs text-red-400 mt-2">{scanError}</p>}
              </div>
            </div>
          )}

          <button 
            onClick={handleSave}
            className="w-full py-4 mt-8 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-2xl font-medium tracking-wide transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] border border-white/10"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
