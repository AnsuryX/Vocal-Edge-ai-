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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Supabase Auth State
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

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

  // Handle Supabase Auth Session and App Bootstrapping
  useEffect(() => {
    const bootstrap = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
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

  // Fetch data from Supabase when user is logged in
  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileData) {
        setProfile({
          name: profileData.name || '',
          bio: profileData.bio || '',
          goal: profileData.goal || '',
          preferredTone: profileData.preferred_tone || 'supportive',
          joinedDate: profileData.created_at || new Date().toLocaleDateString()
        });
      }

      const { data: historyData } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

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
      console.error("Error fetching user data", e);
    }
  };

  const checkGeminiKey = async () => {
    try {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (hasKey) {
        setActiveScreen('home');
      } else {
        setActiveScreen('auth');
      }
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
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { name: email.split('@')[0] }
          }
        });
        if (error) throw error;
        setErrorMsg("Check your email for confirmation!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleConnectKey = async () => {
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setActiveScreen('home');
    } catch (e) {
      setErrorMsg("Failed to connect API Key.");
    }
  };

  const wipeHistory = async () => {
    if (!user) return;
    if (!confirm("Are you sure you want to wipe all session history? This cannot be undone.")) return;
    
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('user_id', user.id);
    
    if (error) {
      setErrorMsg("Failed to wipe history.");
    } else {
      setHistory([]);
      setErrorMsg("History cleared.");
      setTimeout(() => setErrorMsg(null), 2000);
    }
  };

  const handleStartSession = async () => {
    if (!selectedScenario || !selectedPersona) return;
    setErrorMsg(null);
    setLastTranscription('');
    
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
        onerror: (e: any) => { 
          setErrorMsg(e?.message || "Connection failed."); 
          setIsSessionActive(false); 
        }
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initialize session.");
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
      if (!text.trim()) { setActiveScreen('home'); return; }
      const res = await coachRef.current.getDetailedAnalysis(text, { scenario: selectedScenario!, persona: selectedPersona!, topic, outcome, focusSkills: selectedSkills }, lang);
      
      setAnalysisResult({ ...res, duration, recordingTurns: recordedTurns }); 
      
      const sessionData = {
        user_id: user.id,
        scenario_type: selectedScenario!.type,
        confidence_score: res.confidenceScore,
        effectiveness_score: res.effectivenessScore,
        feedback: res.feedback,
        duration: duration,
        persona_name: selectedPersona!.name[lang],
        recording_turns: recordedTurns
      };

      const { data: savedSession } = await supabase
        .from('sessions')
        .insert([sessionData])
        .select()
        .single();

      if (savedSession) {
        setHistory(prev => [{
          id: savedSession.id,
          date: new Date().toLocaleDateString(),
          scenarioType: sessionData.scenario_type,
          confidenceScore: sessionData.confidence_score,
          effectivenessScore: sessionData.effectiveness_score,
          feedback: sessionData.feedback,
          duration: sessionData.duration,
          personaName: sessionData.persona_name,
          recordingTurns: sessionData.recording_turns
        }, ...prev]);
      }
      
      setActiveScreen('results');
    } catch (e) {
      setErrorMsg("Analysis failed.");
      setActiveScreen('home');
    } finally {
      setIsAnalyzing(false);
      startTimeRef.current = null;
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        name: profile.name,
        bio: profile.bio,
        goal: profile.goal,
        preferred_tone: profile.preferredTone,
        updated_at: new Date()
      });
    
    if (error) {
      setErrorMsg("Failed to sync profile.");
    } else {
      setErrorMsg("Profile synced!");
      setTimeout(() => setErrorMsg(null), 2000);
    }
  };

  const t = (key: keyof typeof TRANSLATIONS) => TRANSLATIONS[key][lang];

  const navItems = [
    { id: 'home', label: t('practiceNow'), icon: 'fa-bullseye' },
    { id: 'stats', label: t('stats'), icon: 'fa-chart-bar' },
    { id: 'profile', label: t('profile'), icon: 'fa-user-circle' }
  ];

  if (activeScreen === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-950 text-white">
        <div className="w-16 h-16 rounded-[2rem] bg-blue-600 flex items-center justify-center animate-pulse">
           <i className="fas fa-bullseye text-2xl"></i>
        </div>
      </div>
    );
  }

  if (activeScreen === 'landing') {
    return (
      <div className="flex flex-col h-full bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[80vw] h-[80vw] bg-blue-600/10 rounded-full -mr-[40vw] -mt-[40vw] blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 w-[60vw] h-[60vw] bg-indigo-600/10 rounded-full -ml-[30vw] -mb-[30vw] blur-[80px]"></div>

        <div className="flex-1 flex flex-col px-8 py-16 z-10">
          <div className="mb-12">
            <h1 className="text-5xl font-black italic tracking-tighter mb-2">
              <span className="text-blue-500">VOCAL</span>EDGE
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">Elite AI Communication Training</p>
          </div>

          <div className="flex-1 space-y-12">
            <div className="space-y-4">
               <h2 className="text-4xl font-black leading-tight">Master Every <br/><span className="text-blue-400">Interaction.</span></h2>
               <p className="text-slate-400 text-sm leading-relaxed max-w-[280px]">
                 Practice high-stakes conversations with AI personas that challenge your logic, tone, and confidence in real-time.
               </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
               <div className="flex items-start gap-4 p-4 rounded-3xl bg-slate-900/50 border border-white/5 backdrop-blur-sm">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-500"><i className="fas fa-microphone-lines"></i></div>
                  <div>
                    <h4 className="font-bold text-sm">Real-time Feedback</h4>
                    <p className="text-[11px] text-slate-500">Live energy and pace analysis.</p>
                  </div>
               </div>
               <div className="flex items-start gap-4 p-4 rounded-3xl bg-slate-900/50 border border-white/5 backdrop-blur-sm">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-500"><i className="fas fa-brain"></i></div>
                  <div>
                    <h4 className="font-bold text-sm">Probing Personas</h4>
                    <p className="text-[11px] text-slate-500">Personas that fight back and roast you.</p>
                  </div>
               </div>
            </div>
          </div>

          <div className="space-y-4 pt-12">
            <button 
              onClick={() => user ? checkGeminiKey() : setActiveScreen('identity')}
              className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-[2.5rem] text-lg shadow-2xl shadow-blue-900/40 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              BEGIN TRAINING <i className="fas fa-arrow-right text-sm"></i>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeScreen === 'identity') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-950 text-white p-8 animate-fadeIn relative">
        <button onClick={() => setActiveScreen('landing')} className="absolute top-12 left-8 text-slate-500 hover:text-white transition-colors">
          <i className="fas fa-arrow-left"></i>
        </button>
        <div className="text-center space-y-4 mb-12">
           <h1 className="text-4xl font-black italic tracking-tighter"><span className="text-blue-500">VOCAL</span>EDGE</h1>
          <p className="text-slate-400 font-medium max-w-xs mx-auto text-sm">
            {isSignUp ? 'Create your coach profile to start training.' : 'Resume your communication training.'}
          </p>
        </div>
        <form onSubmit={handleIdentity} className="w-full max-w-sm space-y-4">
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-blue-500" placeholder="Email Address" />
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-blue-500" placeholder="Password" />
          <button type="submit" disabled={isAuthLoading} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-[2rem] text-lg shadow-xl active:scale-95 transition-all">
            {isAuthLoading ? <i className="fas fa-spinner fa-spin"></i> : (isSignUp ? 'CREATE ACCOUNT' : 'SECURE SIGN IN')}
          </button>
        </form>
        <button onClick={() => setIsSignUp(!isSignUp)} className="mt-8 text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest">
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
        {errorMsg && <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs text-center">{errorMsg}</div>}
      </div>
    );
  }

  if (activeScreen === 'auth') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-950 text-white p-8 space-y-12">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 rounded-[2rem] bg-blue-600 mx-auto flex items-center justify-center text-4xl shadow-2xl animate-pulse"><i className="fas fa-key"></i></div>
          <h2 className="text-2xl font-black">INITIALIZE CORE</h2>
          <p className="text-slate-400 font-medium max-w-xs mx-auto text-sm">Connect a Google Cloud Project to power the real-time AI engine.</p>
        </div>
        <button onClick={handleConnectKey} className="w-full max-w-sm py-5 bg-white text-slate-950 font-black rounded-[2rem] text-lg shadow-xl active:scale-95 transition-all">CONNECT API KEY</button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-slate-950 text-slate-100 ${isRTL ? 'font-arabic' : 'font-english'}`}>
      {errorMsg && (
        <div className="fixed top-20 left-6 right-6 z-[60] p-4 bg-blue-600/90 backdrop-blur rounded-2xl shadow-2xl animate-slideDown flex items-center justify-between">
           <p className="text-xs font-bold text-white uppercase tracking-tight">{errorMsg}</p>
           <button onClick={() => setErrorMsg(null)} className="text-white/50"><i className="fas fa-times"></i></button>
        </div>
      )}

      <header className="px-6 py-4 flex justify-between items-center border-b border-slate-900 bg-slate-950/50 backdrop-blur-lg sticky top-0 z-50">
        <h1 className="text-xl font-black italic tracking-tighter">
          <span className="text-blue-500">VOCAL</span>EDGE
        </h1>
        <div className="flex items-center gap-3">
          <LanguageSwitcher current={lang} onChange={setLang} />
          <button onClick={() => supabase.auth.signOut()} className="text-slate-500 text-xs hover:text-white"><i className="fas fa-power-off"></i></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-4 pb-32">
        {activeScreen === 'home' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-black text-white">{t('welcome')}{profile.name ? `, ${profile.name}` : ''}</h2>
              <p className="text-slate-500 text-sm">Select a training scenario to begin.</p>
            </div>
            <div className="grid gap-4">
              {SCENARIOS.map(s => (
                <button key={s.id} onClick={() => { setSelectedScenario(s); setSelectedPersona(s.personas[0]); setActiveScreen('customize'); }} className="group relative flex items-center p-5 rounded-[2rem] bg-slate-900 border border-slate-800 active:scale-[0.98] transition-all overflow-hidden text-left">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-blue-500 text-2xl group-hover:text-white group-hover:bg-blue-600 transition-all">
                    <i className={`fas ${s.icon}`}></i>
                  </div>
                  <div className={`flex-1 ${isRTL ? 'mr-4 text-right' : 'ml-4'}`}>
                    <h4 className="font-bold text-lg">{s.title[lang]}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{s.description[lang]}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PROFILE SCREEN - Updated to match screenshot */}
        {activeScreen === 'profile' && (
          <div className="space-y-8 animate-fadeIn">
            <h2 className="text-3xl font-black">{t('profile')}</h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('userName')}</label>
                <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 outline-none focus:border-blue-500" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('userGoal')}</label>
                <textarea value={profile.goal} onChange={e => setProfile({...profile, goal: e.target.value})} className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 outline-none focus:border-blue-500 h-24" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('toneVibe')}</label>
                <select value={profile.preferredTone} onChange={e => setProfile({...profile, preferredTone: e.target.value as any})} className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 outline-none focus:border-blue-500 appearance-none">
                  <option value="brutal">Brutal Honesty</option>
                  <option value="supportive">Supportive Coach</option>
                </select>
              </div>

              <button onClick={saveProfile} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all">SYNC TO CLOUD</button>
              
              <div className="pt-6 space-y-4">
                {/* Switch Billing Project Button - Now functional */}
                <button onClick={handleConnectKey} className="w-full p-5 rounded-2xl bg-slate-900/80 border border-white/5 flex items-center justify-between group active:bg-slate-800">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-500">
                      <i className="fas fa-key"></i>
                    </div>
                    <span className="font-bold text-sm text-slate-200">{t('settingsResetKey')}</span>
                  </div>
                  <i className="fas fa-chevron-right text-slate-600"></i>
                </button>

                {/* Wipe History Button - Now functional */}
                <button onClick={wipeHistory} className="w-full p-5 rounded-2xl bg-red-900/10 border border-red-500/10 flex items-center justify-between group active:bg-red-900/20">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
                      <i className="fas fa-fire"></i>
                    </div>
                    <span className="font-bold text-sm text-red-400">{t('settingsClearData')}</span>
                  </div>
                  <i className="fas fa-chevron-right text-red-900/50"></i>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Other screens truncated for brevity in this block, but preserved in full app state */}
        {activeScreen === 'customize' && selectedScenario && (
          <div className="space-y-6 animate-fadeIn">
            <button onClick={() => setActiveScreen('home')} className="text-slate-500 flex items-center gap-2 font-bold text-sm uppercase tracking-widest">
              <i className="fas fa-chevron-left"></i> Back
            </button>
            <h2 className="text-3xl font-black">{t('customize')}</h2>
            <div className="space-y-5">
              <input value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-blue-500" placeholder={t('topicPlaceholder')} />
              <div className="grid gap-3">
                {selectedScenario.personas.map(p => (
                  <button key={p.id} onClick={() => setSelectedPersona(p)} className={`flex items-center p-4 rounded-2xl border transition-all ${selectedPersona?.id === p.id ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-800'}`}>
                    <i className={`fas ${p.icon} w-8`}></i>
                    <div className="text-left"><p className="font-bold text-sm">{p.name[lang]}</p></div>
                  </button>
                ))}
              </div>
              <button onClick={handleStartSession} className="w-full py-5 bg-blue-600 rounded-3xl text-white font-black text-lg shadow-2xl">ENGAGE</button>
            </div>
          </div>
        )}

        {activeScreen === 'practice' && (
          <div className="h-full flex flex-col items-center justify-center space-y-12 animate-fadeIn py-10">
            <div className="text-center space-y-4">
              <div className="w-40 h-40 rounded-[3rem] bg-slate-900 border-2 border-blue-500 flex items-center justify-center text-5xl text-blue-500"><i className={`fas ${selectedPersona?.icon}`}></i></div>
              <h3 className="text-2xl font-black">{selectedPersona?.name[lang]}</h3>
            </div>
            <div className="w-full min-h-[160px] bg-slate-900/50 rounded-[2.5rem] border border-slate-800/50 p-6 flex flex-col justify-center relative">
               <VoiceVisualizer color="bg-blue-500" />
               <p className="mt-4 text-center text-sm italic text-slate-400 animate-pulse">{lastTranscription || "Listening..."}</p>
               <LiveMetrics energy={liveEnergy} pace={livePace} lang={lang} />
            </div>
            <button onClick={handleEndSession} className="w-full max-w-xs py-5 rounded-[2rem] font-black bg-red-600">FINISH</button>
          </div>
        )}

        {activeScreen === 'stats' && (
          <div className="space-y-8 animate-fadeIn">
            <h2 className="text-3xl font-black">{t('stats')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-[2rem] bg-slate-900 border border-slate-800"><h4 className="text-3xl font-black">{history.length}</h4><p className="text-[10px] text-slate-500 uppercase">Sessions</p></div>
              <div className="p-6 rounded-[2rem] bg-slate-900 border border-slate-800"><h4 className="text-3xl font-black text-blue-500">{history.length > 0 ? Math.round(history.reduce((a,c)=>a+c.confidenceScore,0)/history.length) : 0}%</h4><p className="text-[10px] text-slate-500 uppercase">Avg Conf</p></div>
            </div>
            <div className="space-y-4">
               {history.map(item => (
                 <div key={item.id} className="p-4 bg-slate-900/40 border border-slate-900 rounded-2xl flex items-center justify-between">
                    <div><p className="font-bold text-sm">{item.personaName}</p><p className="text-[10px] text-slate-500">{item.date}</p></div>
                    <p className="text-blue-500 font-black">{item.confidenceScore}%</p>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeScreen === 'results' && analysisResult && (
          <div className="space-y-8 animate-fadeIn">
            <h2 className="text-3xl font-black text-center">{t('feedbackTitle')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-6 rounded-[2rem] text-center"><p className="text-3xl font-black text-blue-500">{analysisResult.confidenceScore}%</p></div>
              <div className="bg-slate-900 p-6 rounded-[2rem] text-center"><p className="text-3xl font-black">{analysisResult.effectivenessScore}%</p></div>
            </div>
            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800"><p className="text-slate-300 italic">{analysisResult.feedback}</p></div>
            <button onClick={() => setActiveScreen('home')} className="w-full py-5 bg-white text-slate-950 font-black rounded-3xl">RETURN TO BASE</button>
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