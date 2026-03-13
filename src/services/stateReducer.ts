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
      const existingSkill = newState.skills.find(s => s.name === skill.name);
      if (existingSkill) {
        existingSkill.level = skill.level || existingSkill.level;
        existingSkill.exp = skill.exp || existingSkill.exp;
        existingSkill.maxLevel = skill.maxLevel || existingSkill.maxLevel;
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
      const existingQuest = newState.quests.find(q => q.id === quest.id);
      if (existingQuest) {
        existingQuest.step = quest.step !== undefined ? quest.step : existingQuest.step;
        existingQuest.status = quest.status || existingQuest.status;
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
      const existingNpc = newState.npcStates.find(n => n.name === npc.name);
      if (existingNpc) {
        existingNpc.affinity = npc.affinity !== undefined ? npc.affinity : existingNpc.affinity;
        existingNpc.isAlive = npc.isAlive !== undefined ? npc.isAlive : existingNpc.isAlive;
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
  }

  // Apply game over
  if (updates.isGameOver !== undefined) {
    newState.isGameOver = updates.isGameOver;
  }

  return newState;
};
