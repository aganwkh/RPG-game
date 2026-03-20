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
  embedding?: number[];
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

export interface DirectorState {
  currentArc: string;
  globalPacing: 'slow' | 'normal' | 'fast';
  upcomingEvents: string[];
  tension: number;
  itemPlotHooks?: Record<string, string>;
}

export interface GameState {
  version?: string;
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
  director?: DirectorState;
  logs?: LogEntry[];
  combatLogs?: string[];
  recentHistory?: { action: string, story: string }[];
  daysPassed?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export type StatOperation = 'add' | 'subtract' | 'set';

export interface StatDelta {
  target: 'hp' | 'maxHp' | 'gold' | 'level' | 'exp' | 'skillPoints' | 'daysPassed';
  operation: StatOperation;
  value: number;
}

export interface InventoryDelta {
  operation: 'add' | 'remove';
  item: string;
}

export interface StateUpdateResult {
  statDeltas?: StatDelta[];
  inventoryDeltas?: InventoryDelta[];
  newLocation?: string;
  newSkills?: (Partial<Skill> & { name: string })[];
  questUpdates?: Quest[];
  npcUpdates?: NpcState[];
  logs?: LogEntry[];
  isGameOver?: boolean;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
