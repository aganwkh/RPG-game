import { GameState, CharacterStats, Skill, Quest, NpcState, LogEntry } from '../types';

export const applyStateUpdates = (currentState: GameState, updates: any): GameState => {
  const newState = { ...currentState };
  
  // Clone stats to avoid mutating the original
  newState.stats = { ...currentState.stats };
  if (currentState.stats.attributes) {
    newState.stats.attributes = { ...currentState.stats.attributes };
  }

  // Apply stat deltas
  if (updates.statDeltas && Array.isArray(updates.statDeltas)) {
    updates.statDeltas.forEach((delta: any) => {
      const target = delta.target as keyof CharacterStats;
      const value = Number(delta.value);
      
      if (['hp', 'maxHp', 'gold', 'level', 'exp', 'maxExp', 'skillPoints'].includes(target)) {
        if (delta.operation === 'add') {
          (newState.stats as any)[target] = ((newState.stats as any)[target] || 0) + value;
        } else if (delta.operation === 'subtract') {
          (newState.stats as any)[target] = Math.max(0, ((newState.stats as any)[target] || 0) - value);
        } else if (delta.operation === 'set') {
          (newState.stats as any)[target] = value;
        }
      }
    });
  }

  // Apply inventory deltas
  if (updates.inventoryDeltas && Array.isArray(updates.inventoryDeltas)) {
    newState.inventory = [...currentState.inventory];
    updates.inventoryDeltas.forEach((delta: any) => {
      if (delta.operation === 'add' && delta.item) {
        if (!newState.inventory.includes(delta.item)) {
          newState.inventory.push(delta.item);
        }
      } else if (delta.operation === 'remove' && delta.item) {
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
    updates.newSkills.forEach((skill: any) => {
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
    updates.questUpdates.forEach((quest: any) => {
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
    updates.npcUpdates.forEach((npc: any) => {
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
    updates.logs.forEach((log: any) => {
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
