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

export interface GameState {
  inventory: Item[];
  activeMysteries: string[];
  knowledgeGraph: Triplet[];
  questDAG: Record<string, QuestNode>;
  currentLocation: string;
  hp: number;
  maxHp: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}
