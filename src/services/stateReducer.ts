import { GameState, CharacterStats, Skill, Quest, NpcState, LogEntry, StateUpdateResult } from '../types';

export const applyStateUpdates = (currentState: GameState, updates: StateUpdateResult): GameState => {
  const newState = { ...currentState };
  
  // Clone stats to avoid mutating the original
  newState.stats = { ...currentState.stats };
  if (currentState.stats.attributes) {
    newState.stats.attributes = { ...currentState.stats.attributes };
  }

  // Apply stat deltas
  if (updates.statDeltas && Array.isArray(updates.statDeltas)) {
    updates.statDeltas.forEach((delta) => {
      const target = delta.target as keyof CharacterStats | 'daysPassed';
      const value = Number(delta.value);
      
      const op = delta.operation as string;
      
      if (['hp', 'maxHp', 'gold', 'level', 'exp', 'maxExp', 'skillPoints'].includes(target)) {
        const statsRecord = newState.stats as unknown as Record<string, number>;
        if (op === 'add' || op === 'increase') {
          statsRecord[target] = (statsRecord[target] || 0) + value;
        } else if (op === 'subtract' || op === 'decrease') {
          statsRecord[target] = Math.max(0, (statsRecord[target] || 0) - value);
        } else if (op === 'set') {
          statsRecord[target] = value;
        }
      } else if (['strength', 'agility', 'intelligence', 'charisma', 'luck'].includes(target)) {
        if (newState.stats.attributes) {
          const attrRecord = newState.stats.attributes as unknown as Record<string, number>;
          if (op === 'add' || op === 'increase') {
            attrRecord[target] = (attrRecord[target] || 10) + value;
          } else if (op === 'subtract' || op === 'decrease') {
            attrRecord[target] = Math.max(1, (attrRecord[target] || 10) - value);
          } else if (op === 'set') {
            attrRecord[target] = Math.max(1, value);
          }
        }
      } else if (target === 'daysPassed') {
        if (op === 'add' || op === 'increase') {
          newState.daysPassed = (newState.daysPassed || 1) + value;
        } else if (op === 'subtract' || op === 'decrease') {
          newState.daysPassed = Math.max(1, (newState.daysPassed || 1) - value);
        } else if (op === 'set') {
          newState.daysPassed = Math.max(1, value);
        }
      }
    });
  }

  // Apply inventory deltas
  if (updates.inventoryDeltas && Array.isArray(updates.inventoryDeltas)) {
    newState.inventory = [...currentState.inventory];
    updates.inventoryDeltas.forEach((delta) => {
      const op = delta.operation as string;
      if ((op === 'add' || op === 'increase') && delta.item) {
        if (!newState.inventory.includes(delta.item)) {
          newState.inventory.push(delta.item);
        }
      } else if ((op === 'remove' || op === 'decrease' || op === 'subtract') && delta.item) {
        newState.inventory = newState.inventory.filter(i => i !== delta.item);
      }
    });
  }

  // Apply new location
  if (updates.newLocation && typeof updates.newLocation === 'string') {
    newState.location = updates.newLocation;
  }

  // Apply new skills
  if (updates.newSkills && Array.isArray(updates.newSkills)) {
    newState.skills = [...currentState.skills];
    updates.newSkills.forEach((skill) => {
      const existingSkillIndex = newState.skills.findIndex(s => s.name === skill.name);
      if (existingSkillIndex !== -1) {
        newState.skills[existingSkillIndex] = {
          ...newState.skills[existingSkillIndex],
          level: skill.level || newState.skills[existingSkillIndex].level,
          exp: skill.exp || newState.skills[existingSkillIndex].exp,
          maxLevel: skill.maxLevel || newState.skills[existingSkillIndex].maxLevel
        };
      } else {
        newState.skills.push({
          name: skill.name,
          level: skill.level || 1,
          exp: skill.exp || 0,
          maxLevel: skill.maxLevel || 15
        });
      }
    });
  }

  // Apply quest updates
  if (updates.questUpdates && Array.isArray(updates.questUpdates)) {
    newState.quests = [...currentState.quests];
    updates.questUpdates.forEach((quest) => {
      const existingQuestIndex = newState.quests.findIndex(q => q.id === quest.id);
      if (existingQuestIndex !== -1) {
        newState.quests[existingQuestIndex] = {
          ...newState.quests[existingQuestIndex],
          step: quest.step !== undefined ? quest.step : newState.quests[existingQuestIndex].step,
          status: quest.status || newState.quests[existingQuestIndex].status
        };
      } else {
        newState.quests.push({
          id: quest.id,
          name: quest.name,
          step: quest.step || 0,
          status: quest.status || 'active'
        });
      }
    });
  }

  // Apply NPC updates
  if (updates.npcUpdates && Array.isArray(updates.npcUpdates)) {
    newState.npcStates = [...currentState.npcStates];
    updates.npcUpdates.forEach((npc) => {
      const existingNpcIndex = newState.npcStates.findIndex(n => n.name === npc.name);
      if (existingNpcIndex !== -1) {
        newState.npcStates[existingNpcIndex] = {
          ...newState.npcStates[existingNpcIndex],
          affinity: npc.affinity !== undefined ? npc.affinity : newState.npcStates[existingNpcIndex].affinity,
          isAlive: npc.isAlive !== undefined ? npc.isAlive : newState.npcStates[existingNpcIndex].isAlive
        };
      } else {
        newState.npcStates.push({
          name: npc.name,
          affinity: npc.affinity || 0,
          isAlive: npc.isAlive !== undefined ? npc.isAlive : true
        });
      }
    });
  }

  // Apply logs
  if (updates.logs && Array.isArray(updates.logs)) {
    newState.logs = [...(currentState.logs || [])];
    updates.logs.forEach((log) => {
      newState.logs!.push({
        id: log.id || Date.now().toString() + Math.random().toString(),
        timestamp: log.timestamp || Date.now(),
        type: log.type || 'event',
        text: log.text
      });
    });
    newState.logs = newState.logs.slice(-50);
  }

  // Apply game over
  if (updates.isGameOver !== undefined) {
    newState.isGameOver = updates.isGameOver;
  }

  return newState;
};
