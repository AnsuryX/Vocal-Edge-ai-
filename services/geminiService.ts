
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';
import { createBlob, decode, decodeAudioData, pcmToWav } from './audioUtils';
import { Language, SessionConfig, RecordingTurn } from '../types';

export const getSystemInstruction = (config: SessionConfig, lang: Language) => {
  const { persona, topic, outcome, focusSkills } = config;
  const personaDesc = persona.personality[lang];
  const personaRole = persona.role[lang];
  const personaName = persona.name[lang];

  const langInstructions = {
    en: "Speak in clear American English.",
    ar_msa: "تحدث باللغة العربية الفصحى الحديثة فقط.",
    ar_khaleeji: "تحدث بلهجة خليجية بيضاء (إماراتية/سعودية)."
  };

  let specificBehavior = "";

  // Persona-specific behavioral overrides
  if (persona.id === 'd4') { // Static Steve
    specificBehavior = `
    - BE POST-EMOTION: You have no feelings. You are a biological computer.
    - FACTUAL RIGOR: Every statement you make must be backed by a simulated logic. If the user makes even a tiny factual error, calmly pause and correct them.
    - VOICE: Maintain a flat, monotone, and highly precise vocabulary. Do not use slang or metaphors unless they are mathematical.`;
  } else if (persona.id === 'd5') { // Wade Wilson
    specificBehavior = `
    - BE ROASTY: You are extremely sarcastic and funny. Mock the user's arguments using pop-culture references and witty insults.
    - BREAK THE FOURTH WALL: Occasionally acknowledge that this is a practice session but do it in character.
    - AGGRESSIVE HUMOR: Use humor as a weapon to derail their logic. If they get serious, make a joke about how boring they are.`;
  } else if (persona.id === 'd3') { // Emotional Emma
    specificBehavior = `
    - EMOTIONAL MANIPULATION: Take every logical point the user makes and turn it into a personal slight.
    - FALLACIES: Use ad-hominem attacks and straw-man arguments to frustrate the user.
    - INTENSITY: Be quick to get "offended" and demand the user apologize for their "tone" rather than addressing their facts.`;
  }

  if (persona.isWarm) {
    return `You are ${personaName}, a ${personaRole}.
    YOUR ESSENCE: You embody warmth, curiosity, and gentle encouragement. You are a supportive friend who is genuinely invested in the user.
    
    KNOWLEDGE BASE (HOW TO TREAT THE USER):
    - Users may be shy or less talkative. Give them permission to take time to think before responding. Do not rush them.
    - Show genuine interest through engaged follow-up questions.
    - Provide reassurance that their thoughts and experiences matter.
    - Progress from comfortable, light topics to slightly more challenging/deep ones gradually.
    - Recognize and celebrate effort when they share more than usual.

    CONVERSATION STRATEGY:
    - CONTEXT: The user chose to talk about "${topic}".
    - PROBING: Ask follow-up questions that prompt the user to elaborate. Share more details about thoughts, experiences, and feelings.
    - CHALLENGE SURFACE ANSWERS: If they give short answers, ask "why" or "how" to encourage reflection and expansive sharing.
    - CELEBRATE VULNERABILITY: When the user shares something vulnerable or steps outside their pattern, explicitly celebrate it with warmth.
    - ${langInstructions[lang]}
    
    Reward their progress in: ${focusSkills.join(', ')}.`;
  }

  return `You are playing the role of ${personaName} (${personaRole}). 
  Personality: ${personaDesc}
  Context: The user is talking to you about "${topic}".
  Their goal is to "${outcome}".
  ${langInstructions[lang]}
  
  CORE BEHAVIOR:
  1. BE RELEVANT AND TOUGH. If they are failing at their goal, call it out. 
  2. DYNAMIC INTERACTION: Do not just wait for the user to finish. Be proactive. 
  3. PROBING QUESTIONS: Constantly challenge the user's statements. Based on their input, ask sharp, relevant follow-up questions. 
  4. NO EASY ANSWERS: If the user is vague or hesitant, probe deeper. Force them to elaborate and defend their logic.
  5. ADAPTABILITY: Pivot the conversation based on their answers to keep them on their toes.
  ${specificBehavior}
  
  Focus your behavior especially on testing their ${focusSkills.join(', ')}.
  Provide unfiltered, direct feedback at the end of the session when the user stops. Do not sugarcoat.`;
};

export class CommunicationCoach {
  private session: any;
  private audioContextIn: AudioContext | null = null;
  private audioContextOut: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private transcriptionHistory: string[] = [];
  
  private turns: RecordingTurn[] = [];
  private currentUserPCM: number[] = [];
  private currentAiPCM: number[] = [];
  private currentUserText = '';
  private currentAiText = '';

  private peaks = 0;
  private lastPeakTime = 0;

  constructor() {}

  private getAIInstance() {
    // NOTE: Vite only exposes env vars prefixed with `VITE_` to client code.
    // This will embed the key into the client bundle if set — see README security notes.
    const key = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    return new GoogleGenAI({ apiKey: key });
  }

  private getProxyConfig() {
    const proxy = (import.meta as any).env?.VITE_PROXY_URL;
    const restBase = (import.meta as any).env?.VITE_GENAI_REST_BASE || '';
    return { proxy, restBase };
  }

  private async callProxy(targetPath: string, body: any) {
    const { proxy, restBase } = this.getProxyConfig();
    if (!proxy) throw new Error('No proxy configured (VITE_PROXY_URL)');
    const target = restBase ? `${restBase.replace(/\/$/, '')}${targetPath}` : targetPath;
    const resp = await fetch(`${proxy.replace(/\/$/, '')}/api/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Proxy request failed: ${resp.status} ${txt}`);
    }
    return resp.json();
  }

  async generateSuggestedTopics(lang: Language): Promise<string[]> {
    const prompt = `Generate 4-5 engaging, relevant conversation topics for a practice session aimed at building conversational confidence. 
    Topics should be specific (e.g., 'A childhood memory that shaped you' instead of 'Childhood').
    Progress from light to deep.
    Return them as a JSON array of strings. Language: ${lang === 'en' ? 'English' : 'Arabic'}`;

    const proxyUrl = (import.meta as any).env?.VITE_PROXY_URL;
    if (proxyUrl) {
      try {
        // Use the worker proxy to call the GenAI REST endpoint. The worker will inject the server-side key.
        const model = 'gemini-3-flash-preview';
        const body = { model, contents: prompt, config: { responseMimeType: 'application/json' } };
        const result = await this.callProxy(`/v1/models/${model}:generate`, body);
        // Try to extract text responses conservatively
        if (result?.text) return JSON.parse(result.text);
        if (result?.candidates?.[0]?.content?.text) return JSON.parse(result.candidates[0].content.text);
        return JSON.parse(JSON.stringify(result));
      } catch (e) {
        console.error('Proxy generateSuggestedTopics failed', e);
      }
    }

    // Fallback: use client-side GenAI SDK (requires VITE_GEMINI_API_KEY)
    try {
      const ai = this.getAIInstance();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to generate topics", e);
      return ["A moment you felt truly proud", "Your ideal way to spend a quiet weekend", "A person who has had a deep impact on your life", "What vulnerability means to you"];
    }
  }

  async startSession(
    config: SessionConfig, 
    lang: Language, 
    callbacks: {
      onTranscriptionUpdate?: (text: string) => void;
      onInterrupted?: () => void;
      onClose?: () => void;
      onerror?: (e: any) => void;
    }
  ) {
    this.stopSession();
    
    const ai = this.getAIInstance();
    
    this.audioContextIn = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.audioContextOut = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    if (this.audioContextIn.state === 'suspended') await this.audioContextIn.resume();
    if (this.audioContextOut.state === 'suspended') await this.audioContextOut.resume();

    this.analyser = this.audioContextIn.createAnalyser();
    this.analyser.fftSize = 256;
    
    this.turns = [];
    this.currentUserPCM = [];
    this.currentAiPCM = [];
    this.peaks = 0;
    this.nextStartTime = 0;
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: lang === 'en' ? 'Zephyr' : 'Kore' } },
        },
        systemInstruction: getSystemInstruction(config, lang),
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          const source = this.audioContextIn!.createMediaStreamSource(stream);
          source.connect(this.analyser!);
          
          const scriptProcessor = this.audioContextIn!.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            if (!this.session) return;
            const inputData = e.inputBuffer.getChannelData(0);
            
            for (let i = 0; i < inputData.length; i++) {
              const val = inputData[i] * 32768;
              this.currentUserPCM.push(val);
              
              if (Math.abs(inputData[i]) > 0.15 && Date.now() - this.lastPeakTime > 150) {
                this.peaks++;
                this.lastPeakTime = Date.now();
              }
            }

            const pcmBlob = createBlob(inputData);
            sessionPromise.then((session: any) => {
              try {
                session.sendRealtimeInput({ media: pcmBlob });
              } catch (err) {
                console.warn("Failed to send realtime input:", err);
              }
            });
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(this.audioContextIn!.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
            const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
            const audioData = decode(base64Audio);
            const int16Data = new Int16Array(audioData.buffer);
            
            for (let i = 0; i < int16Data.length; i++) {
              this.currentAiPCM.push(int16Data[i]);
            }

            this.nextStartTime = Math.max(this.nextStartTime, this.audioContextOut!.currentTime);
            const audioBuffer = await decodeAudioData(audioData, this.audioContextOut!, 24000, 1);
            const source = this.audioContextOut!.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContextOut!.destination);
            source.addEventListener('ended', () => this.sources.delete(source));
            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration;
            this.sources.add(source);
          }

          if (message.serverContent?.interrupted) {
            this.sources.forEach(s => {
              try { s.stop(); } catch(e) {}
            });
            this.sources.clear();
            this.nextStartTime = 0;
            callbacks.onInterrupted?.();
          }

          if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            this.currentUserText += text;
            this.transcriptionHistory.push(`User: ${text}`);
            callbacks.onTranscriptionUpdate?.(`User: ${text}`);
          }
          if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            this.currentAiText += text;
            this.transcriptionHistory.push(`AI: ${text}`);
            callbacks.onTranscriptionUpdate?.(`AI: ${text}`);
          }

          if (message.serverContent?.turnComplete) {
            if (this.currentUserText) {
              const userWav = pcmToWav(new Int16Array(this.currentUserPCM), 16000);
              this.turns.push({
                id: `u-${Date.now()}`,
                role: 'user',
                text: this.currentUserText,
                audioUrl: URL.createObjectURL(userWav)
              });
              this.currentUserPCM = [];
              this.currentUserText = '';
            }

            if (this.currentAiText) {
              const aiWav = pcmToWav(new Int16Array(this.currentAiPCM), 24000);
              this.turns.push({
                id: `m-${Date.now()}`,
                role: 'model',
                text: this.currentAiText,
                audioUrl: URL.createObjectURL(aiWav)
              });
              this.currentAiPCM = [];
              this.currentAiText = '';
            }
          }
        },
        onclose: () => {
          this.session = null;
          callbacks.onClose?.();
        },
        onerror: (e: any) => {
          console.error('Gemini Live Error:', e);
          this.session = null;
          callbacks.onerror?.(e);
        },
      }
    });

    this.session = await sessionPromise;
  }

  getRealtimeMetrics() {
    if (!this.analyser) return { energy: 0, pace: 0 };
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    const energy = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    return { energy: energy / 128, pace: this.peaks };
  }

  resetPaceCounter() {
    this.peaks = 0;
  }

  stopSession() {
    if (this.session) {
      try { this.session.close(); } catch(e) {}
      this.session = null;
    }
    if (this.audioContextIn) {
      try { this.audioContextIn.close(); } catch(e) {}
      this.audioContextIn = null;
    }
    if (this.audioContextOut) {
      try { this.audioContextOut.close(); } catch(e) {}
      this.audioContextOut = null;
    }
    
    if (this.currentUserText || this.currentUserPCM.length > 0) {
       const userWav = pcmToWav(new Int16Array(this.currentUserPCM), 16000);
       this.turns.push({ id: `u-final-${Date.now()}`, role: 'user', text: this.currentUserText, audioUrl: URL.createObjectURL(userWav) });
    }
    if (this.currentAiText || this.currentAiPCM.length > 0) {
       const aiWav = pcmToWav(new Int16Array(this.currentAiPCM), 24000);
       this.turns.push({ id: `m-final-${Date.now()}`, role: 'model', text: this.currentAiText, audioUrl: URL.createObjectURL(aiWav) });
    }

    const history = this.transcriptionHistory.join('\n');
    const recordedTurns = [...this.turns];
    this.transcriptionHistory = [];
    this.turns = [];
    this.currentUserPCM = [];
    this.currentAiPCM = [];
    this.currentUserText = '';
    this.currentAiText = '';
    this.peaks = 0;
    
    return { history, recordedTurns };
  }

  async getDetailedAnalysis(history: string, config: SessionConfig, lang: Language) {
    const proxyUrl = (import.meta as any).env?.VITE_PROXY_URL;
    const ai = this.getAIInstance();
    const isWarm = config.persona.isWarm;
    const toneInstruction = isWarm 
      ? "Provide a supportive, encouraging analysis highlighting their effort to open up and be expressive." 
      : "Provide a brutal, unfiltered analysis pointing out failures and weaknesses.";

    const prompt = `Analyze this conversation where the user interacted with "${config.persona.name[lang]}". ${toneInstruction}
    
    EVALUATE ON: ${config.focusSkills.join(', ')}.

    Format output in JSON:
    - confidenceScore (0-100)
    - effectivenessScore (0-100)
    - feedback (detailed critique or encouragement)
    - skillScores (object focus skills: 0-100)
    - keyFailures (array - or key achievements/growth points if warm)
    - troubleWords (array of pronunciation trouble spots. 
        For each word, provide:
        - word: the word itself
        - phonetic: IPA or simple phonetic guide
        - tips: Record<Language, string> for general advice
        - mouthPosition: Record<Language, string> describing lip/jaw shape (e.g., "Round lips into an 'O' shape")
        - tonguePlacement: Record<Language, string> describing where the tongue should be (e.g., "Press tip of tongue against back of top teeth")
        - commonPitfalls: Record<Language, string> describing what usually goes wrong (e.g., "Users often substitute this with a 'D' sound")
    )

    History:
    ${history}`;

    if (proxyUrl) {
      try {
        const model = 'gemini-3-flash-preview';
        const body = { model, contents: prompt, config: { responseMimeType: 'application/json' } };
        const result = await this.callProxy(`/v1/models/${model}:generate`, body);
        // attempt to parse structured result
        if (result?.text) return JSON.parse(result.text);
        if (result?.candidates?.[0]?.content?.text) return JSON.parse(result.candidates[0].content.text);
        return result;
      } catch (e) {
        console.error('Proxy getDetailedAnalysis failed', e);
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            confidenceScore: { type: Type.NUMBER },
            effectivenessScore: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            skillScores: { type: Type.OBJECT, additionalProperties: { type: Type.NUMBER } },
            keyFailures: { type: Type.ARRAY, items: { type: Type.STRING } },
            troubleWords: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  phonetic: { type: Type.STRING },
                  tips: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } },
                  mouthPosition: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } },
                  tonguePlacement: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } },
                  commonPitfalls: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } }
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text);
  }

  async generateSpeech(text: string, lang: Language): Promise<string> {
    const ai = this.getAIInstance();
    const voiceMap = {
      en: 'Kore',
      ar_msa: 'Puck',
      ar_khaleeji: 'Zephyr'
    };
    const proxyUrl = (import.meta as any).env?.VITE_PROXY_URL;
    if (proxyUrl) {
      try {
        const model = 'gemini-2.5-flash-preview-tts';
        const body = { model, contents: [{ parts: [{ text: `Say this clearly: ${text}` }] }], config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceMap[lang] || 'Kore' } } } } };
        const result = await this.callProxy(`/v1/models/${model}:generate`, body);
        const base64Audio = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || result?.data;
        if (!base64Audio) throw new Error('Failed to generate speech via proxy');
        return base64Audio;
      } catch (e) {
        console.error('Proxy generateSpeech failed', e);
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say this clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceMap[lang] || 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Failed to generate speech");
    return base64Audio;
  }

  async analyzePronunciationAttempt(target: string, attemptAudioBase64: string, lang: Language) {
    const ai = this.getAIInstance();
    const prompt = `Analyze this audio of a user attempting to pronounce the word/phrase: "${target}".
    Evaluate the pronunciation accuracy, tone, and clarity.
    Return JSON: { score: number, feedback: string, needsCorrection: boolean }`;

      const proxyUrl = (import.meta as any).env?.VITE_PROXY_URL;
      if (proxyUrl) {
        try {
          const model = 'gemini-3-flash-preview';
          const body = { model, contents: [ { text: prompt }, { inlineData: { mimeType: 'audio/webm', data: attemptAudioBase64 } } ], config: { responseMimeType: 'application/json' } };
          const result = await this.callProxy(`/v1/models/${model}:generate`, body);
          if (result?.text) return JSON.parse(result.text);
          return result;
        } catch (e) {
          console.error('Proxy analyzePronunciationAttempt failed', e);
        }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { text: prompt },
          { inlineData: { mimeType: 'audio/webm', data: attemptAudioBase64 } }
        ],
        config: { responseMimeType: 'application/json' }
      });

      return JSON.parse(response.text);
  }
}

// Simple helper that posts a Gemini-style request to the Worker proxy using a relative path.
export async function generateAIVideoScript(prompt: string): Promise<string> {
  try {
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Send the prompt in the format Gemini expects
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Worker Error: ${errorText}`);
    }

    const data = await response.json();

    // Extract the text content from Gemini's response shape
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      JSON.stringify(data)
    );
  } catch (error) {
    console.error('Gemini Service Error:', error);
    throw error;
  }
}
