
import React from 'react';
import { Language } from '../types';

interface Props {
  current: Language;
  onChange: (lang: Language) => void;
}

const LanguageSwitcher: React.FC<Props> = ({ current, onChange }) => {
  const options: { value: Language; label: string; flag: string }[] = [
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'ar_msa', label: 'MSA', flag: '🇸🇦' },
    { value: 'ar_khaleeji', label: 'Khaleeji', flag: '🇦🇪' }
  ];

  return (
    <div className="flex gap-2 bg-slate-800/50 p-1 rounded-full border border-slate-700">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            current === opt.value 
              ? 'bg-blue-600 text-white shadow-lg' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>{opt.flag}</span>
          <span className={opt.value.startsWith('ar') ? 'font-arabic' : ''}>{opt.label}</span>
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
