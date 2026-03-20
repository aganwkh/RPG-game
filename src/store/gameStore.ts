import { create } from 'zustand';
import { GameState, LogEntry, Skill, StatDelta, InventoryDelta, Quest, NpcState } from '../types';
import { GAME_VERSION } from '../services/httpClient';

interface GameStore extends GameState {
  skillCooldowns: Record<string, number>;
  setGameState: (state: Partial<GameState> | ((state: GameState) => Partial<GameState>)) => void;
  addLog: (log: LogEntry) => void;
  addRecentHistory: (history: { action: string, story: string }) => void;
  useSkill: (skillName: string) => void;
  decrementCooldowns: () => void;
  loadGame: (savedState: Partial<GameState>) => void;
}

const defaultInitialState: GameState = {
  version: GAME_VERSION,
  storyText: 'Welcome to the world.',
  choices: ['Start'],
  inventory: [],
  skills: [],
  quests: [],
  npcStates: [],
  location: 'Unknown',
  stats: {
    hp: 100,
    maxHp: 100,
    gold: 0,
    level: 1,
    exp: 0,
    maxExp: 100,
    skillPoints: 0,
    attributes: {
      strength: 10,
      agility: 10,
      intelligence: 10,
      charisma: 10,
      luck: 10
    }
  },
  memory: {
    summary: '',
    worldInfo: []
  },
  director: {
    currentArc: '序章：未知的起点',
    globalPacing: 'normal',
    upcomingEvents: ['发现第一个线索', '遭遇初级敌人'],
    tension: 10
  },
  logs: [],
  combatLogs: [],
  recentHistory: [],
  daysPassed: 1
};

export const useGameStore = create<GameStore>((set) => ({
  ...defaultInitialState,
  skillCooldowns: {},

  setGameState: (newState) => set((state) => {
    const updates = typeof newState === 'function' ? newState(state) : newState;
    return { ...state, ...updates };
  }),

  addLog: (log) => set((state) => {
    const newLogs = [...(state.logs || []), log].slice(-50);
    return { logs: newLogs };
  }),

  addRecentHistory: (history) => set((state) => {
    const newHistory = [...(state.recentHistory || []), history].slice(-20);
    return { recentHistory: newHistory };
  }),

  useSkill: (skillName) => set((state) => {
    // Basic cooldown implementation: 3 turns
    return {
      skillCooldowns: {
        ...state.skillCooldowns,
        [skillName]: 3
      }
    };
  }),

  decrementCooldowns: () => set((state) => {
    const newCooldowns = { ...state.skillCooldowns };
    let changed = false;
    for (const skill in newCooldowns) {
      if (newCooldowns[skill] > 0) {
        newCooldowns[skill]--;
        changed = true;
      }
    }
    return changed ? { skillCooldowns: newCooldowns } : {};
  }),

  loadGame: (savedState) => set((state) => {
    // Migration logic
    let migratedState = { ...savedState };
    
    if (!migratedState.version) {
      // Migrate from pre-versioning
      migratedState.version = GAME_VERSION;
      if (!migratedState.recentHistory) {
        migratedState.recentHistory = [];
      }
    }

    return { ...defaultInitialState, ...migratedState, skillCooldowns: {} };
  })
}));
