export interface Attributes {
  strength: number;
  agility: number;
  intelligence: number;
  charisma: number;
  luck: number;
}

export interface CharacterStats {
  hp: number;
  maxHp: number;
  gold: number;
  level: number;
  exp?: number;
  maxExp?: number;
  skillPoints?: number;
  attributes?: Attributes;
}

export interface ApiSettings {
  provider: 'default' | 'custom';
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'choice' | 'event' | 'system' | 'location' | 'level_up' | 'item' | 'combat' | 'skill';
  text: string;
}

export interface Skill {
  name: string;
  level: number;
  exp: number;
  maxLevel: number;
}

export interface GameState {
  storyText: string;
  choices: string[];
  inventory: string[];
  skills: Skill[];
  currentQuest: string;
  location: string;
  stats: CharacterStats;
  logs?: LogEntry[];
  combatLogs?: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
