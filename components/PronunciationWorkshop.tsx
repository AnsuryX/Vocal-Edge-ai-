
import React, { useState, useRef } from 'react';
import { Language, PronunciationItem } from '../types';
import { CommunicationCoach } from '../services/geminiService';
import { TRANSLATIONS } from '../constants';
import { decode, decodeAudioData } from '../services/audioUtils';

interface Props {
  items: PronunciationItem[];
  lang: Language;
  coach: CommunicationCoach;
  onClose: () => void;
}

const PronunciationWorkshop: React.FC<Props> = ({ items, lang, coach, onClose }) => {
  const [selectedWord, setSelectedWord] = useState<PronunciationItem | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [attemptResult, setAttemptResult] = useState<any>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const t = (key: keyof typeof TRANSLATIONS) => TRANSLATIONS[key][lang];

  const playMaster = async (text: string) => {
    try {
      setIsPlaying(true);
      const base64 = await coach.generateSpeech(text, lang);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const buffer = await decodeAudioData(decode(base64), audioContextRef.current, 24000, 1);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
    } catch (err) {
      console.error(err);
      setIsPlaying(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        setIsProcessing(true);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const result = await coach.analyzePronunciationAttempt(selectedWord!.word, base64, lang);
          setAttemptResult(result);
          setIsProcessing(false);
        };
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setAttemptResult(null);
    } catch (err) {
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const renderTipSection = (title: string, content: string | undefined, icon: string, colorClass: string) => {
    if (!content) return null;
    return (
      <div className="bg-slate-900/50 p-5 rounded-3xl border border-slate-800/50 flex gap-4">
        <div className={`w-10 h-10 rounded-2xl ${colorClass} flex-shrink-0 flex items-center justify-center text-sm`}>
          <i className={`fas ${icon}`}></i>
        </div>
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{title}</h4>
          <p className="text-sm text-slate-300 leading-relaxed">{content}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-2xl animate-fadeIn flex flex-col p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-8 sticky top-0 z-10 py-2 bg-slate-950/50 backdrop-blur-md">
        <h2 className="text-2xl font-black text-white flex items-center gap-3">
          <i className="fas fa-microphone-alt text-blue-500"></i>
          {t('pronunciationTitle')}
        </h2>
        <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
          <i className="fas fa-times"></i>
        </button>
      </div>

      {!selectedWord ? (
        <div className="grid gap-4">
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedWord(item)}
              className="group flex items-center p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/50 transition-all text-left"
            >
              <div className="flex-1">
                <h3 className="text-xl font-black text-white mb-1">{item.word}</h3>
                <p className="text-xs text-blue-400 font-mono tracking-widest uppercase">{item.phonetic || 'Phonetic guide'}</p>
                <p className="text-xs text-slate-500 mt-2 line-clamp-1">{item.tips[lang]}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-600 group-hover:text-blue-400 group-hover:bg-blue-400/10 transition-all">
                <i className="fas fa-chevron-right"></i>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center space-y-8 animate-scaleIn pb-20">
          <button 
            onClick={() => { setSelectedWord(null); setAttemptResult(null); }}
            className="self-start text-slate-500 hover:text-white flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.2em]"
          >
            <i className={`fas fa-arrow-${lang.startsWith('ar') ? 'right' : 'left'}`}></i>
            {lang === 'en' ? 'Back to list' : 'رجوع'}
          </button>

          <div className="text-center space-y-2">
            <h1 className="text-5xl font-black text-white tracking-tighter">{selectedWord.word}</h1>
            <p className="text-blue-500 font-mono text-sm tracking-[0.3em] uppercase">{selectedWord.phonetic}</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => playMaster(selectedWord.word)}
              disabled={isPlaying}
              className={`w-24 h-24 rounded-[2rem] flex flex-col items-center justify-center transition-all ${
                isPlaying ? 'bg-blue-600 animate-pulse text-white' : 'bg-slate-900 border-2 border-slate-800 text-blue-500 hover:border-blue-500/30'
              }`}
            >
              <i className="fas fa-volume-up text-2xl mb-2"></i>
              <span className="text-[9px] font-black uppercase tracking-widest">{t('listen')}</span>
            </button>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-24 h-24 rounded-[2rem] flex flex-col items-center justify-center transition-all shadow-2xl ${
                isRecording 
                  ? 'bg-red-600 scale-105 shadow-red-600/20 text-white' 
                  : 'bg-white text-slate-950 hover:scale-105 active:scale-95'
              }`}
            >
              <i className={`fas ${isRecording ? 'fa-square' : 'fa-microphone'} text-2xl mb-2`}></i>
              <span className="text-[9px] font-black uppercase tracking-widest">{isRecording ? t('stop') : t('record')}</span>
            </button>
          </div>

          {isProcessing && (
             <div className="flex items-center gap-3 text-blue-500 animate-pulse py-4">
                <i className="fas fa-circle-notch fa-spin"></i>
                <span className="text-xs font-black tracking-widest uppercase">Analyzing...</span>
             </div>
          )}

          {attemptResult && !isProcessing && (
            <div className="w-full p-8 rounded-[2.5rem] bg-slate-900 border border-slate-800 animate-fadeIn text-center space-y-4">
              <div className={`text-4xl font-black ${attemptResult.score > 80 ? 'text-green-500' : 'text-amber-500'}`}>
                {attemptResult.score}%
              </div>
              <p className="text-slate-300 italic leading-relaxed">"{attemptResult.feedback}"</p>
              <div className="flex justify-center">
                 {attemptResult.score > 80 ? (
                    <div className="px-6 py-2 rounded-full bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest border border-green-500/20">
                      {t('excellent')}
                    </div>
                 ) : (
                    <button 
                      onClick={startRecording}
                      className="text-amber-500 text-[10px] font-black uppercase tracking-widest underline decoration-2 underline-offset-8"
                    >
                      {t('tryAgain')}
                    </button>
                 )}
              </div>
            </div>
          )}

          <div className="w-full space-y-4">
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.25em] pl-2">Coaching Details</h3>
            
            <div className="grid gap-3">
              {renderTipSection(
                lang === 'en' ? 'General Tip' : 'نصيحة عامة',
                selectedWord.tips[lang],
                'fa-lightbulb',
                'bg-blue-500/10 text-blue-400'
              )}
              
              {renderTipSection(
                lang === 'en' ? 'Mouth & Lips' : 'القم والشفاه',
                selectedWord.mouthPosition?.[lang],
                'fa-face-grin',
                'bg-purple-500/10 text-purple-400'
              )}
              
              {renderTipSection(
                lang === 'en' ? 'Tongue Placement' : 'وضعية اللسان',
                selectedWord.tonguePlacement?.[lang],
                'fa-language',
                'bg-indigo-500/10 text-indigo-400'
              )}
              
              {renderTipSection(
                lang === 'en' ? 'Common Pitfalls' : 'أخطاء شائعة',
                selectedWord.commonPitfalls?.[lang],
                'fa-triangle-exclamation',
                'bg-red-500/10 text-red-400'
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PronunciationWorkshop;
