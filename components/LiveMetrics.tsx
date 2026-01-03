
import React from 'react';
import { Language } from '../types';

interface Props {
  energy: number; // 0 to 1
  pace: number;   // calculated words or beats per second roughly
  lang: Language;
}

const LiveMetrics: React.FC<Props> = ({ energy, pace, lang }) => {
  const isRTL = lang.startsWith('ar');
  
  // Tone color mapping
  const toneColor = energy > 0.8 ? 'bg-red-500' : energy > 0.4 ? 'bg-amber-400' : energy > 0.05 ? 'bg-blue-400' : 'bg-slate-700';
  const toneLabel = energy > 0.8 ? (isRTL ? 'مرتفع جداً' : 'Aggressive') : energy > 0.4 ? (isRTL ? 'نشط' : 'Energetic') : energy > 0.05 ? (isRTL ? 'هادئ' : 'Calm') : (isRTL ? 'صامت' : 'Silent');

  // Pace mapping
  const paceLabel = pace > 15 ? (isRTL ? 'سريع جداً' : 'Fast') : pace > 5 ? (isRTL ? 'مثالي' : 'Steady') : (isRTL ? 'بطيء' : 'Slow');
  const paceColor = pace > 15 ? 'text-red-400' : pace > 5 ? 'text-green-400' : 'text-slate-500';

  return (
    <div className="w-full flex flex-col gap-4 mt-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isRTL ? 'النبرة' : 'Tone'}</span>
          <span className={`text-xs font-bold transition-colors duration-300 ${toneLabel !== 'Silent' && toneLabel !== 'صامت' ? 'text-white' : 'text-slate-600'}`}>
            {toneLabel}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isRTL ? 'السرعة' : 'Pace'}</span>
          <span className={`text-xs font-bold transition-colors duration-300 ${paceColor}`}>
            {paceLabel}
          </span>
        </div>
      </div>
      
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
        <div 
          className={`h-full transition-all duration-300 ${toneColor}`} 
          style={{ width: `${Math.min(energy * 100, 100)}%` }} 
        />
      </div>
    </div>
  );
};

export default LiveMetrics;
