import { GameState } from '../types';
import { getEmbedding, cosineSimilarity } from './ai';

const MAX_CONTEXT_LENGTH = 4000;

export async function buildOptimizedContext(
  gameState: GameState,
  action: string,
  systemRules: string
): Promise<string> {
  // 1. System Rules (Must keep)
  let context = systemRules + '\n\n';

  // 2. Player State (Must keep)
  const playerState = `[PLAYER STATE]
HP: ${gameState.stats.hp}/${gameState.stats.maxHp}
Gold: ${gameState.stats.gold}
Level: ${gameState.stats.level}
Skill Points: ${gameState.stats.skillPoints || 0}
Inventory: ${gameState.inventory.join(', ')}
Skills: ${gameState.skills?.map(s => s.name).join(', ') || 'None'}
Quests: ${gameState.quests?.map(q => `${q.name} (${q.status})`).join(', ') || 'None'}
Location: ${gameState.location || 'Unknown'}
`;
  context += playerState + '\n';

  // 3. Summary (Must keep)
  if (gameState.memory?.summary) {
    context += `[STORY SUMMARY]\n${gameState.memory.summary}\n\n`;
  }

  // 4. Dynamic Worldbook & NPCs (Retrieve based on action and recent history)
  const recentText = (gameState.storyText || '') + ' ' + action;
  
  // Vector-based RAG retrieval for worldbook
  let relevantWorldbook = [];
  if (gameState.memory?.worldInfo && gameState.memory.worldInfo.length > 0) {
    try {
      const actionEmbedding = await getEmbedding(action + " " + recentText.slice(-200));
      
      const scoredEntries = gameState.memory.worldInfo.map(entry => {
        const score = entry.embedding ? cosineSimilarity(actionEmbedding, entry.embedding) : 0;
        return { entry, score };
      });
      
      relevantWorldbook = scoredEntries
        .filter(item => item.score >= 0.45)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(item => item.entry);
    } catch (err) {
      console.error("Failed to retrieve embeddings for worldbook:", err);
      // Fallback to keyword matching if embedding fails
      relevantWorldbook = gameState.memory.worldInfo.filter(entry => 
        entry.keywords.some(key => recentText.includes(key))
      ).slice(0, 3);
    }
  }

  if (relevantWorldbook.length > 0) {
    context += `[LORE (Relevant)]\n${relevantWorldbook.map(e => `${e.keywords.join(', ')}: ${e.content}`).join('\n')}\n\n`;
  }

  const relevantNpcs = gameState.npcStates?.filter(npc => 
    recentText.includes(npc.name)
  ) || [];

  if (relevantNpcs.length > 0) {
    context += `[NPCs (Nearby/Relevant)]\n${relevantNpcs.map(n => `${n.name}: Affinity ${n.affinity}, Alive: ${n.isAlive}`).join('\n')}\n\n`;
  }

  // 5. Recent History (Token budget control: max 2000 chars)
  let historyContext = '';
  if (gameState.recentHistory && gameState.recentHistory.length > 0) {
    let currentLength = 0;
    const historyEntries = [];
    for (let i = gameState.recentHistory.length - 1; i >= 0; i--) {
      const entry = gameState.recentHistory[i];
      const entryText = `Action: ${entry.action}\nStory: ${entry.story}`;
      if (currentLength + entryText.length > 2000 && historyEntries.length > 0) {
        break;
      }
      historyEntries.unshift(entryText);
      currentLength += entryText.length;
    }
    historyContext = `[RECENT HISTORY]\n${historyEntries.join('\n\n')}\n\n`;
  }
  context += historyContext;

  return context;
}
