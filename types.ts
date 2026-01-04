
export type Language = 'en' | 'ar_msa' | 'ar_khaleeji';

export enum ScenarioType {
  SALES = 'SALES',
  NORMAL = 'NORMAL',
  DEBATE = 'DEBATE',
  CONFIDENCE = 'CONFIDENCE'
}

export interface Persona {
  id: string;
  name: Record<Language, string>;
  role: Record<Language, string>;
  personality: Record<Language, string>;
  icon: string;
  isWarm?: boolean; 
}

export interface Scenario {
  id: string;
  type: ScenarioType;
  title: Record<Language, string>;
  description: Record<Language, string>;
  icon: string;
  personas: Persona[];
}

export interface SessionConfig {
  scenario: Scenario;
  persona: Persona;
  topic: string;
  outcome: string;
  focusSkills: string[];
}

export interface PronunciationItem {
  word: string;
  phonetic?: string;
  tips: Record<Language, string>;
}

export interface RecordingTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  audioUrl?: string;
}

export interface SessionResult {
  id: string;
  date: string;
  scenarioType: ScenarioType;
  confidenceScore: number;
  effectivenessScore: number;
  feedback: string;
  duration: number;
  personaName: string;
  troubleWords?: PronunciationItem[];
  recordingTurns?: RecordingTurn[];
}

export interface UserProfile {
  name: string;
  bio: string;
  goal: string;
  preferredTone: 'brutal' | 'supportive';
  joinedDate: string;
}

export interface UserStats {
  totalSessions: number;
  avgConfidence: number;
  bestScenario: ScenarioType;
}
