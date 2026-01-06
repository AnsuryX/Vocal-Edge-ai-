import React, { useState, useEffect, useRef } from 'react';
import { Language, ScenarioType, SessionResult, Scenario, Persona, SessionConfig, RecordingTurn, UserProfile } from './types.ts';
import { SCENARIOS, TRANSLATIONS, FOCUS_SKILLS } from './constants.ts';
import { CommunicationCoach } from './services/geminiService.ts';
import { supabase } from './services/supabaseClient.ts';
import LanguageSwitcher from './components/LanguageSwitcher.tsx';
import VoiceVisualizer from './components/VoiceVisualizer.tsx';
import PronunciationWorkshop from './components/PronunciationWorkshop.tsx';
import LiveMetrics from './components/LiveMetrics.tsx';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('en');
  const [isRTL, setIsRTL] = useState(false);
  const [activeScreen, setActiveScreen] = useState<'loading' | 'landing' | 'identity' | 'auth' | 'home' | 'customize' | 'practice' | 'results' | 'stats' | 'profile'>('loading');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [errorMsg, setErrorMsg] = useState<{title: string, desc: string} | null>(null);
  
  // Supabase Auth State
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Customization State
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [topic, setTopic] = useState('');

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
  
  // Real-time metrics
  const [liveEnergy, setLiveEnergy] = useState(0);
  const [livePace, setLivePace] = useState(0);
  
  const coachRef = useRef<CommunicationCoach>(new CommunicationCoach());
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    setIsRTL(lang.startsWith('ar'));
    document.documentElement.dir = lang.startsWith('ar') ? 'rtl' : 'ltr';
    document.documentElement.lang = lang === 'en' ? 'en' : 'ar';
  }, [lang]);

  // App Bootstrap Logic
  useEffect(() => {
    const bootstrap = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      // Always start at landing if no session
      if (!session) {
        setActiveScreen('landing');
      } else {
        await checkGeminiKey();
      }
    };
    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session) {
        checkGeminiKey();
      } else {
        setActiveScreen('landing');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) fetchUserData();
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;
    try {
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profileData) {
        setProfile({
          name: profileData.name || '',
          bio: profileData.bio || '',
          goal: profileData.goal || '',
          preferredTone: profileData.preferred_tone || 'supportive',
          joinedDate: profileData.created_at || new Date().toLocaleDateString()
        });
      }
      const { data: historyData } = await supabase.from('sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (historyData) {
        setHistory(historyData.map(s => ({
          id: s.id,
          date: new Date(s.created_at).toLocaleDateString(),
          scenarioType: s.scenario_type,
          confidenceScore: s.confidence_score,
          effectivenessScore: s.effectiveness_score,
          feedback: s.feedback,
          duration: s.duration,
          personaName: s.persona_name,
          recordingTurns: s.recording_turns
        })));
      }
    } catch (e) {
      setErrorMsg({ title: "Sync Error", desc: "Failed to load your cloud history." });
    }
  };

  const checkGeminiKey = async () => {
    try {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setActiveScreen(hasKey ? 'home' : 'auth');
    } catch (e) {
      setActiveScreen('auth');
    }
  };

  const handleIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setErrorMsg(null);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setErrorMsg({ title: "Check Inbox", desc: "A verification link was sent to your email." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setErrorMsg({ title: "Login Failed", desc: err.message });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleConnectKey = async () => {
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      // Assume success as per racing rules
      setActiveScreen('home');
      setErrorMsg({ title: "Connected", desc: "VocalEdge Engine is now powered." });
      setTimeout(() => setErrorMsg(null), 2000);
    } catch (e) {
      setErrorMsg({ title: "Billing Error", desc: "Project selection was cancelled or failed." });
    }
  };

  const wipeHistory = async () => {
    if (!user) return;
    if (!confirm("Delete all session history? This is permanent.")) return;
    const { error } = await supabase.from('sessions').delete().eq('user_id', user.id);
    if (error) {
      setErrorMsg({ title: "Wipe Failed", desc: "Could not communicate with Supabase." });
    } else {
      setHistory([]);
      setErrorMsg({ title: "History Wiped", desc: "All data cleared from cloud." });
      setTimeout(() => setErrorMsg(null), 2000);
    }
  };

  const handleStartSession = async () => {
    if (!selectedScenario || !selectedPersona) return;
    setErrorMsg(null);
    setLastTranscription('');
    
    try {
      setActiveScreen('practice');
      setIsSessionActive(true);
      startTimeRef.current = Date.now();
      await coachRef.current.startSession({
        scenario: selectedScenario,
        persona: selectedPersona,
        topic: topic || selectedScenario.description[lang],
        outcome: "Mastery",
        focusSkills: ['clarity']
      }, lang, {
        onTranscriptionUpdate: (text) => setLastTranscription(text),
        onClose: () => setIsSessionActive(false),
        onerror: (e: any) => { 
          setErrorMsg({ title: "Session Crashed", desc: e?.message?.includes('found') ? "API Key invalid. Please re-select project." : "Gemini connection lost." }); 
          setIsSessionActive(false); 
          if (e?.message?.includes('found')) setActiveScreen('auth');
        }
      });
    } catch (err: any) {
      const isMicError = err.message?.toLowerCase().includes('permission') || err.message?.toLowerCase().includes('notfound');
      setErrorMsg({ 
        title: isMicError ? "Microphone Required" : "Startup Error", 
        desc: isMicError ? "Please enable microphone access in your browser settings." : "Failed to initialize AI session."
      });
      setActiveScreen('customize');
      setIsSessionActive(false);
    }
  };

  const handleEndSession = async () => {
    const duration = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    setIsSessionActive(false);
    setIsAnalyzing(true);
    
    const { history: text, recordedTurns } = coachRef.current.stopSession();
    try {
      if (!text.trim()) { 
        setErrorMsg({ title: "No Audio", desc: "No conversation was detected to analyze." });
        setActiveScreen('home'); 
        return; 
      }
      const res = await coachRef.current.getDetailedAnalysis(text, { scenario: selectedScenario!, persona: selectedPersona!, topic, outcome: '', focusSkills: [] }, lang);
      setAnalysisResult({ ...res, duration, recordingTurns: recordedTurns }); 
      
      const { data: savedSession } = await supabase.from('sessions').insert([{
        user_id: user.id, scenario_type: selectedScenario!.type, confidence_score: res.confidenceScore,
        effectiveness_score: res.effectivenessScore, feedback: res.feedback, duration,
        persona_name: selectedPersona!.name[lang], recording_turns: recordedTurns
      }]).select().single();

      if (savedSession) {
        setHistory(prev => [{ id: savedSession.id, date: new Date().toLocaleDateString(), ...savedSession }, ...prev]);
      }
      setActiveScreen('results');
    } catch (e) {
      setErrorMsg({ title: "Analysis Failed", desc: "AI could not process the session transcript." });
      setActiveScreen('home');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').upsert({ id: user.id, ...profile, preferred_tone: profile.preferredTone, updated_at: new Date() });
    if (error) setErrorMsg({ title: "Update Failed", desc: "Profile changes could not be synced." });
    else {
      setErrorMsg({ title: "Profile Saved", desc: "Changes synced to your account." });
      setTimeout(() => setErrorMsg(null), 2000);
    }
  };

  const t = (key: keyof typeof TRANSLATIONS) => TRANSLATIONS[key][lang];

  const navItems = [
    { id: 'home', label: t('practiceNow'), icon: 'fa-bullseye' },
    { id: 'stats', label: t('stats'), icon: 'fa-chart-bar' },
    { id: 'profile', label: t('profile'), icon: 'fa-user-circle' }
  ];

  if (activeScreen === 'loading') return (
    <div className="flex items-center justify-center h-full bg-slate-950">
      <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center animate-pulse"><i className="fas fa-bullseye text-2xl text-white"></i></div>
    </div>
  );

  if (activeScreen === 'landing') return (
    <div className="flex flex-col h-full bg-slate-950 text-white p-12 justify-center space-y-12">
      <div className="space-y-4">
        <h1 className="text-6xl font-black tracking-tighter italic"><span className="text-blue-500">VOCAL</span>EDGE</h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Unfiltered AI Communication Coach</p>
      </div>
      <div className="space-y-6">
        <h2 className="text-4xl font-bold leading-tight">Master every high-stakes <span className="text-blue-400">interaction.</span></h2>
        <button onClick={() => setActiveScreen('identity')} className="w-full py-5 bg-blue-600 rounded-[2rem] font-black text-xl shadow-2xl shadow-blue-900/40 active:scale-95 transition-all">START TRAINING</button>
      </div>
    </div>
  );

  if (activeScreen === 'identity') return (
    <div className="flex flex-col h-full bg-slate-950 p-8 justify-center items-center relative">
      <button onClick={() => setActiveScreen('landing')} className="absolute top-12 left-8 text-slate-500"><i className="fas fa-arrow-left"></i></button>
      <div className="w-full max-w-sm space-y-8">
        <h2 className="text-3xl font-black text-center">{isSignUp ? 'New Profile' : 'Sign In'}</h2>
        <form onSubmit={handleIdentity} className="space-y-4">
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl outline-none focus:border-blue-500" placeholder="Email" />
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl outline-none focus:border-blue-500" placeholder="Password" />
          <button type="submit" disabled={isAuthLoading} className="w-full py-5 bg-blue-600 rounded-2xl font-black active:scale-95">{isAuthLoading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}</button>
        </form>
        <button onClick={() => setIsSignUp(!isSignUp)} className="w-full text-slate-500 font-bold uppercase text-[10px] tracking-widest">{isSignUp ? 'Already have an account? Log In' : 'No account? Join VocalEdge'}</button>
      </div>
    </div>
  );

  if (activeScreen === 'auth') return (
    <div className="flex flex-col h-full bg-slate-950 p-8 justify-center items-center text-center space-y-12">
      <div className="w-24 h-24 rounded-3xl bg-blue-600 flex items-center justify-center text-4xl shadow-2xl shadow-blue-500/20"><i className="fas fa-key text-white"></i></div>
      <div className="space-y-4">
        <h2 className="text-3xl font-black uppercase italic">Initialize Core</h2>
        <p className="text-slate-500 text-sm max-w-[280px] mx-auto">VocalEdge requires a Google Cloud project to run real-time audio analysis.</p>
      </div>
      <button onClick={handleConnectKey} className="w-full max-w-xs py-5 bg-white text-slate-950 rounded-full font-black text-lg active:scale-95 transition-all">CONNECT API KEY</button>
    </div>
  );

  return (
    <div className={`flex flex-col h-full bg-[#020617] text-slate-100 ${isRTL ? 'font-arabic' : 'font-english'}`}>
      {/* Toast Notification for Specific Feedback */}
      {errorMsg && (
        <div className="fixed top-12 left-6 right-6 z-[100] p-4 bg-slate-900 border border-white/5 shadow-2xl rounded-2xl animate-slideDown flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${errorMsg.title.includes('Failed') || errorMsg.title.includes('Error') ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
             <i className={`fas ${errorMsg.title.includes('Failed') ? 'fa-triangle-exclamation' : 'fa-info-circle'}`}></i>
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-black uppercase text-white tracking-widest">{errorMsg.title}</h4>
            <p className="text-[10px] text-slate-400 font-medium">{errorMsg.desc}</p>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-slate-600"><i className="fas fa-times"></i></button>
        </div>
      )}

      <header className="px-6 py-6 flex justify-between items-center bg-slate-950/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <h1 className="text-xl font-black italic tracking-tighter"><span className="text-blue-500">VOCAL</span>EDGE</h1>
        <div className="flex items-center gap-4">
           <LanguageSwitcher current={lang} onChange={setLang} />
           <button onClick={() => supabase.auth.signOut()} className="text-slate-600"><i className="fas fa-power-off text-sm"></i></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8 pb-32">
        {activeScreen === 'home' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-black">Ready to <span className="text-blue-500">Engage?</span></h2>
              <p className="text-slate-500 text-sm">Select your combat zone.</p>
            </div>
            <div className="grid gap-4">
              {SCENARIOS.map(s => (
                <button key={s.id} onClick={() => { setSelectedScenario(s); setSelectedPersona(s.personas[0]); setActiveScreen('customize'); }} className="flex items-center p-6 bg-slate-900/50 border border-white/5 rounded-[2.5rem] text-left hover:bg-slate-900 transition-all active:scale-[0.98]">
                   <div className="w-14 h-14 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 text-2xl"><i className={`fas ${s.icon}`}></i></div>
                   <div className="ml-5">
                      <h4 className="font-bold text-lg">{s.title[lang]}</h4>
                      <p className="text-xs text-slate-500 uppercase font-black tracking-widest">{s.personas.length} OPPONENTS</p>
                   </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeScreen === 'profile' && (
          <div className="space-y-8 animate-fadeIn max-w-lg mx-auto">
            <h2 className="text-3xl font-black">System <span className="text-blue-500">Config</span></h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Primary Goal</label>
                <input value={profile.goal} onChange={e => setProfile({...profile, goal: e.target.value})} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500" placeholder="e.g. Master Sales" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Coach Tone Vibe</label>
                <select value={profile.preferredTone} onChange={e => setProfile({...profile, preferredTone: e.target.value as any})} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500 appearance-none">
                  <option value="brutal">Brutal Honesty</option>
                  <option value="supportive">Supportive Friend</option>
                </select>
              </div>

              <div className="pt-8 space-y-4">
                {/* Switch Billing Project - Matches screenshot */}
                <button onClick={handleConnectKey} className="w-full p-5 bg-slate-900/80 border border-white/5 rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-500"><i className="fas fa-key"></i></div>
                    <span className="font-bold text-sm text-slate-200">Switch Billing Project</span>
                  </div>
                  <i className="fas fa-chevron-right text-slate-700"></i>
                </button>

                {/* Clear Skip / Use Worker Key - Matches screenshot style */}
                <button onClick={() => setErrorMsg({title: "Feature Restricted", desc: "Worker keys are managed by administrator."})} className="w-full p-5 bg-slate-900/80 border border-white/5 rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-500"><i className="fas fa-user-gear"></i></div>
                    <span className="font-bold text-sm text-yellow-500/90">Clear skip / use worker key</span>
                  </div>
                  <i className="fas fa-chevron-right text-slate-700"></i>
                </button>

                {/* Wipe History - Matches screenshot style */}
                <button onClick={wipeHistory} className="w-full p-5 bg-red-950/10 border border-red-500/10 rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center text-red-500"><i className="fas fa-fire"></i></div>
                    <span className="font-bold text-sm text-red-500">Wipe History</span>
                  </div>
                  <i className="fas fa-chevron-right text-slate-700"></i>
                </button>
              </div>

              <button onClick={saveProfile} className="w-full py-4 bg-blue-600 rounded-2xl font-black text-sm uppercase tracking-widest mt-6">Apply Changes</button>
            </div>
          </div>
        )}

        {/* Existing Screens (Customize, Practice, etc) handled similarly with enhanced feedback */}
        {activeScreen === 'customize' && selectedScenario && (
          <div className="space-y-8 animate-fadeIn">
            <button onClick={() => setActiveScreen('home')} className="text-slate-600"><i className="fas fa-chevron-left mr-2"></i> BACK</button>
            <h2 className="text-3xl font-black">Scenario <span className="text-blue-500">Setup</span></h2>
            <div className="space-y-6">
               <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Conversation Topic..." className="w-full p-6 bg-slate-900 rounded-3xl outline-none focus:border-blue-500 border border-white/5" />
               <div className="grid gap-3">
                 {selectedScenario.personas.map(p => (
                   <button key={p.id} onClick={() => setSelectedPersona(p)} className={`flex items-center p-4 rounded-3xl border transition-all ${selectedPersona?.id === p.id ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-white/5'}`}>
                      <i className={`fas ${p.icon} w-8`}></i>
                      <div className="text-left ml-4">
                        <p className="font-bold text-sm">{p.name[lang]}</p>
                        <p className="text-[10px] text-white/50">{p.role[lang]}</p>
                      </div>
                   </button>
                 ))}
               </div>
               <button onClick={handleStartSession} className="w-full py-5 bg-blue-600 rounded-full font-black text-lg">ENGAGE</button>
            </div>
          </div>
        )}

        {activeScreen === 'practice' && (
          <div className="h-full flex flex-col items-center justify-center space-y-12 animate-fadeIn">
            <div className="text-center space-y-4">
               <div className="w-40 h-40 rounded-[3rem] bg-slate-900 border-2 border-blue-500 flex items-center justify-center text-5xl text-blue-500"><i className={`fas ${selectedPersona?.icon}`}></i></div>
               <h3 className="text-2xl font-black">{selectedPersona?.name[lang]}</h3>
            </div>
            <div className="w-full p-8 bg-slate-900/50 rounded-[3rem] border border-white/5 text-center">
               <VoiceVisualizer color="bg-blue-500" />
               <p className="mt-4 text-slate-500 italic text-sm">{lastTranscription || "Listening..."}</p>
               <LiveMetrics energy={liveEnergy} pace={livePace} lang={lang} />
            </div>
            <button onClick={handleEndSession} className="w-full max-w-xs py-5 bg-red-600 rounded-full font-black">END SESSION</button>
          </div>
        )}

        {activeScreen === 'stats' && (
           <div className="space-y-8 animate-fadeIn">
              <h2 className="text-3xl font-black">Skill <span className="text-blue-500">Metrics</span></h2>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 text-center"><p className="text-3xl font-black">{history.length}</p><p className="text-[10px] uppercase font-black text-slate-500">Sessions</p></div>
                 <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 text-center"><p className="text-3xl font-black text-blue-500">{history.length > 0 ? Math.round(history.reduce((a,c)=>a+c.confidenceScore,0)/history.length) : 0}%</p><p className="text-[10px] uppercase font-black text-slate-500">Avg Score</p></div>
              </div>
              <div className="space-y-3">
                 {history.map(item => (
                   <div key={item.id} className="p-4 bg-slate-900/50 rounded-2xl flex justify-between items-center">
                      <div><p className="font-bold text-sm">{item.personaName}</p><p className="text-[10px] text-slate-600">{item.date}</p></div>
                      <div className="text-blue-500 font-black">{item.confidenceScore}%</div>
                   </div>
                 ))}
                 {history.length === 0 && <p className="text-center text-slate-600 py-12">No data recorded yet.</p>}
              </div>
           </div>
        )}
      </main>

      {['home', 'stats', 'profile'].includes(activeScreen) && (
        <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/90 backdrop-blur-2xl border-t border-white/5 px-10 py-5 flex justify-between items-center z-50">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveScreen(item.id as any)} className={`flex flex-col items-center gap-1.5 transition-all ${activeScreen === item.id ? 'text-blue-500' : 'text-slate-600'}`}>
              <i className={`fas ${item.icon} text-lg`}></i>
              <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

export default App;