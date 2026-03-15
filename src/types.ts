export type ItemType = "Consumable" | "Quest Item" | "Material" | "Unknown";

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  surfaceDescription: string;
  hiddenTruth?: string; // Dual-Layer Lore: Only AI sees this
  isUnresolvedMystery: boolean; // Lazy Evaluation: true if hiddenTruth is not yet generated
  usageCondition?: string; // Mechanical Anchoring: e.g., "Requires a locked door"
  effect?: string; // e.g., "HEAL_30"
  collectionTarget?: number; // e.g., 3
  currentCount?: number; // e.g., 1
}

export interface Triplet {
  source: string;
  relation: string;
  target: string;
}

export interface QuestNode {
  id: string;
  title: string;
  description: string;
  dependencies: string[]; // IDs of prerequisite quests
  status: "locked" | "available" | "active" | "completed";
}

export interface PacingMetrics {
  turnsSinceLastCombat: number;
  turnsInCurrentLocation: number;
  turnsSinceMainQuestUpdate: number;
  consecutiveDialogueTurns: number;
}

export interface StoryAct {
  actIndex: number;
  name: string;
  goal: string;
  completionCondition: string;
  isCompleted: boolean;
}

export interface DirectorNote {
  pacing: "fast-forward" | "normal" | "slow-burn";
  plot_injection: string;
  advance_act: boolean;
  weather_or_mood: "peaceful" | "tense" | "horror" | "neutral";
}

export interface CharacterStats {
  str: number;
  dex: number;
  int: number;
  cha: number;
}

export interface GameState {
  inventory: Item[];
  activeMysteries: string[];
  knowledgeGraph: Triplet[];
  questDAG: Record<string, QuestNode>;
  currentLocation: string;
  hp: number;
  maxHp: number;
  exp: number;
  level: number;
  stats: CharacterStats;
  metrics: PacingMetrics;
  tensionLevel: number; // 0-100
  storyOutline: { currentAct: number; acts: StoryAct[] };
  directorNote?: DirectorNote;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}
