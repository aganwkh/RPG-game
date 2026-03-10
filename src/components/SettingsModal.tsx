import React, { useState, useEffect } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import { ApiSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<ApiSettings>({ provider: 'default' });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('api_settings');
      if (saved) {
        try {
          setSettings(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse settings', e);
        }
      }
      // Reset scan state on open
      setAvailableModels([]);
      setScanError(null);
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('api_settings', JSON.stringify(settings));
    onClose();
  };

  const handleScanModels = async () => {
    if (!settings.baseUrl || !settings.apiKey) {
      setScanError('请先输入 Base URL 和 API Key');
      return;
    }
    setIsScanning(true);
    setScanError(null);
    try {
      const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/models`, {
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`
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
        if (models.length > 0 && (!settings.model || !models.includes(settings.model))) {
          setSettings({ ...settings, model: models[0] });
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 shadow-2xl border border-white/10">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-serif font-semibold text-white tracking-wide">API 设置</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2 tracking-wide">API 提供商</label>
            <select 
              value={settings.provider}
              onChange={e => setSettings({...settings, provider: e.target.value as 'default' | 'custom'})}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-white outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all shadow-inner appearance-none"
            >
              <option value="default">默认 (Gemini)</option>
              <option value="custom">自定义 (OpenAI 兼容)</option>
            </select>
          </div>

          {settings.provider === 'custom' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2 tracking-wide">Base URL</label>
                <input 
                  type="text" 
                  value={settings.baseUrl || ''}
                  onChange={e => setSettings({...settings, baseUrl: e.target.value})}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-white outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all shadow-inner placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2 tracking-wide">API Key</label>
                <input 
                  type="password" 
                  value={settings.apiKey || ''}
                  onChange={e => setSettings({...settings, apiKey: e.target.value})}
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
                      value={settings.model || ''}
                      onChange={e => setSettings({...settings, model: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl pl-5 pr-20 py-3.5 text-white outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all shadow-inner appearance-none"
                    >
                      <option value="" disabled>请选择模型</option>
                      {availableModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => setAvailableModels([])}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-colors"
                      title="切换为手动输入"
                    >
                      手动输入
                    </button>
                  </div>
                ) : (
                  <input 
                    type="text" 
                    value={settings.model || ''}
                    onChange={e => setSettings({...settings, model: e.target.value})}
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
