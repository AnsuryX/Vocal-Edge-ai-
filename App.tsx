
import React, { useState, useEffect, useRef } from 'react';
import { Language, ScenarioType, SessionResult, Scenario, Persona, SessionConfig, RecordingTurn } from './types';
import { SCENARIOS, TRANSLATIONS, FOCUS_SKILLS } from './constants';
import { CommunicationCoach } from './services/geminiService';
import LanguageSwitcher from './components/LanguageSwitcher';
import VoiceVisualizer from './components/VoiceVisualizer';
import PronunciationWorkshop from './components/PronunciationWorkshop';
import LiveMetrics from './components/LiveMetrics';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('en');
  const [isRTL, setIsRTL] = useState(false);
  const [activeScreen, setActiveScreen] = useState<'home' | 'customize' | 'practice' | 'results' | 'auth'>('auth');
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

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [history, setHistory] = useState<SessionResult[]>([]);
  const [lastTranscription, setLastTranscription] = useState('');
  
  // Real-time metrics
  const [liveEnergy, setLiveEnergy] = useState(0);
  const [livePace, setLivePace] = useState(0);
  
  const [currentPlaybackId, setCurrentPlaybackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const coachRef = useRef<CommunicationCoach>(new CommunicationCoach());
  const metricsIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    setIsRTL(lang.startsWith('ar'));
    document.documentElement.dir = lang.startsWith('ar') ? 'rtl' : 'ltr';
    document.documentElement.lang = lang === 'en' ? 'en' : 'ar';
  }, [lang]);

  // Auth/Key Check
  useEffect(() => {
    const checkKey = async () => {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (hasKey) {
        setActiveScreen('home');
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    await (window as any).aistudio.openSelectKey();
    setActiveScreen('home');
  };

  // Generate topics when Confidence scenario is picked
  useEffect(() => {
    if (activeScreen === 'customize' && selectedScenario?.type === ScenarioType.CONFIDENCE) {
      const fetchTopics = async () => {
        setIsLoadingTopics(true);
        try {
          const topics = await coachRef.current.generateSuggestedTopics(lang);
          setSuggestedTopics(topics);
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoadingTopics(false);
        }
      };
      fetchTopics();
    } else {
      setSuggestedTopics([]);
    }
  }, [activeScreen, selectedScenario, lang]);

  // Handle real-time metrics polling
  useEffect(() => {
    if (isSessionActive) {
      metricsIntervalRef.current = window.setInterval(() => {
        const metrics = coachRef.current.getRealtimeMetrics();
        setLiveEnergy(metrics.energy);
        setLivePace(metrics.pace);
      }, 100);

      const paceResetInterval = window.setInterval(() => {
        coachRef.current.resetPaceCounter();
      }, 3000);

      return () => {
        if (metricsIntervalRef.current) window.clearInterval(metricsIntervalRef.current);
        window.clearInterval(paceResetInterval);
      };
    } else {
      setLiveEnergy(0);
      setLivePace(0);
    }
  }, [isSessionActive]);

  const handleScenarioClick = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setSelectedPersona(scenario.personas[0]);
    setTopic('');
    setOutcome('');
    setSelectedSkills([]);
    setActiveScreen('customize');
  };

  const handleError = (e: any) => {
    console.error("Session Error caught in App:", e);
    const msg = e?.message || "A network error occurred.";
    if (msg.includes("Requested entity was not found")) {
      setErrorMsg("API Key configuration error. Please re-select your key.");
      setActiveScreen('auth');
    } else if (msg.includes("CANCELLED") || msg.includes("cancelled")) {
      setErrorMsg("Connection was reset by server. Retrying might help.");
      setIsSessionActive(false);
    } else {
      setErrorMsg(msg);
      setIsSessionActive(false);
    }
  };

  const startSession = async () => {
    if (!selectedScenario || !selectedPersona) return;
    setErrorMsg(null);

    const config: SessionConfig = {
      scenario: selectedScenario,
      persona: selectedPersona,
      topic: topic || selectedScenario.description[lang],
      outcome: outcome || (selectedPersona.isWarm ? "Build openness and connection" : "Master the goal"),
      focusSkills: selectedSkills.length > 0 ? selectedSkills : (selectedPersona.isWarm ? ['vulnerability', 'clarity'] : ['clarity'])
    };

    try {
      setActiveScreen('practice');
      setIsSessionActive(true);
      setLastTranscription('');
      await coachRef.current.startSession(config, lang, {
        onTranscriptionUpdate: (text) => setLastTranscription(text),
        onClose: () => setIsSessionActive(false),
        onerror: handleError
      });
    } catch (err: any) {
      handleError(err);
      setActiveScreen('customize');
    }
  };

  const endSession = async () => {
    setIsSessionActive(false);
    setIsAnalyzing(true);
    const { history: conversationText, recordedTurns } = coachRef.current.stopSession();
    try {
      if (conversationText.trim().length === 0) {
        setActiveScreen('home');
        return;
      }
      const config: SessionConfig = {
        scenario: selectedScenario!,
        persona: selectedPersona!,
        topic: topic || selectedScenario!.description[lang],
        outcome: outcome || "Goal achievement",
        focusSkills: selectedSkills.length > 0 ? selectedSkills : ['clarity']
      };
      const result = await coachRef.current.getDetailedAnalysis(conversationText, config, lang);
      setAnalysisResult(result);
      const newResult: SessionResult = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString(),
        scenarioType: selectedScenario!.type,
        confidenceScore: result.confidenceScore,
        effectivenessScore: result.effectivenessScore,
        feedback: result.feedback,
        duration: 0,
        personaName: selectedPersona!.name[lang],
        troubleWords: result.troubleWords,
        recordingTurns: recordedTurns
      };
      setHistory(prev => [newResult, ...prev]);
      setActiveScreen('results');
    } catch (err: any) {
      handleError(err);
      setActiveScreen('home');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const playTurnAudio = (turn: RecordingTurn) => {
    if (currentPlaybackId === turn.id) {
       audioRef.current?.pause();
       setCurrentPlaybackId(null);
       return;
    }

    if (turn.audioUrl) {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = turn.audioUrl;
      audioRef.current.play();
      setCurrentPlaybackId(turn.id);
      audioRef.current.onended = () => setCurrentPlaybackId(null);
    }
  };

  const t = (key: keyof typeof TRANSLATIONS) => TRANSLATIONS[key][lang];

  // Logic for persona-based visual styles
  const getPersonaColors = (p: Persona | null) => {
    if (!p) return { border: 'border-blue-500', text: 'text-blue-500', bg: 'bg-blue-600', ring: 'border-blue-500', visualizer: 'bg-blue-500' };
    if (p.isWarm) return { border: 'border-orange-500', text: 'text-orange-400', bg: 'bg-orange-600', ring: 'border-orange-500', visualizer: 'bg-orange-400' };
    if (p.id === 'd4') return { border: 'border-cyan-400', text: 'text-cyan-400', bg: 'bg-cyan-600', ring: 'border-cyan-400', visualizer: 'bg-cyan-400' };
    if (p.id === 'd5' || p.id === 'd2') return { border: 'border-red-500', text: 'text-red-500', bg: 'bg-red-600', ring: 'border-red-500', visualizer: 'bg-red-500' };
    return { border: 'border-blue-500', text: 'text-blue-500', bg: 'bg-blue-600', ring: 'border-blue-500', visualizer: 'bg-blue-500' };
  };

  const colors = getPersonaColors(selectedPersona);

  if (activeScreen === 'auth') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-blue-600 flex items-center justify-center text-white text-3xl mb-8 shadow-2xl shadow-blue-500/20">
          <i className="fas fa-bullseye"></i>
        </div>
        <h1 className="text-3xl font-black text-white mb-4">VocalEdge AI</h1>
        <p className="text-slate-400 mb-8 max-w-xs leading-relaxed">
          Master communication with native audio interactions. Select a paid project API key to continue.
        </p>
        <button 
          onClick={handleSelectKey}
          className="px-8 py-4 bg-white text-slate-950 font-bold rounded-2xl hover:scale-105 transition-transform active:scale-95 flex items-center gap-3"
        >
          <i className="fas fa-key"></i>
          Select API Key
        </button>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-6 text-xs text-slate-500 underline decoration-slate-700"
        >
          Billing & Setup Guide
        </a>
        {errorMsg && (
          <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
            {errorMsg}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto shadow-2xl relative ${isRTL ? 'font-arabic' : 'font-english'}`}>
      {showPronunciationWorkshop && analysisResult?.troubleWords && (
        <PronunciationWorkshop 
          items={analysisResult.troubleWords}
          lang={lang}
          coach={coachRef.current}
          onClose={() => setShowPronunciationWorkshop(false)}
        />
      )}

      <header className="p-6 flex justify-between items-center border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <i className="fas fa-bullseye text-blue-500"></i>
            VocalEdge
          </h1>
        </div>
        <LanguageSwitcher current={lang} onChange={setLang} />
      </header>

      <main className="flex-1 overflow-y-auto p-6 pb-24">
        {activeScreen === 'home' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{t('welcome')}</h2>
              <p className="text-slate-400 text-sm">Pick a scenario and test your edge.</p>
            </div>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">{t('practiceNow')}</h3>
              <div className="grid gap-4">
                {SCENARIOS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleScenarioClick(s)}
                    className="group flex items-center p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500 transition-all text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                      <i className={`fas ${s.icon} text-xl`}></i>
                    </div>
                    <div className={`flex-1 ${isRTL ? 'mr-4' : 'ml-4'}`}>
                      <h4 className="font-semibold text-white">{s.title[lang]}</h4>
                      <p className="text-xs text-slate-400 line-clamp-1">{s.description[lang]}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {history.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">{t('history')}</h3>
                <div className="space-y-3">
                  {history.slice(0, 3).map(item => (
                    <div key={item.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-slate-500">{item.personaName} • {item.date}</span>
                        <span className="text-xs font-bold text-blue-400">{item.confidenceScore}%</span>
                      </div>
                      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${item.confidenceScore}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeScreen === 'customize' && selectedScenario && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex items-center gap-3">
               <button onClick={() => setActiveScreen('home')} className="text-slate-500 hover:text-white">
                 <i className={`fas fa-arrow-${isRTL ? 'right' : 'left'}`}></i>
               </button>
               <h2 className="text-2xl font-bold text-white">{t('customize')}</h2>
            </div>

            <div className="space-y-6">
              {selectedScenario.type === ScenarioType.CONFIDENCE && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">{t('suggestedTopics')}</label>
                  {isLoadingTopics ? (
                    <div className="flex items-center gap-2 text-blue-400 text-xs py-2">
                      <i className="fas fa-sparkles fa-spin"></i>
                      {t('generatingTopics')}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {suggestedTopics.map((top, idx) => (
                        <button
                          key={idx}
                          onClick={() => setTopic(top)}
                          className={`p-3 text-xs text-left rounded-xl border transition-all ${
                            topic === top ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          {top}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">{t('topicPlaceholder')}</label>
                  <input 
                    type="text" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={selectedScenario.description[lang]}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
                {selectedScenario.type !== ScenarioType.CONFIDENCE && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">{t('outcomePlaceholder')}</label>
                    <input 
                      type="text" 
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                      placeholder="e.g. Negotiate a 10% discount"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">{t('selectPersona')}</label>
                <div className="grid grid-cols-1 gap-3">
                  {selectedScenario.personas.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPersona(p)}
                      className={`flex items-center p-3 rounded-xl border transition-all text-left ${
                        selectedPersona?.id === p.id ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedPersona?.id === p.id ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                        <i className={`fas ${p.icon}`}></i>
                      </div>
                      <div className={`flex-1 ${isRTL ? 'mr-3' : 'ml-3'}`}>
                        <h4 className="text-sm font-bold text-white">{p.name[lang]}</h4>
                        <p className="text-[10px] text-slate-500">{p.role[lang]}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">{t('focusSkills')}</label>
                <div className="flex flex-wrap gap-2">
                  {FOCUS_SKILLS.filter(s => selectedScenario.type === ScenarioType.CONFIDENCE ? true : s.id !== 'vulnerability').map(skill => (
                    <button
                      key={skill.id}
                      onClick={() => {
                        setSelectedSkills(prev => 
                          prev.includes(skill.id) ? prev.filter(s => s !== skill.id) : [...prev, skill.id]
                        )
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedSkills.includes(skill.id) 
                          ? 'bg-blue-600 border-blue-500 text-white' 
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      {skill.label[lang]}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={startSession}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all"
              >
                {t('startSession')}
              </button>
            </div>
          </div>
        )}

        {activeScreen === 'practice' && selectedScenario && selectedPersona && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-12 py-10">
            <div className="space-y-4">
              <div className="relative inline-block">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center text-4xl bg-slate-900 border-2 ${isSessionActive ? colors.border : 'border-slate-800'} transition-colors duration-500`}>
                   <i className={`fas ${selectedPersona.icon} ${isSessionActive ? colors.text : 'text-slate-500'}`}></i>
                </div>
                {isSessionActive && (
                  <div className={`absolute inset-0 rounded-full border-2 ${colors.ring} animate-pulse-ring`}></div>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedPersona.name[lang]}</h2>
                <p className={`${colors.text} text-sm font-semibold`}>{selectedPersona.role[lang]}</p>
              </div>
              <p className="text-slate-500 text-xs italic px-6">"{topic || selectedScenario.description[lang]}"</p>
            </div>

            <div className="w-full min-h-[140px] bg-slate-900/40 rounded-3xl p-6 border border-slate-800/50 flex flex-col justify-center italic text-slate-300">
              {isSessionActive ? (
                <>
                  <VoiceVisualizer color={colors.visualizer} />
                  <p className="text-sm mt-4 opacity-70 animate-pulse h-12 overflow-hidden px-4">
                    {lastTranscription || (lang === 'en' ? (selectedPersona.isWarm ? "Take your time... I'm listening." : "Listening...") : (selectedPersona.isWarm ? "خذ وقتك... أنا أسمعك." : "جاري الاستماع..."))}
                  </p>
                  <LiveMetrics energy={liveEnergy} pace={livePace} lang={lang} />
                </>
              ) : (
                <p className="text-sm opacity-50">Ready when you are.</p>
              )}
              {errorMsg && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                   <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{errorMsg}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 w-full px-6">
              <button
                onClick={isSessionActive ? endSession : startSession}
                disabled={isAnalyzing}
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                  isSessionActive 
                    ? 'bg-red-500 text-white shadow-xl shadow-red-900/30' 
                    : `${colors.bg} text-white shadow-xl opacity-90 hover:opacity-100`
                }`}
              >
                {isAnalyzing ? (
                   <>
                     <i className="fas fa-circle-notch fa-spin"></i>
                     {t('analyzing')}
                   </>
                ) : (
                  <>
                    <i className={`fas ${isSessionActive ? 'fa-stop' : 'fa-microphone'}`}></i>
                    {isSessionActive ? t('endSession') : t('startSession')}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeScreen === 'results' && analysisResult && (
          <div className="space-y-8 animate-fadeIn pb-10">
             <div className="text-center">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${selectedPersona?.isWarm ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-500'} mb-4`}>
                   <i className={`fas ${selectedPersona?.isWarm ? 'fa-heart' : 'fa-check-circle'} text-3xl`}></i>
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">{selectedPersona?.isWarm ? 'Session Complete' : t('feedbackTitle')}</h2>
                <p className="text-slate-400 text-sm">Roleplay with {selectedPersona?.name[lang]}</p>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center">
                   <span className="text-xs text-slate-500 uppercase tracking-wider mb-2">{t('confidence')}</span>
                   <span className="text-3xl font-bold text-white">{analysisResult.confidenceScore}%</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center">
                   <span className="text-xs text-slate-500 uppercase tracking-wider mb-2">{t('effectiveness')}</span>
                   <span className="text-3xl font-bold text-white">{analysisResult.effectivenessScore}%</span>
                </div>
             </div>

             <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <i className={`fas ${selectedPersona?.isWarm ? 'fa-comment-medical' : 'fa-brain'} text-blue-500`}></i>
                  Coach's Insight
                </h3>
                <div className={`p-5 rounded-2xl border ${selectedPersona?.isWarm ? 'bg-orange-500/5 border-orange-500/20' : 'bg-slate-900 border-slate-800'} prose prose-invert max-w-none`}>
                  <p className="text-slate-300 leading-relaxed italic">
                    "{analysisResult.feedback}"
                  </p>
                </div>
             </div>

             {history[0]?.recordingTurns && history[0].recordingTurns.length > 0 && (
                <div className="space-y-4">
                   <h3 className="text-lg font-bold text-white">{t('reviewRecording')}</h3>
                   <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 max-h-[400px] overflow-y-auto">
                      {history[0].recordingTurns.map((turn) => (
                         <div 
                           key={turn.id} 
                           className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${
                             turn.role === 'user' ? 'bg-slate-800/30 border-slate-700/50 self-end ml-10' : 'bg-blue-600/5 border-blue-500/20 mr-10'
                           }`}
                         >
                            <div className="flex justify-between items-center">
                               <span className={`text-[10px] font-bold uppercase ${turn.role === 'user' ? 'text-slate-500' : 'text-blue-500'}`}>
                                 {turn.role === 'user' ? 'You' : selectedPersona?.name[lang]}
                               </span>
                               {turn.audioUrl && (
                                  <button onClick={() => playTurnAudio(turn)} className="text-blue-400"><i className={`fas ${currentPlaybackId === turn.id ? 'fa-pause' : 'fa-play'} text-[10px]`}></i></button>
                               )}
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed italic">{turn.text}</p>
                         </div>
                      ))}
                   </div>
                </div>
             )}

             <button 
               onClick={() => setActiveScreen('home')}
               className="w-full py-4 bg-slate-100 text-slate-950 rounded-2xl font-bold hover:bg-white transition-colors"
             >
                Back to Dashboard
             </button>
          </div>
        )}
      </main>

      {activeScreen === 'home' && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-20 bg-slate-950 border-t border-slate-900 flex items-center justify-around px-10 z-20">
          <button onClick={() => setActiveScreen('home')} className="flex flex-col items-center gap-1 text-blue-500">
            <i className="fas fa-home text-xl"></i>
            <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-600 opacity-50 cursor-not-allowed"><i className="fas fa-chart-bar text-xl"></i></button>
          <button className="flex flex-col items-center gap-1 text-slate-600 opacity-50 cursor-not-allowed"><i className="fas fa-user text-xl"></i></button>
        </nav>
      )}
    </div>
  );
};

export default App;
