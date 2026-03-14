import { GoogleGenAI, Type } from '@google/genai';
import { GameState, ChatMessage, CharacterStats, ApiSettings, Skill, MemoryState, Quest, NpcState } from '../types';

const getSettings = (): ApiSettings => {
  try {
    const saved = localStorage.getItem('api_settings');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { provider: 'default' };
};

const getAI = () => {
  // @ts-ignore
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY || (typeof process !== 'undefined' ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : '');
  return new GoogleGenAI({ apiKey: apiKey as string });
};

const parseJSONResponse = (text: string) => {
  try {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      return JSON.parse(match[1]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON:", text);
    throw new Error("API did not return valid JSON");
  }
};

export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const getEmbedding = async (text: string): Promise<number[]> => {
  const settings = getSettings();
  const provider = settings.bgProvider || settings.provider || 'default';
  const baseUrl = settings.bgBaseUrl || settings.baseUrl;
  const apiKey = settings.bgApiKey || settings.apiKey;

  if (provider === 'custom' && baseUrl && apiKey) {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });
    if (!response.ok) throw new Error(`Custom Embedding API Error: ${response.statusText}`);
    const data = await response.json();
    return data.data[0].embedding;
  }

  const ai = getAI();
  const result = await ai.models.embedContent({
    model: 'text-embedding-004',
    contents: text
  });
  return result.embeddings?.[0]?.values || [];
};

export const regenerateSummary = async (
  currentSummary: string,
  recentLogs: string[]
): Promise<string> => {
  const settings = getSettings();
  const systemInstruction = `You are a summarization engine for a text-based RPG.
Your task is to take the current summary and a list of recent events, and combine them into a single, cohesive, and concise long-term summary.
Keep the output strictly in Simplified Chinese.`;

  const prompt = `Current Summary: ${currentSummary || 'None'}
Recent Events:
${recentLogs.join('\n')}

Generate the updated summary.`;

  const provider = settings.bgProvider || settings.provider || 'default';
  const baseUrl = settings.bgBaseUrl || settings.baseUrl;
  const apiKey = settings.bgApiKey || settings.apiKey;
  const model = settings.bgModel || settings.model || 'gpt-3.5-turbo';

  if (provider === 'custom' && baseUrl && apiKey) {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Custom API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
    }
  });

  return response.text?.trim() || currentSummary;
};

export const updateGameMemory = async (
  currentMemory: MemoryState,
  recentHistory: { action: string, story: string }[]
): Promise<MemoryState> => {
  const settings = getSettings();
  const systemInstruction = `You are the background world-building and memory management engine for a text-based RPG.
Your task is to analyze the recent story history and meticulously update the game's memory state.

=== 核心逻辑一：剧情摘要 (Summary) 的判断与更新 ===
1. 评估阈值：判断最新剧情是否发生了以下“里程碑事件”：
   - 跨越区域或进入新场景。
   - 获得关键任务、完成任务或任务失败。
   - 遭遇重要 Boss、角色濒死或触发奇迹。
   - 揭露重大阴谋、重要 NPC 死亡或结盟。
2. 执行更新：
   - 【若是里程碑】：将新事件用极简的“起因+结果”概括，追加到原有的 summary 中。剔除具体的战斗数值或无意义的日常对话。
   - 【若非里程碑】（如普通打怪、赶路、闲聊）：严格原样返回输入的 summary，绝对禁止做任何修改。

=== 核心逻辑二：世界书 (worldInfo) 的自动提取与完善 ===
1. 实体识别：扫描最近的剧情，提取具有独特背景设定的专有名词（必须忽略普通铁剑、回复药水、村民A等通用词汇）。
2. 词条生成与更新模板：如果发现符合条件的实体，提取其 1-3 个触发关键词（keywords），并严格按以下模板撰写内容（content）：
   - 【道具/物品】：功能机制 + 外观描述 + 历史来历或隐藏副作用。（例如：“功能：抵挡致命一击。外观：布满裂纹的黑色护身符。来历：古老祭坛发现的诅咒之物。”）
   - 【角色/NPC】：身份地位 + 核心性格或外貌特征 + 当前对玩家的态度。
   - 【场景/地点】：环境特征 + 已知资源 + 潜在威胁。
   - 【事件/派系】：核心理念/内容 + 对世界观或玩家的潜在影响。
3. 状态覆盖：仔细对比传入的 Relevant Current Lorebook Entries。如果最新剧情改变了这些实体的状态（例如某道具损坏、某 NPC 态度转变），你必须返回修改后的词条。
4. 增量更新：你只需要返回**发生状态改变的旧词条**以及**全新提取的新词条**。**绝对不要**返回没有发生变化的旧词条。

OUTPUT RULES:
- Keep the output concise.
- MUST be strictly in Simplified Chinese.`;

  const historyText = recentHistory.map(h => `Action: ${h.action}\nStory: ${h.story}`).join('\n\n');

  // Retrieve relevant lorebook entries using RAG
  let relevantWorldbook: any[] = [];
  if (currentMemory.worldInfo && currentMemory.worldInfo.length > 0) {
    try {
      const historyEmbedding = await getEmbedding(historyText.slice(-1000));
      const scoredEntries = currentMemory.worldInfo.map(entry => {
        const score = entry.embedding ? cosineSimilarity(historyEmbedding, entry.embedding) : 0;
        return { entry, score };
      });
      relevantWorldbook = scoredEntries
        .filter(item => item.score >= 0.4)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(item => item.entry);
    } catch (err) {
      console.error("Failed to retrieve embeddings for memory update:", err);
      // Fallback to keyword matching
      relevantWorldbook = currentMemory.worldInfo.filter(entry => 
        entry.keywords.some(key => historyText.includes(key))
      ).slice(0, 10);
    }
  }

  const prompt = `Current Summary: ${currentMemory.summary || 'None'}
Relevant Current Lorebook Entries: ${relevantWorldbook.length > 0 ? JSON.stringify(relevantWorldbook.map(e => ({ keywords: e.keywords, content: e.content }))) : 'None'}

Recent 5 Turns History:
${historyText}

Analyze the recent history. 
1. Update the Summary if milestone events occurred.
2. Return the UPDATED Relevant Lorebook Entries (if their state changed) PLUS any completely NEW entries. Do NOT return entries that did not change.`;

  const provider = settings.bgProvider || settings.provider || 'default';
  const baseUrl = settings.bgBaseUrl || settings.baseUrl;
  const apiKey = settings.bgApiKey || settings.apiKey;
  const model = settings.bgModel || settings.model || 'gpt-3.5-turbo';

  let parsedMemory: any;

  if (provider === 'custom' && baseUrl && apiKey) {
    const customSystemInstruction = systemInstruction + `\n\nYou MUST return ONLY a valid JSON object with the exact following structure:
{
  "summary": "string",
  "worldInfo": [
    { "keywords": ["string"], "content": "string" }
  ]
}`;

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: customSystemInstruction },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`Custom API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    parsedMemory = parseJSONResponse(content);
  } else {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'Long-term story summary.' },
            worldInfo: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                  content: { type: Type.STRING }
                },
                required: ['keywords', 'content']
              },
              description: 'Lore and entities.'
            }
          },
          required: ['summary', 'worldInfo']
        }
      }
    });

    parsedMemory = parseJSONResponse(response.text || '{}');
  }
  
  // Merge AI output with existing memory
  const updatedWorldInfo = [...(currentMemory.worldInfo || [])];
  
  if (parsedMemory.worldInfo && Array.isArray(parsedMemory.worldInfo)) {
    for (const newEntry of parsedMemory.worldInfo) {
      if (!newEntry.content || newEntry.content.trim() === '') continue;
      
      // Find if it's an update to an existing entry (check for keyword overlap)
      const existingIndex = updatedWorldInfo.findIndex(existing => 
        existing.keywords.some(k => newEntry.keywords.includes(k))
      );
      
      if (existingIndex >= 0) {
        // Update existing
        updatedWorldInfo[existingIndex] = {
          ...updatedWorldInfo[existingIndex],
          keywords: newEntry.keywords,
          content: newEntry.content,
          embedding: undefined // Clear embedding so it gets regenerated
        };
      } else {
        // Add new
        updatedWorldInfo.push(newEntry);
      }
    }
  }
  
  parsedMemory.worldInfo = updatedWorldInfo;
  
  // Generate embeddings for new or changed worldInfo entries
  if (parsedMemory.worldInfo && Array.isArray(parsedMemory.worldInfo)) {
    parsedMemory.worldInfo = await Promise.all(
      parsedMemory.worldInfo.map(async (entry: any) => {
        if (entry.embedding) return entry; // Already has embedding
        
        try {
          const embedding = await getEmbedding(entry.content);
          return { ...entry, embedding };
        } catch (err) {
          console.error("Failed to generate embedding for memory entry:", err);
          return entry;
        }
      })
    );
  }
  
  return parsedMemory;
};

export const generateStoryStream = async function* (
  gameState: GameState,
  action: string
): AsyncGenerator<string, void, unknown> {
  const settings = getSettings();
  const systemInstruction = `You are an expert text adventure game master.
Advance the story based on the player's action.
Write 3-4 paragraphs of immersive, descriptive text.
Include sensory details, character thoughts, and dynamic action.
Use formatting tags like **bold**, [red], [wave].
Available colors: [red], [blue], [green], [yellow], [purple], [indigo], [orange], [gold], [cyan], [pink], [teal], [lime], [fuchsia], [rose], [sky], [amber], [gray], [white], [black].
Available animations: [wave], [shake], [glitch], [pulse], [bounce], [spin], [float], [flicker], [glow].

CRITICAL: At the very end of your response, you MUST provide 2-4 choices for the player, formatted exactly like this:
CHOICES:
1. [Choice 1]
2. [Choice 2]
3. [Choice 3]

Respond in Simplified Chinese. Do NOT output JSON. Output raw text.`;

  const { buildOptimizedContext } = await import('./contextOptimizer');
  const context = await buildOptimizedContext(gameState, action, systemInstruction);

  if (settings.provider === 'custom' && settings.baseUrl && settings.apiKey) {
    const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: context + `\n\nPlayer Action: ${action}` }
        ],
        stream: true
      })
    });

    if (!response.ok) throw new Error(`Custom API Error: ${response.statusText}`);
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    
    if (reader) {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last line in the buffer if it's not complete
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                yield data.choices[0].delta.content;
              }
            } catch (e) {
              // ignore parse errors for incomplete chunks
            }
          }
        }
      }
    }
    return;
  }

  const ai = getAI();
  const responseStream = await ai.models.generateContentStream({
    model: 'gemini-3.1-pro-preview',
    contents: context + `\n\nPlayer Action: ${action}`,
    config: { systemInstruction }
  });

  for await (const chunk of responseStream) {
    yield chunk.text;
  }
};

export const extractStateUpdates = async (
  gameState: GameState,
  action: string,
  storyText: string
): Promise<any> => {
  const settings = getSettings();
  const prompt = `Based on the latest story event, extract any state changes.
Do NOT calculate absolute values for stats (hp, gold, level, skillPoints). Use deltas (add/subtract/set).
If the player takes damage, subtract HP. If they heal, add HP.
If they gain gold, add gold. If they spend gold, subtract gold.
If they level up, add level.
If they learn a new skill, add it to newSkills.
If they gain or lose an item, add it to inventoryDeltas.

Player Action: ${action}
Story Event: ${storyText}
Current Location: ${gameState.location}

Respond ONLY with a valid JSON object matching this schema:
{
  "statDeltas": [
    { "target": "hp" | "maxHp" | "gold" | "level" | "exp" | "skillPoints", "operation": "add" | "subtract" | "set", "value": number }
  ],
  "inventoryDeltas": [
    { "operation": "add" | "remove", "item": "string" }
  ],
  "newLocation": "string (only if location changed)",
  "newSkills": [ { "name": "string", "level": 1, "exp": 0, "maxLevel": 15 } ],
  "questUpdates": [ { "id": "string", "name": "string", "step": number, "status": "active" | "completed" | "failed" } ],
  "npcUpdates": [ { "name": "string", "affinity": number, "isAlive": boolean } ],
  "logs": [ { "id": "string", "timestamp": number, "type": "event" | "combat" | "item", "text": "string" } ],
  "isGameOver": boolean (true ONLY if the story explicitly states the player died)
}`;

  if (settings.provider === 'custom' && settings.baseUrl && settings.apiKey) {
    const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });
    if (!response.ok) throw new Error(`Custom API Error: ${response.statusText}`);
    const data = await response.json();
    return parseJSONResponse(data.choices[0].message.content);
  }

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          statDeltas: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { target: { type: Type.STRING }, operation: { type: Type.STRING }, value: { type: Type.NUMBER } } } },
          inventoryDeltas: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { operation: { type: Type.STRING }, item: { type: Type.STRING } } } },
          newLocation: { type: Type.STRING },
          newSkills: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, level: { type: Type.NUMBER }, exp: { type: Type.NUMBER }, maxLevel: { type: Type.NUMBER } } } },
          questUpdates: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, step: { type: Type.NUMBER }, status: { type: Type.STRING } } } },
          npcUpdates: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, affinity: { type: Type.NUMBER }, isAlive: { type: Type.BOOLEAN } } } },
          logs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, timestamp: { type: Type.NUMBER }, type: { type: Type.STRING }, text: { type: Type.STRING } } } },
          isGameOver: { type: Type.BOOLEAN }
        }
      }
    }
  });

  return parseJSONResponse(response.text || '{}');
};


export const generateItemDescription = async (itemName: string, context: string): Promise<string> => {
  const settings = getSettings();
  const prompt = `
You are a lore-master in a fantasy text adventure game.
The player has found an item: "${itemName}".
Current context of the game: "${context}"

Write a short, immersive, and flavorful description for this item (max 2 sentences).
Focus on its appearance, potential use, or mysterious aura.
IMPORTANT: The description MUST be written in Simplified Chinese.
  `;

  if (settings.provider === 'custom' && settings.baseUrl && settings.apiKey) {
    try {
      const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0].message.content.trim();
      }
    } catch (e) {
      console.error("Failed to generate item description with custom API", e);
    }
    return "一个神秘的物品，散发着微弱的光芒。";
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
    });
    return response.text?.trim() || "一个神秘的物品，散发着微弱的光芒。";
  } catch (e) {
    console.error("Failed to generate item description", e);
    return "一个神秘的物品，散发着微弱的光芒。";
  }
};

export const generateSkillDescription = async (skillName: string, context: string): Promise<string> => {
  const settings = getSettings();
  const prompt = `
You are a lore-master in a fantasy text adventure game.
The player has learned a skill: "${skillName}".
Current context of the game: "${context}"

Write a short, immersive, and flavorful description for this skill (max 2 sentences).
Focus on its visual effect, combat utility, or magical nature.
IMPORTANT: The description MUST be written in Simplified Chinese.
  `;

  if (settings.provider === 'custom' && settings.baseUrl && settings.apiKey) {
    try {
      const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0].message.content.trim();
      }
    } catch (e) {
      console.error("Failed to generate skill description with custom API", e);
    }
    return "一种强大的能力，蕴含着未知的力量。";
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
    });
    return response.text?.trim() || "一种强大的能力，蕴含着未知的力量。";
  } catch (e) {
    console.error("Failed to generate skill description", e);
    return "一种强大的能力，蕴含着未知的力量。";
  }
};
