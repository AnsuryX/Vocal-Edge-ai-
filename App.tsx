import React, { useState, useEffect, useRef } from 'react';
import { Language, ScenarioType, SessionResult, Scenario, Persona, SessionConfig, RecordingTurn, UserProfile } from './types.ts';
import { SCENARIOS, TRANSLATIONS, FOCUS_SKILLS } from './constants.ts';
import { CommunicationCoach } from './services/geminiService.ts';
import LanguageSwitcher from './components/LanguageSwitcher.tsx';
import VoiceVisualizer from './components/VoiceVisualizer.tsx';
import PronunciationWorkshop from './components/PronunciationWorkshop.tsx';
import LiveMetrics from './components/LiveMetrics.tsx';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('en');
  const [isRTL, setIsRTL] = useState(false);
  // Default screen is 'home' now that API_KEY is handled by the environment
  const [activeScreen, setActiveScreen] = useState<'home' | 'customize' | 'practice' | 'results' | 'stats' | 'profile'>('home');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [showPronunciationWorkshop, setShowPronunciationWorkshop] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Customization State
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [topic, setTopic] = useState('');
  const [outcome, setOutcome] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // User Profile
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    bio: '',
    goal: '',
    preferredTone: 'supportive',
    joinedDate: new Date().toLocaleDateString()
  });

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [history, setHistory] = useState<SessionResult[]>([]);
  const [lastTranscription, setLastTranscription] = useState('');
  const [playingTurnId, setPlayingTurnId] = useState<string | null>(null);
  
  // Real-time
  const [liveEnergy, setLiveEnergy] = useState(0);
  const [livePace, setLivePace] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const coachRef = useRef<CommunicationCoach>(new CommunicationCoach());
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    setIsRTL(lang.startsWith('ar'));
    document.documentElement.dir = lang.startsWith('ar') ? 'rtl' : 'ltr';
    document.documentElement.lang = lang === 'en' ? 'en' : 'ar';
  }, [lang]);

  // Persistent storage load
  useEffect(() => {
    const h = localStorage.getItem('ve_history');
    if (h) setHistory(JSON.parse(h));
    const p = localStorage.getItem('ve_profile');
    if (p) setProfile(JSON.parse(p));
  }, []);

  // Persistent storage save
  useEffect(() => localStorage.setItem('ve_history', JSON.stringify(history)), [history]);
  useEffect(() => localStorage.setItem('ve_profile', JSON.stringify(profile)), [profile]);

  const t = (key: keyof typeof TRANSLATIONS) => TRANSLATIONS[key][lang];

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartSession = async () => {
    if (!selectedScenario || !selectedPersona) return;
    setErrorMsg(null);
    const config: SessionConfig = {
      scenario: selectedScenario,
      persona: selectedPersona,
      topic: topic || selectedScenario.description[lang],
      outcome: outcome || "Growth",
      focusSkills: selectedSkills.length > 0 ? selectedSkills : ['clarity']
    };

    try {
      setActiveScreen('practice');
      setIsSessionActive(true);
      startTimeRef.current = Date.now();
      await coachRef.current.startSession(config, lang, {
        onTranscriptionUpdate: (text) => setLastTranscription(text),
        onClose: () => setIsSessionActive(false),
        onerror: (e) => { setErrorMsg(e.message); setIsSessionActive(false); }
      });
    } catch (err: any) {
      setErrorMsg(err.message);
      setActiveScreen('customize');
    }
  };

  const handleEndSession = async () => {
    const sessionEndTime = Date.now();
    const duration = startTimeRef.current ? Math.floor((sessionEndTime - startTimeRef.current) / 1000) : 0;
    
    setIsSessionActive(false);
    setIsAnalyzing(true);
    const { history: text, recordedTurns } = coachRef.current.stopSession();
    try {
      if (!text.trim()) { setActiveScreen('home'); return; }
      const res = await coachRef.current.getDetailedAnalysis(text, { scenario: selectedScenario!, persona: selectedPersona!, topic, outcome, focusSkills: selectedSkills }, lang);
      
      setAnalysisResult({ ...res, duration, recordingTurns: recordedTurns }); 
      
      const newEntry: SessionResult = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString(),
        scenarioType: selectedScenario!.type,
        confidenceScore: res.confidenceScore,
        effectivenessScore: res.effectivenessScore,
        feedback: res.feedback,
        duration: duration,
        personaName: selectedPersona!.name[lang],
        recordingTurns: recordedTurns
      };
      setHistory(prev => [newEntry, ...prev]);
      setActiveScreen('results');
    } catch (e) {
      setActiveScreen('home');
    } finally {
      setIsAnalyzing(false);
      startTimeRef.current = null;
    }
  };

  const playTurn = (turn: RecordingTurn) => {
    if (!turn.audioUrl) return;
    if (audioRef.current) {
      audioRef.current.src = turn.audioUrl;
      audioRef.current.play();
      setPlayingTurnId(turn.id);
      audioRef.current.onended = () => setPlayingTurnId(null);
    }
  };

  const navItems = [
    { id: 'home', icon: 'fa-house', label: lang === 'en' ? 'Practice' : 'تدريب' },
    { id: 'stats', icon: 'fa-chart-simple', label: lang === 'en' ? 'Metrics' : 'مقاييس' },
    { id: 'profile', icon: 'fa-user-gear', label: lang === 'en' ? 'Profile' : 'حسابي' }
  ];

  return (
    <div className={`flex flex-col h-full bg-slate-950 text-slate-100 ${isRTL ? 'font-arabic' : 'font-english'}`}>
      <audio ref={audioRef} className="hidden" />
      
      <header className="px-6 py-4 flex justify-between items-center border-b border-slate-900 bg-slate-950/50 backdrop-blur-lg sticky top-0 z-50">
        <h1 className="text-xl font-black italic tracking-tighter flex items-center gap-2">
          <span className="text-blue-500">VOCAL</span>EDGE
        </h1>
        <LanguageSwitcher current={lang} onChange={setLang} />
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-4 pb-32">
        {activeScreen === 'home' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-black text-white">{t('welcome')}{profile.name ? `, ${profile.name}` : ''}</h2>
              <p className="text-slate-500 text-sm">Select a combat zone to start training.</p>
            </div>
            <div className="grid gap-4">
              {SCENARIOS.map(s => (
                <button key={s.id} onClick={() => { setSelectedScenario(s); setSelectedPersona(s.personas[0]); setActiveScreen('customize'); }} className="group relative flex items-center p-5 rounded-[2rem] bg-slate-900 border border-slate-800 active:scale-[0.98] transition-all overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-all"></div>
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-blue-500 text-2xl group-hover:text-white group-hover:bg-blue-600 transition-all shadow-inner">
                    <i className={`fas ${s.icon}`}></i>
                  </div>
                  <div className={`flex-1 ${isRTL ? 'mr-4 text-right' : 'ml-4 text-left'}`}>
                    <h4 className="font-bold text-lg">{s.title[lang]}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{s.description[lang]}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeScreen === 'customize' && selectedScenario && (
          <div className="space-y-6 animate-fadeIn">
            <button onClick={() => setActiveScreen('home')} className="text-slate-500 mb-2 flex items-center gap-2 font-bold text-sm uppercase tracking-widest">
              <i className={`fas fa-chevron-${isRTL ? 'right' : 'left'}`}></i> Back
            </button>
            <h2 className="text-3xl font-black">{t('customize')}</h2>
            
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">{t('topicPlaceholder')}</label>
                <input value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 focus:ring-2 ring-blue-500 outline-none text-white font-bold placeholder:text-slate-700" placeholder="e.g. Salary Negotiation" />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">{t('selectPersona')}</label>
                <div className="grid gap-3">
                  {selectedScenario.personas.map(p => (
                    <button key={p.id} onClick={() => setSelectedPersona(p)} className={`flex items-center p-4 rounded-2xl border transition-all ${selectedPersona?.id === p.id ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                      <i className={`fas ${p.icon} text-lg w-8`}></i>
                      <div className="flex-1 text-left px-2">
                        <p className={`font-bold text-sm ${selectedPersona?.id === p.id ? 'text-white' : 'text-slate-200'}`}>{p.name[lang]}</p>
                        <p className="text-[10px] opacity-70">{p.role[lang]}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleStartSession} className="w-full py-5 bg-blue-600 rounded-3xl text-white font-black text-lg shadow-2xl shadow-blue-900/40 active:scale-95 transition-all">
                ENGAGE
              </button>
            </div>
          </div>
        )}

        {activeScreen === 'practice' && selectedScenario && selectedPersona && (
          <div className="h-full flex flex-col items-center justify-center space-y-12 animate-fadeIn py-10">
            <div className="text-center space-y-4">
              <div className="relative mx-auto">
                <div className={`w-40 h-40 rounded-[3rem] bg-slate-900 border-2 ${isSessionActive ? 'border-blue-500' : 'border-slate-800'} flex items-center justify-center text-5xl text-blue-500 transition-all duration-500`}>
                  <i className={`fas ${selectedPersona.icon}`}></i>
                </div>
                {isSessionActive && <div className="absolute inset-0 rounded-[3rem] border-4 border-blue-500 animate-pulse-ring"></div>}
              </div>
              <div>
                <h3 className="text-2xl font-black">{selectedPersona.name[lang]}</h3>
                <p className="text-blue-500 font-bold uppercase text-[10px] tracking-widest">{selectedPersona.role[lang]}</p>
              </div>
            </div>

            <div className="w-full min-h-[160px] bg-slate-900/50 rounded-[2.5rem] border border-slate-800/50 p-6 flex flex-col justify-center relative overflow-hidden">
               {isSessionActive ? (
                 <>
                   <VoiceVisualizer color="bg-blue-500" />
                   <p className="mt-4 text-center text-sm italic text-slate-400 animate-pulse line-clamp-2 px-4">
                     {lastTranscription || "Listening to your tone..."}
                   </p>
                   <div className="mt-4 border-t border-slate-800 pt-4">
                     <LiveMetrics energy={liveEnergy} pace={livePace} lang={lang} />
                   </div>
                 </>
               ) : (
                 <p className="text-center text-slate-600 font-bold uppercase tracking-widest text-xs">Ready for input</p>
               )}
            </div>

            <button onClick={isSessionActive ? handleEndSession : handleStartSession} disabled={isAnalyzing} className={`w-full max-w-xs py-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 transition-all ${isSessionActive ? 'bg-red-600 shadow-red-900/40' : 'bg-blue-600 shadow-blue-900/40'}`}>
              {isAnalyzing ? <><i className="fas fa-spinner fa-spin"></i> ANALYZING</> : <><i className={`fas ${isSessionActive ? 'fa-stop' : 'fa-microphone'}`}></i> {isSessionActive ? 'FINISH' : 'RESUME'}</>}
            </button>
          </div>
        )}

        {activeScreen === 'stats' && (
          <div className="space-y-8 animate-fadeIn">
            <h2 className="text-3xl font-black">{t('stats')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-[2rem] bg-slate-900 border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Engagements</p>
                <h4 className="text-3xl font-black">{history.length}</h4>
              </div>
              <div className="p-6 rounded-[2rem] bg-slate-900 border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Avg Confidence</p>
                <h4 className="text-3xl font-black text-blue-500">{history.length > 0 ? Math.round(history.reduce((a,c)=>a+c.confidenceScore,0)/history.length) : 0}%</h4>
              </div>
            </div>
          </div>
        )}

        {activeScreen === 'profile' && (
          <div className="space-y-8 animate-fadeIn">
            <h2 className="text-3xl font-black">{t('profile')}</h2>
            <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('userName')}</label>
                <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>
        )}

        {activeScreen === 'results' && analysisResult && (
          <div className="space-y-8 animate-fadeIn">
            <div className="text-center py-4">
              <h2 className="text-3xl font-black">{t('feedbackTitle')}</h2>
              <p className="text-slate-500">Session vs. {analysisResult.personaName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 text-center">
                <p className="text-3xl font-black">{analysisResult.confidenceScore}%</p>
              </div>
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 text-center">
                <p className="text-3xl font-black">{analysisResult.effectivenessScore}%</p>
              </div>
            </div>
            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 relative">
              <p className="text-slate-300 italic leading-relaxed pt-2">"{analysisResult.feedback}"</p>
            </div>
            <button onClick={() => setActiveScreen('home')} className="w-full py-5 bg-white text-slate-950 font-black rounded-3xl shadow-xl">
              RETURN TO BASE
            </button>
          </div>
        )}
      </main>

      {['home', 'stats', 'profile'].includes(activeScreen) && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-2xl border-t border-slate-900 px-8 py-4 flex justify-between items-center z-50">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveScreen(item.id as any)} className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${activeScreen === item.id ? 'text-blue-500' : 'text-slate-600'}`}>
              <i className={`fas ${item.icon} text-xl`}></i>
              <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

export default App;