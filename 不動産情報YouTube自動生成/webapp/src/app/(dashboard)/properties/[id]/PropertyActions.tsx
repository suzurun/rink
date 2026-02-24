'use client';

import { useState } from 'react';
import Card from '@/components/Card';
import { Languages, Video, Calculator, RefreshCw, CheckCircle2 } from 'lucide-react';

interface PropertyActionsProps {
  propertyId: string;
}

export default function PropertyActions({ propertyId }: PropertyActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setLoading(action);
    setSuccess(null);

    try {
      const response = await fetch(`/api/properties/${propertyId}/${action}`, {
        method: 'POST',
      });

      if (response.ok) {
        setSuccess(action);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const actions = [
    { 
      id: 'translate', 
      label: '翻訳生成', 
      icon: Languages, 
      color: 'from-purple-500 to-pink-500',
      description: '英語・中国語に翻訳'
    },
    { 
      id: 'calculate', 
      label: '投資計算', 
      icon: Calculator, 
      color: 'from-yellow-500 to-orange-500',
      description: '利回り等を計算'
    },
    { 
      id: 'generate-video', 
      label: '動画生成', 
      icon: Video, 
      color: 'from-red-500 to-pink-500',
      description: '紹介動画を生成'
    },
  ];

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">アクション</h3>
      
      <div className="space-y-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.id)}
            disabled={loading !== null}
            className={`w-full p-4 rounded-xl bg-gradient-to-r ${action.color} bg-opacity-10 
              hover:bg-opacity-20 transition-all text-left flex items-center gap-4
              disabled:opacity-50 disabled:cursor-not-allowed group`}
          >
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${action.color} 
              flex items-center justify-center`}
            >
              {loading === action.id ? (
                <RefreshCw className="w-5 h-5 text-white animate-spin" />
              ) : success === action.id ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : (
                <action.icon className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <p className="font-medium">{action.label}</p>
              <p className="text-xs text-surface-400">{action.description}</p>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

