export interface Attributes {
  strength: number;
  agility: number;
  intelligence: number;
  charisma: number;
  luck: number;
}

export const GAME_VERSION = '1.0.0';
export const DIRECTOR_PACINGS = ['slow', 'normal', 'fast'] as const;
export const LOG_TYPES = ['choice', 'event', 'system', 'location', 'level_up', 'item', 'combat', 'skill'] as const;
export const QUEST_STATUSES = ['active', 'completed', 'failed'] as const;
export const STAT_OPERATIONS = ['add', 'subtract', 'set'] as const;
export const INVENTORY_OPERATIONS = ['add', 'remove'] as const;
// AI-managed state deltas intentionally exclude maxExp. Level progression owns it internally.
export const STAT_DELTA_TARGETS = ['hp', 'maxHp', 'gold', 'level', 'exp', 'skillPoints', 'daysPassed', 'strength', 'agility', 'intelligence', 'charisma', 'luck'] as const;

export interface CharacterStats {
  hp: number;
  maxHp: number;
  gold: number;
  level: number;
  exp?: number;
  // Internal level progression threshold. Story extraction must not update it directly.
  maxExp?: number;
  skillPoints?: number;
  attributes?: Attributes;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogType;
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
  status: QuestStatus;
}

export interface NpcState {
  name: string;
  affinity: number;
  isAlive: boolean;
}

export interface DirectorState {
  currentArc: string;
  globalPacing: DirectorPacing;
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

export type DirectorPacing = typeof DIRECTOR_PACINGS[number];
export type LogType = typeof LOG_TYPES[number];
export type QuestStatus = typeof QUEST_STATUSES[number];
export type StatOperation = typeof STAT_OPERATIONS[number];
export type InventoryOperation = typeof INVENTORY_OPERATIONS[number];
export type StatDeltaTarget = typeof STAT_DELTA_TARGETS[number];

export interface StatDelta {
  target: StatDeltaTarget;
  operation: StatOperation;
  value: number;
}

export interface InventoryDelta {
  operation: InventoryOperation;
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
