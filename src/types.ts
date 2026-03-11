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
  
  bgProvider?: 'default' | 'custom';
  bgBaseUrl?: string;
  bgApiKey?: string;
  bgModel?: string;
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

export interface LorebookEntry {
  keywords: string[];
  content: string;
}

export interface MemoryState {
  summary: string;
  worldInfo: LorebookEntry[];
}

export interface Quest {
  id: string;
  name: string;
  step: number;
  status: 'active' | 'completed' | 'failed';
}

export interface NpcState {
  name: string;
  affinity: number;
  isAlive: boolean;
}

export interface GameState {
  storyText: string;
  choices: string[];
  inventory: string[];
  skills: Skill[];
  quests: Quest[];
  npcStates: NpcState[];
  isGameOver?: boolean;
  location: string;
  stats: CharacterStats;
  memory?: MemoryState;
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
