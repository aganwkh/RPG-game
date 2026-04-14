import { GoogleGenAI, Type } from '@google/genai';
import { GameState, MemoryState, DirectorState, StateUpdateResult, DIRECTOR_PACINGS, INVENTORY_OPERATIONS, LOG_TYPES, QUEST_STATUSES, STAT_DELTA_TARGETS, STAT_OPERATIONS } from '../types';
import { z } from 'zod';

const getRequiredApiKey = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('Missing Gemini API key. Set VITE_GEMINI_API_KEY in .env.local before starting the app.');
  }

  return apiKey;
};

const getAI = () => {
  return new GoogleGenAI({ apiKey: getRequiredApiKey() });
};

const parseJSONResponseSafe = (text: string) => {
  try {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      return { success: true as const, data: JSON.parse(match[1]) };
    }
    return { success: true as const, data: JSON.parse(text) };
  } catch (e) {
    console.error("Failed to parse JSON:", text);
    return { success: false as const, error: new Error("API did not return valid JSON") };
  }
};

const parseResponseWithSchema = <T>(text: string, schema: z.ZodType<T>, context: string) => {
  const jsonResult = parseJSONResponseSafe(text);
  if (!jsonResult.success) {
    console.error(`Failed to parse ${context}:`, jsonResult.error);
    return jsonResult;
  }

  const schemaResult = schema.safeParse(jsonResult.data);
  if (!schemaResult.success) {
    console.error(`Failed to validate ${context}:`, schemaResult.error);
    return { success: false as const, error: schemaResult.error };
  }

  return { success: true as const, data: schemaResult.data };
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
  const systemInstruction = `你是一个文字冒险游戏的总结引擎。
你的任务是将当前的总结和最近的事件列表结合起来，生成一个连贯、简洁的长期故事总结。
请严格使用简体中文输出。`;

  const prompt = `当前总结: ${currentSummary || '无'}
最近事件:
${recentLogs.join('\n')}

请生成更新后的总结。`;

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

const MemoryUpdateSchema = z.object({
  summary: z.string().optional(),
  worldInfo: z.array(z.object({
    keywords: z.array(z.string()),
    content: z.string()
  })).optional()
});

const DirectorUpdateSchema = z.object({
  currentArc: z.string(),
  globalPacing: z.enum(DIRECTOR_PACINGS),
  upcomingEvents: z.array(z.string()),
  tension: z.number().min(0).max(100),
  itemPlotHooks: z.record(z.string(), z.string()).optional()
});

const RawDirectorUpdateSchema = z.object({
  currentArc: z.string(),
  globalPacing: z.enum(DIRECTOR_PACINGS),
  upcomingEvents: z.array(z.string()),
  tension: z.number().min(0).max(100),
  itemPlotHooks: z.union([
    z.record(z.string(), z.string()),
    z.array(z.object({
      itemName: z.string(),
      hook: z.string()
    }))
  ]).optional()
});

export const updateDirectorState = async (
  gameState: GameState,
  recentHistory: { action: string, story: string }[]
): Promise<DirectorState> => {
  const systemInstruction = `你是一个文字冒险游戏的“大导演 (Narrative Director)”。
你的核心任务是：把控宏观叙事节奏、管理故事弧线、调节玩家情绪（紧张度），并为底层剧情生成器提供精准的“剧本大纲”和“事件预告”。

=== 导演核心法则 (Director's Core Heuristics) ===

1. 故事弧线 (Current Arc) 管理：
   - 弧线应该是一个有明确目标的阶段性主题（如：“暗影森林的试炼”、“寻找失踪的王女”、“酒馆的悠闲时光”）。
   - 结合玩家当前的【任务(Quests)】和【全局总结(Summary)】，判断当前目标是否已经达成。如果达成，请顺滑地开启下一个弧线。

2. 全局节奏 (Global Pacing) 控制：
   - 'slow' (慢节奏)：适用于玩家初到新地点（需要世界观铺陈）、进行深度对话、解谜、或大战后的休整。此时底层AI会增加细节描写。
   - 'normal' (正常)：标准的探索、战斗交替。
   - 'fast' (快节奏)：适用于长途旅行赶路、重复性劳动、逃亡、或剧情陷入泥潭需要快速略过无聊过程直奔主题时。

3. 紧张度 (Tension) 曲线 (0-100)：
   - 遵循戏剧理论：紧张度应该像波浪一样起伏。
   - 铺垫期 (20-40)：探索未知，发现线索。
   - 冲突期 (50-70)：遭遇敌人，陷入困境。
   - 高潮期 (80-100)：生死决战，核心危机爆发。
   - 释放期 (0-20)：危机解除，获得奖励，休养生息。绝不能让紧张度一直保持在100，高潮后必须释放。

4. 即将发生的事件 (Upcoming Events) 设计：
   - 不要写空泛的事件（如“遇到怪物”），要具体且与当前弧线、地点相关（如“被追踪已久的暗影刺客在巷角伏击”）。
   - 包含 1-3 个事件。可以是：环境突变、NPC介入、剧情反转、发现关键道具。
   - 这些事件是给底层AI的“伏笔”提示，AI会在合适的时机触发它们。

5. 契诃夫之枪：物品宿命 (Item Plot Hooks) 管理：
   - 检查玩家背包中的物品。如果发现有“神秘的”、“未知的”或“具有潜力的”关键剧情物品（排除普通消耗品如药水、铁剑），你需要为它赋予一个【隐藏的宿命/伏笔 (plotHook)】。
   - 例如：玩家获得“黯淡的碎片”，你可以为其赋予 plotHook：“当靠近深渊之门时会发热并指引方向”。
   - 在规划 Upcoming Events 时，请尽量创造条件去触发这些已有 plotHook 的物品，让剧情形成闭环。

=== 输出规则 ===
- 保持输出简洁。
- 必须严格使用简体中文。`;

  const historyText = recentHistory.map(h => `玩家行动: ${h.action}\n故事: ${h.story}`).join('\n\n');
  const summary = gameState.memory?.summary || '故事刚刚开始。';
  const location = gameState.location || '未知';
  const quests = gameState.quests?.map(q => `${q.name} (${q.status})`).join(', ') || '无';
  const inventory = gameState.inventory?.join(', ') || '空';
  const currentPlotHooks = gameState.director?.itemPlotHooks ? JSON.stringify(gameState.director.itemPlotHooks) : '{}';

  const prompt = `【当前游戏宏观状态】
当前位置: ${location}
当前任务: ${quests}
全局故事总结:
${summary}

【当前导演状态】
当前弧线: ${gameState.director?.currentArc || '无'}
当前节奏: ${gameState.director?.globalPacing || 'normal'}
当前紧张度: ${gameState.director?.tension || 10}
之前计划的事件: ${gameState.director?.upcomingEvents?.join(', ') || '无'}

【玩家背包与物品宿命】
当前背包: ${inventory}
已有的物品宿命 (Plot Hooks): ${currentPlotHooks}

【最近的玩家行动与剧情】
${historyText}

请作为大导演，深度分析上述信息：
1. 玩家的行动是否推动了主线？结合任务和总结，是否需要开启新弧线？
2. 当前的叙事节奏是否合适？
3. 紧张度是否需要调整？
4. 接下来该安排什么具体的戏剧性事件来吸引玩家？（尝试结合背包中带有 plotHook 的物品）
5. 检查背包中的物品，是否有需要新增或更新 plotHook 的关键物品？（保留已有的，添加新的，剔除已经不在背包里的）

请返回更新后的导演状态 JSON。`;

  let parsedDirector: DirectorState = gameState.director || { currentArc: '序章', globalPacing: 'normal', upcomingEvents: [], tension: 10, itemPlotHooks: {} };

  try {
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
            currentArc: { type: Type.STRING, description: 'Current story arc name.' },
            globalPacing: { type: Type.STRING, description: 'Pacing: slow, normal, or fast.' },
            upcomingEvents: { type: Type.ARRAY, items: { type: Type.STRING }, description: '1-3 upcoming events.' },
            tension: { type: Type.NUMBER, description: 'Tension level from 0 to 100.' },
            itemPlotHooks: {
              type: Type.ARRAY,
              description: 'List of item names and their hidden plot hooks/destinies.',
              items: {
                type: Type.OBJECT,
                properties: {
                  itemName: { type: Type.STRING },
                  hook: { type: Type.STRING }
                },
                required: ['itemName', 'hook']
              }
            }
          },
          required: ['currentArc', 'globalPacing', 'upcomingEvents', 'tension', 'itemPlotHooks']
        }
      }
    });

    const parsedResult = parseResponseWithSchema(response.text || '{}', RawDirectorUpdateSchema, 'director update');
    if (!parsedResult.success) {
      return parsedDirector;
    }

    const normalizedDirector: DirectorState | (z.infer<typeof RawDirectorUpdateSchema> & { itemPlotHooks?: Record<string, string> }) = {
      ...parsedResult.data
    };

    if (Array.isArray(normalizedDirector.itemPlotHooks)) {
      const hooksMap: Record<string, string> = {};
      for (const hook of normalizedDirector.itemPlotHooks) {
        if (hook.itemName && hook.hook) {
          hooksMap[hook.itemName] = hook.hook;
        }
      }
      normalizedDirector.itemPlotHooks = hooksMap;
    }

    if (!normalizedDirector.itemPlotHooks) {
      normalizedDirector.itemPlotHooks = gameState.director?.itemPlotHooks || {};
    }

    const directorResult = DirectorUpdateSchema.safeParse(normalizedDirector);
    if (!directorResult.success) {
      console.error("Failed to validate normalized director update:", directorResult.error);
      return parsedDirector;
    }

    parsedDirector = directorResult.data;
  } catch (err) {
    console.error("Failed to update director state:", err);
  }
  
  return parsedDirector;
};

export const updateGameMemory = async (
  currentMemory: MemoryState,
  recentHistory: { action: string, story: string }[]
): Promise<MemoryState> => {
  const systemInstruction = `你是一个文字冒险游戏的“世界观架构师 (Worldbuilder)”与“记忆管理员”。
你的核心任务是：从玩家最近的经历中，精准提取【值得被永久铭记的世界设定】，并更新【主线剧情摘要】。

=== 核心逻辑一：世界书 (Worldbook/Lorebook) 的严苛准入法则 ===
世界书是游戏的“设定集”，它的容量极其宝贵。你必须像一个严苛的编辑，决定什么该写，什么绝对不该写。

【绝对禁止写入世界书的内容】 (DO NOT INCLUDE):
1. 一次性消耗品或普通装备（如：铁剑、回复药水、普通的金币、随处可见的草药）。
2. 龙套角色与随机遇敌（如：无名酒馆老板、路人村民A、被秒杀的野生哥布林、普通的强盗）。
3. 玩家的短暂行为或流水账（如：“玩家走进了房间”、“玩家吃了一顿饭”、“玩家挥舞了剑”——这些属于剧情摘要，绝不是世界设定）。
4. 临时状态或天气（如：“今天下大雨”、“哥布林正在睡觉”、“门被锁上了”）。
5. 具体的战斗数值或游戏机制（如：“造成了50点伤害”）。

【必须写入世界书的内容】 (必须包含):
1. 核心/宿命级 NPC：有名字、有独特背景、且未来极大概率再次互动的角色（如：发布主线任务的导师、宿敌、掌握关键情报的神秘人、阵营领袖）。
2. 传奇/剧情道具：带有深厚历史背景、独特魔法机制、或推动主线发展的唯一性物品（如：封印魔王的“星辰护符”、能听懂人话的“诅咒魔剑”、失落的王国地图）。
3. 关键地标与区域：有独特生态、阵营势力或隐藏规则的地点（如：“暗影兄弟会”的地下集会所、终年被毒雾笼罩的“叹息沼泽”、遗忘之城）。
4. 世界法则与派系：新揭露的魔法规则、历史神话、或活跃的组织势力（如：血魔法的代价、星辰教团的教义）。

【词条撰写规范】：
- 提取 1-3 个最精准的触发关键词（keywords）。
- 内容 (content) 必须是客观、凝练的“设定描述”，而不是讲故事。
  - 人物：身份 + 核心动机/性格 + 目前与玩家的关系。
  - 物品：外观 + 独特机制/副作用 + 历史渊源。
  - 地点：环境特征 + 统治势力/危险程度。

=== 核心逻辑二：世界书的动态更新 (State Update) ===
仔细对比传入的【相关的已有世界书词条 (Relevant Current Lorebook Entries)】。
如果最新剧情导致某个人物死亡、某件神器破碎、或某个地点的统治者更替，你必须返回修改后的词条。
【增量更新原则】：你只需要返回**发生状态改变的旧词条**以及**全新提取的新词条**。**绝对不要**返回没有发生变化的旧词条。

=== 核心逻辑三：剧情摘要 (Summary) 的判断与更新 ===
1. 评估阈值：判断最新剧情是否发生了“里程碑事件”（如：跨越区域、完成/获得关键任务、遭遇Boss、揭露重大阴谋、结盟或背叛）。
2. 执行更新：
   - 【若是里程碑】：将新事件用极简的“起因+结果”概括，追加到原有的 summary 中。
   - 【若非里程碑】（如普通打怪、赶路、闲聊）：严格原样返回输入的 summary，绝对禁止做任何修改。

=== 输出规则 ===
- 保持输出简洁。
- 必须严格使用简体中文。`;

  const historyText = recentHistory.map(h => `玩家行动: ${h.action}\n故事: ${h.story}`).join('\n\n');

  // Retrieve relevant lorebook entries using RAG
  let relevantWorldbook: MemoryState['worldInfo'] = [];
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
      // Fallback to keyword matching (case-insensitive)
      const lowerHistory = historyText.toLowerCase();
      relevantWorldbook = currentMemory.worldInfo.filter(entry => 
        entry.keywords.some(key => lowerHistory.includes(key.toLowerCase()))
      ).slice(0, 10);
    }
  }

  const prompt = `【当前剧情摘要】:
${currentMemory.summary || '无'}

【相关的已有世界书词条】:
${relevantWorldbook.length > 0 ? JSON.stringify(relevantWorldbook.map(e => ({ keywords: e.keywords, content: e.content }))) : '无'}

【最近 5 回合的剧情记录】:
${historyText}

请作为世界观架构师，深度分析上述剧情：
1. 剧情摘要 (Summary)：是否发生了里程碑事件？如果是，请追加更新；如果不是，请原样返回。
2. 世界书 (Worldbook)：
   - 严格按照【准入法则】过滤，提取全新的重要设定（传奇物品、关键NPC、重要地点等）。
   - 检查【相关的已有世界书词条】，如果它们的状态在最新剧情中发生了重大改变（如NPC死亡、地点被毁），请更新它们。
   - 仅返回新增和被修改的词条。未发生改变的词条请勿返回。

请返回 JSON 格式的更新结果。`;

  let parsedMemory: Partial<MemoryState> & Record<string, unknown> = { summary: currentMemory.summary, worldInfo: [] };

  try {
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

    const parsedResult = parseResponseWithSchema(response.text || '{}', MemoryUpdateSchema, 'memory update');
    if (!parsedResult.success) {
      parsedMemory = { summary: currentMemory.summary, worldInfo: [] };
    } else {
      parsedMemory = parsedResult.data;
    }
  } catch (err) {
    console.error("Failed to update memory:", err);
    parsedMemory = { summary: currentMemory.summary, worldInfo: [] };
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
      parsedMemory.worldInfo.map(async (entry: { keywords: string[], content: string, embedding?: number[] }) => {
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
  
  return parsedMemory as MemoryState;
};

export const generateStoryStream = async function* (
  gameState: GameState,
  action: string
): AsyncGenerator<string, void, unknown> {
  const systemInstruction = `你是一位专业的文字冒险游戏大师（Game Master）。
请根据玩家的行动推进故事。
编写 3-4 段沉浸式、富有描述性的文本。
包含感官细节、角色想法和动态动作。
频繁使用格式化标签来突出关键元素、情感和动作。
可用颜色：[red], [blue], [green], [yellow], [purple], [indigo], [orange], [gold], [cyan], [pink], [teal], [lime], [fuchsia], [rose], [sky], [amber], [gray], [white], [black]。
可用动画：[wave], [shake], [glitch], [pulse], [bounce], [spin], [float], [flicker], [glow]。
示例：[red]鲜血[/red]四溅，大地开始[shake]剧烈震动[/shake]！
你也可以使用中文翻译的标签，如 [红色], [震动], 【蓝色】, 【发光】。

=== 游戏节奏与配速控制 (PACING RULES) ===
1. 动态时间流逝：不要拘泥于微观动作。如果玩家决定“前往某个遥远的城市”、“清理营地里的地精”或“寻找三株草药”，你应该在一段文本内使用蒙太奇手法（Montage）快进这段过程，直接描述他们到达目的地或完成任务后的结果。
2. 避免拖沓：绝对禁止让玩家进行无意义的“走路模拟”。如果旅途没有重大突发剧情，请直接推进到下一个有意义的决策点。
3. 选项收束：你提供的 CHOICES 必须推动剧情发展，避免出现“继续走”、“看看四周”这种原地踏步的废话选项。

关键要求: 在回复的最后，你必须为玩家提供 2-4 个选项，格式必须完全如下：
选项:
1. [选项 1]
2. [选项 2]
3. [选项 3]

请使用简体中文回复。不要输出 JSON。输出纯文本。`;

  const { buildOptimizedContext } = await import('./contextOptimizer');
  const context = await buildOptimizedContext(gameState, action, systemInstruction);

  const ai = getAI();
  const responseStream = await ai.models.generateContentStream({
    model: 'gemini-3.1-pro-preview',
    contents: context + `\n\n玩家行动: ${action}`,
    config: { systemInstruction }
  });

  for await (const chunk of responseStream) {
    yield chunk.text;
  }
};

const StateDeltaSchema = z.object({
  statDeltas: z.array(z.object({
    target: z.enum(STAT_DELTA_TARGETS),
    operation: z.enum(STAT_OPERATIONS),
    value: z.number()
  })).optional(),
  inventoryDeltas: z.array(z.object({
    operation: z.enum(INVENTORY_OPERATIONS),
    item: z.string()
  })).optional(),
  newLocation: z.string().optional(),
  newSkills: z.array(z.object({
    name: z.string(),
    level: z.number().optional(),
    exp: z.number().optional(),
    maxLevel: z.number().optional()
  })).optional(),
  questUpdates: z.array(z.object({
    id: z.string(),
    name: z.string(),
    step: z.number(),
    status: z.enum(QUEST_STATUSES)
  })).optional(),
  npcUpdates: z.array(z.object({
    name: z.string(),
    affinity: z.number(),
    isAlive: z.boolean()
  })).optional(),
  logs: z.array(z.object({
    id: z.string(),
    timestamp: z.number(),
    type: z.enum(LOG_TYPES),
    text: z.string()
  })).optional(),
  isGameOver: z.boolean().optional()
});

export const extractStateUpdates = async (
  gameState: GameState,
  action: string,
  storyText: string
): Promise<StateUpdateResult> => {
  const prompt = `请根据最新的故事事件，使用增量（add/subtract/set）提取任何状态变化。

=== 动态奖励缩放规则 ===
请务必根据刚才发生的事件规模，动态决定经验值（exp）和金币（gold）的发放量：
- 【微小动作】（如：闲聊、观察、赶路）：0-5 exp, 0 gold。
- 【常规动作】（如：战胜普通怪物、发现小宝箱、解开小谜题）：20-50 exp, 10-50 gold。
- 【重大成就】（如：经历长途旅行到达新城镇、击败精英怪/Boss、完成任务关键步骤）：100-300 exp, 100-500 gold。

=== 任务进度跃进 ===
如果剧情显示玩家跨越了时间或空间（例如直接到达了目的地，或一波清除了敌人），请直接在 questUpdates 中将该任务状态设置为 "completed"，或将 step 直接增加对应的跨度，不要每次只 +1。

=== 时间流逝 ===
如果剧情中发生了时间流逝（例如：睡了一觉、长途跋涉、度过了一段时间），请在 statDeltas 中添加一个目标为 "daysPassed" 的 "add" 操作，值为经过的天数（至少为 1）。

=== 状态字段边界 ===
maxExp 由游戏升级系统内部维护，不要在 statDeltas 中返回或修改 maxExp。

玩家行动: ${action}
故事事件: ${storyText}
当前位置: ${gameState.location}

请仅返回符合以下模式的有效 JSON 对象：
{
  "statDeltas": [
    { "target": "hp" | "maxHp" | "gold" | "level" | "exp" | "skillPoints" | "daysPassed" | "strength" | "agility" | "intelligence" | "charisma" | "luck", "operation": "add" | "subtract" | "set", "value": number }
  ],
  "inventoryDeltas": [
    { "operation": "add" | "remove", "item": "string" }
  ],
  "newLocation": "string (仅当位置改变时)",
  "newSkills": [ { "name": "string", "level": 1, "exp": 0, "maxLevel": 15 } ],
  "questUpdates": [ { "id": "string", "name": "string", "step": number, "status": "active" | "completed" | "failed" } ],
  "npcUpdates": [ { "name": "string", "affinity": number, "isAlive": boolean } ],
  "logs": [ { "id": "string", "timestamp": number, "type": "event" | "combat" | "item", "text": "string" } ],
  "isGameOver": boolean (仅当故事明确说明玩家死亡时为 true)
}`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            statDeltas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  target: { type: Type.STRING, enum: [...STAT_DELTA_TARGETS] },
                  operation: { type: Type.STRING, enum: [...STAT_OPERATIONS] },
                  value: { type: Type.NUMBER }
                },
                required: ['target', 'operation', 'value']
              }
            },
            inventoryDeltas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  operation: { type: Type.STRING, enum: [...INVENTORY_OPERATIONS] },
                  item: { type: Type.STRING }
                },
                required: ['operation', 'item']
              }
            },
            newLocation: { type: Type.STRING },
            newSkills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  level: { type: Type.NUMBER },
                  exp: { type: Type.NUMBER },
                  maxLevel: { type: Type.NUMBER }
                },
                required: ['name']
              }
            },
            questUpdates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  step: { type: Type.NUMBER },
                  status: { type: Type.STRING, enum: [...QUEST_STATUSES] }
                },
                required: ['id', 'name', 'step', 'status']
              }
            },
            npcUpdates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  affinity: { type: Type.NUMBER },
                  isAlive: { type: Type.BOOLEAN }
                },
                required: ['name', 'affinity', 'isAlive']
              }
            },
            logs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  timestamp: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: [...LOG_TYPES] },
                  text: { type: Type.STRING }
                },
                required: ['id', 'timestamp', 'type', 'text']
              }
            },
            isGameOver: { type: Type.BOOLEAN }
          }
        }
      }
    });

    const parsedResult = parseResponseWithSchema(response.text || '{}', StateDeltaSchema, 'state updates');
    if (!parsedResult.success) {
      return {};
    }

    return parsedResult.data;
  } catch (error) {
    console.error("Failed to extract state updates:", error);
    // Return empty state updates if validation fails to prevent crash
    return {};
  }
};


export const generateItemDescription = async (itemName: string, context: string, plotHook?: string): Promise<string> => {
  const plotHookInstruction = plotHook 
    ? `\n【契诃夫之枪：隐藏宿命】\n这个物品在未来的剧情中有一个隐藏的宿命/伏笔："${plotHook}"。\n请在描述中**隐晦地暗示**这个宿命（例如通过它散发的气息、特殊的纹理、或某种共鸣），但不要直接剧透。` 
    : '';

  const prompt = `
你是一个奇幻文字冒险游戏的“物品鉴定师 (Lore-master)”。
玩家获得了一个物品："${itemName}"。
当前游戏背景/任务："${context}"${plotHookInstruction}

请为这个物品写一段简短、沉浸且充满风味的描述（最多2句话）。
重点描述它的外观、潜在用途、或神秘的氛围。
注意：描述必须使用简体中文编写。
  `;

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
  const prompt = `
你是一个奇幻文字冒险游戏的“技能导师”。
玩家学习了一个技能："${skillName}"。
当前游戏背景/任务："${context}"

请为这个技能写一段简短、沉浸且充满风味的描述（最多2句话）。
重点描述它的视觉效果、战斗效用或魔法本质。
注意：描述必须使用简体中文编写。
  `;

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
