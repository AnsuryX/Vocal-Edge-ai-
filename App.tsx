
import React, { useState, useEffect, useRef } from 'react';
import { Language, ScenarioType, SessionResult, Scenario, Persona, SessionConfig, RecordingTurn, UserProfile } from './types';
import { SCENARIOS, TRANSLATIONS, FOCUS_SKILLS } from './constants';
import { CommunicationCoach } from './services/geminiService';
import LanguageSwitcher from './components/LanguageSwitcher';
import VoiceVisualizer from './components/VoiceVisualizer';
import PronunciationWorkshop from './components/PronunciationWorkshop';
import LiveMetrics from './components/LiveMetrics';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('en');
  const [isRTL, setIsRTL] = useState(false);
  const [activeScreen, setActiveScreen] = useState<'home' | 'customize' | 'practice' | 'results' | 'stats' | 'profile' | 'auth'>('auth');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [showPronunciationWorkshop, setShowPronunciationWorkshop] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Customization State
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [topic, setTopic] = useState('');
  const [outcome, setOutcome] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);

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
  const metricsIntervalRef = useRef<number | null>(null);
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

  useEffect(() => {
    const check = async () => {
      const ok = await (window as any).aistudio.hasSelectedApiKey();
      if (ok) setActiveScreen('home');
    };
    check();
  }, []);

  // Set default topic when scenario changes
  useEffect(() => {
    if (selectedScenario) {
      setTopic(selectedScenario.description[lang]);
    }
  }, [selectedScenario, lang]);

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
        recordingTurns: recordedTurns,
        troubleWords: res.troubleWords
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

  // Nav items
  const navItems = [
    { id: 'home', icon: 'fa-house', label: lang === 'en' ? 'Practice' : 'تدريب' },
    { id: 'stats', icon: 'fa-chart-simple', label: lang === 'en' ? 'Metrics' : 'مقاييس' },
    { id: 'profile', icon: 'fa-user-gear', label: lang === 'en' ? 'Profile' : 'حسابي' }
  ];

  return (
    <div className={`flex flex-col h-full bg-slate-950 text-slate-100 ${isRTL ? 'font-arabic' : 'font-english'}`}>
      <audio ref={audioRef} className="hidden" />
      
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center border-b border-slate-900 bg-slate-950/50 backdrop-blur-lg sticky top-0 z-50">
        <h1 className="text-xl font-black italic tracking-tighter flex items-center gap-2">
          <span className="text-blue-500">VOCAL</span>EDGE
        </h1>
        <LanguageSwitcher current={lang} onChange={setLang} />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-6 py-4 pb-32">
        {activeScreen === 'auth' && (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white text-4xl shadow-2xl shadow-blue-600/20 mb-8 animate-bounce">
              <i className="fas fa-bullseye"></i>
            </div>
            <h2 className="text-3xl font-black mb-4">Master Every Conversation</h2>
            <p className="text-slate-400 mb-10 max-w-xs">The world's most direct communication coach. Select your project to begin.</p>
            <button onClick={() => (window as any).aistudio.openSelectKey().then(() => setActiveScreen('home'))} className="w-full max-w-xs py-4 bg-white text-slate-950 font-black rounded-3xl hover:scale-105 active:scale-95 transition-all shadow-xl">
              CONNECT API KEY
            </button>
          </div>
        )}

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
                
                {selectedScenario.suggestedTopics?.[lang] && (
                  <div className="mt-4 space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t('suggestedTopics')}</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedScenario.suggestedTopics[lang].map((suggestion, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => setTopic(suggestion)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                            topic === suggestion 
                              ? 'bg-blue-600 border-blue-500 text-white shadow-lg' 
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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

            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('history')}</h3>
              {history.length === 0 ? (
                <div className="p-12 bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-[2rem] text-center italic text-slate-600">
                  No combat records found.
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map(item => (
                    <div key={item.id} onClick={() => { setAnalysisResult(item); setActiveScreen('results'); }} className="p-5 bg-slate-900 rounded-[2rem] border border-slate-800 active:scale-95 transition-all cursor-pointer">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm">{item.personaName}</span>
                        <span className="text-blue-500 font-black">{item.confidenceScore}%</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <span>{item.date} • {item.scenarioType}</span>
                        <span className="flex items-center gap-1"><i className="far fa-clock"></i> {formatDuration(item.duration)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeScreen === 'profile' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-16 h-16 rounded-[2rem] bg-blue-600 flex items-center justify-center text-white text-3xl shadow-xl shadow-blue-600/10">
                <i className="fas fa-user-astronaut"></i>
              </div>
              <div>
                <h2 className="text-2xl font-black">{profile.name || "Recruit"}</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Member since {profile.joinedDate}</p>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('userName')}</label>
                <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('userBio')}</label>
                <input value={profile.bio} onChange={e => setProfile({...profile, bio: e.target.value})} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('userGoal')}</label>
                <input value={profile.goal} onChange={e => setProfile({...profile, goal: e.target.value})} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('toneVibe')}</label>
                <select value={profile.preferredTone} onChange={e => setProfile({...profile, preferredTone: e.target.value as any})} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 outline-none appearance-none">
                  <option value="supportive">Warm Support</option>
                  <option value="brutal">Brutal Honesty</option>
                </select>
              </div>
            </div>

            <section className="space-y-4 pt-6 border-t border-slate-900">
               <button onClick={() => (window as any).aistudio.openSelectKey()} className="w-full flex justify-between p-5 bg-slate-900 rounded-[1.5rem] font-bold active:bg-slate-800 transition-all">
                  <span className="flex items-center gap-3"><i className="fas fa-key text-blue-500"></i> {t('settingsResetKey')}</span>
                  <i className="fas fa-chevron-right text-slate-700"></i>
               </button>
               <button onClick={() => { if(confirm('Delete all data?')){ setHistory([]); localStorage.clear(); location.reload(); }}} className="w-full flex justify-between p-5 bg-red-600/10 border border-red-600/20 rounded-[1.5rem] font-bold text-red-500 active:bg-red-600/20 transition-all">
                  <span className="flex items-center gap-3"><i className="fas fa-fire"></i> {t('settingsClearData')}</span>
               </button>
            </section>
          </div>
        )}

        {activeScreen === 'results' && analysisResult && (
          <div className="space-y-8 animate-fadeIn">
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-blue-600/10 text-blue-500 rounded-full flex items-center justify-center mx-auto text-4xl mb-4 border border-blue-500/20">
                <i className="fas fa-shield-halved"></i>
              </div>
              <h2 className="text-3xl font-black">{t('feedbackTitle')}</h2>
              <p className="text-slate-500">Session vs. {analysisResult.personaName}</p>
              <p className="text-xs text-blue-400 font-bold mt-2 flex items-center justify-center gap-1">
                <i className="far fa-clock"></i> Duration: {formatDuration(analysisResult.duration)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 text-center">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-1">{t('confidence')}</p>
                <p className="text-3xl font-black">{analysisResult.confidenceScore}%</p>
              </div>
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 text-center">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-1">{t('effectiveness')}</p>
                <p className="text-3xl font-black">{analysisResult.effectivenessScore}%</p>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 relative">
              <i className="fas fa-quote-left absolute top-4 left-6 text-slate-800 text-3xl"></i>
              <p className="text-slate-300 italic leading-relaxed pt-2">"{analysisResult.feedback}"</p>
            </div>

            {/* Pronunciation Trouble Words */}
            {analysisResult.troubleWords && analysisResult.troubleWords.length > 0 && (
              <section className="space-y-4">
                 <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Trouble Words</h3>
                    <button 
                      onClick={() => setShowPronunciationWorkshop(true)}
                      className="text-[10px] font-black text-blue-500 uppercase tracking-widest underline"
                    >
                      {t('pronunciationTitle')}
                    </button>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {analysisResult.troubleWords.map((item: any, idx: number) => (
                      <div key={idx} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300">
                        {item.word}
                      </div>
                    ))}
                 </div>
              </section>
            )}

            {/* Conversation Timeline Review */}
            {analysisResult.recordingTurns && analysisResult.recordingTurns.length > 0 && (
              <section className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('recordingTurns')}</h3>
                <div className="space-y-3">
                  {analysisResult.recordingTurns.map((turn: RecordingTurn) => (
                    <button 
                      key={turn.id} 
                      onClick={() => playTurn(turn)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3 group relative ${
                        turn.role === 'user' 
                          ? 'bg-slate-900/50 border-slate-800' 
                          : 'bg-blue-600/5 border-blue-500/20'
                      } ${playingTurnId === turn.id ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        turn.role === 'user' ? 'bg-slate-800 text-slate-400' : 'bg-blue-600 text-white'
                      }`}>
                        <i className={`fas ${turn.role === 'user' ? 'fa-user' : 'fa-robot'} text-xs`}></i>
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm leading-relaxed ${playingTurnId === turn.id ? 'text-blue-400 font-medium' : 'text-slate-300'}`}>
                          {turn.text}
                        </p>
                      </div>
                      {turn.audioUrl && (
                        <div className={`flex-shrink-0 transition-opacity ${playingTurnId === turn.id ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'}`}>
                          <i className={`fas ${playingTurnId === turn.id ? 'fa-volume-up text-blue-500' : 'fa-play text-slate-500'} text-xs`}></i>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <button onClick={() => setActiveScreen('home')} className="w-full py-5 bg-white text-slate-950 font-black rounded-3xl shadow-xl">
              RETURN TO BASE
            </button>
          </div>
        )}
      </main>

      {/* Overlay: Pronunciation Workshop */}
      {showPronunciationWorkshop && analysisResult?.troubleWords && (
        <PronunciationWorkshop 
          items={analysisResult.troubleWords}
          lang={lang}
          coach={coachRef.current}
          onClose={() => setShowPronunciationWorkshop(false)}
        />
      )}

      {/* Bottom Navigation Bar */}
      {['home', 'stats', 'profile'].includes(activeScreen) && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-2xl border-t border-slate-900 px-8 py-4 flex justify-between items-center z-50">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveScreen(item.id as any)} className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${activeScreen === item.id ? 'text-blue-500' : 'text-slate-600'}`}>
              <i className={`fas ${item.icon} text-xl`}></i>
              <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
              {activeScreen === item.id && <div className="w-1 h-1 bg-blue-500 rounded-full mt-1"></div>}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

export default App;
