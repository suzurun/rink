'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Card from '@/components/Card';
import { Settings, Key, Globe, Video, Save, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    openaiKey: '',
    deeplKey: '',
    defaultLanguages: ['EN', 'ZH_CN'],
    parallelLimit: 5,
    autoTranslate: true,
    autoCalculate: true,
  });

  const handleSave = async () => {
    // In production, this would save to the database
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="animate-fade-in">
      <Header 
        title="設定" 
        subtitle="システム設定とAPIキー管理" 
      />

      <div className="max-w-2xl space-y-6">
        {/* API Keys */}
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-yellow-400" />
            APIキー設定
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">
                OpenAI API Key
              </label>
              <input
                type="password"
                value={settings.openaiKey}
                onChange={(e) => setSettings({ ...settings, openaiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full font-mono"
              />
              <p className="mt-1 text-xs text-surface-500">
                翻訳・ナレーション生成に使用します
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">
                DeepL API Key
              </label>
              <input
                type="password"
                value={settings.deeplKey}
                onChange={(e) => setSettings({ ...settings, deeplKey: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
                className="w-full font-mono"
              />
              <p className="mt-1 text-xs text-surface-500">
                高精度翻訳に使用します（オプション）
              </p>
            </div>
          </div>
        </Card>

        {/* Language Settings */}
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            言語設定
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">
                デフォルト翻訳言語
              </label>
              <div className="flex gap-4">
                {[
                  { value: 'EN', label: '英語 🇺🇸' },
                  { value: 'ZH_CN', label: '中国語（簡体）🇨🇳' },
                  { value: 'ZH_TW', label: '中国語（繁体）🇹🇼' },
                ].map((lang) => (
                  <label key={lang.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.defaultLanguages.includes(lang.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSettings({
                            ...settings,
                            defaultLanguages: [...settings.defaultLanguages, lang.value]
                          });
                        } else {
                          setSettings({
                            ...settings,
                            defaultLanguages: settings.defaultLanguages.filter(l => l !== lang.value)
                          });
                        }
                      }}
                      className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm">{lang.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Processing Settings */}
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-red-400" />
            処理設定
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">
                並列処理上限
              </label>
              <input
                type="number"
                value={settings.parallelLimit}
                onChange={(e) => setSettings({ ...settings, parallelLimit: parseInt(e.target.value) })}
                min={1}
                max={10}
                className="w-24"
              />
              <p className="mt-1 text-xs text-surface-500">
                同時に処理する最大件数（1-10）
              </p>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
              <div>
                <p className="font-medium text-sm">自動翻訳</p>
                <p className="text-xs text-surface-500">物件取得後に自動で翻訳を開始</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, autoTranslate: !settings.autoTranslate })}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  settings.autoTranslate ? 'bg-primary-500' : 'bg-surface-700'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.autoTranslate ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
              <div>
                <p className="font-medium text-sm">自動計算</p>
                <p className="text-xs text-surface-500">物件取得後に自動で投資指標を計算</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, autoCalculate: !settings.autoCalculate })}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  settings.autoCalculate ? 'bg-primary-500' : 'bg-surface-700'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.autoCalculate ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            {saved ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                保存しました
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                設定を保存
              </>
            )}
          </button>
          {saved && (
            <span className="text-sm text-green-400 animate-fade-in">
              設定が保存されました
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

