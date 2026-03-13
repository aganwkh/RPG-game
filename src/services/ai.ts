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
  latestAction: string,
  latestStory: string
): Promise<MemoryState> => {
  const settings = getSettings();
  const systemInstruction = `You are the background world-building and memory management engine for a text-based RPG.
Your task is to analyze the latest story turn and meticulously update the game's memory state.

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
1. 实体识别：扫描最新剧情，提取具有独特背景设定的专有名词（必须忽略普通铁剑、回复药水、村民A等通用词汇）。
2. 词条生成与更新模板：如果发现符合条件的实体，提取其 1-3 个触发关键词（keywords），并严格按以下模板撰写内容（content）：
   - 【道具/物品】：功能机制 + 外观描述 + 历史来历或隐藏副作用。（例如：“功能：抵挡致命一击。外观：布满裂纹的黑色护身符。来历：古老祭坛发现的诅咒之物。”）
   - 【角色/NPC】：身份地位 + 核心性格或外貌特征 + 当前对玩家的态度。
   - 【场景/地点】：环境特征 + 已知资源 + 潜在威胁。
   - 【事件/派系】：核心理念/内容 + 对世界观或玩家的潜在影响。
3. 状态覆盖：仔细对比传入的 Current Lorebook。如果最新剧情改变了已存在于 worldInfo 中的实体状态（例如某道具损坏、某 NPC 态度转变），你必须直接修改对应词条的 content，而不是新建词条。

OUTPUT RULES:
- Keep the output concise.
- MUST be strictly in Simplified Chinese.`;

  const prompt = `Current Summary: ${currentMemory.summary || 'None'}
Current Lorebook: ${currentMemory.worldInfo && currentMemory.worldInfo.length > 0 ? JSON.stringify(currentMemory.worldInfo) : 'None'}

Latest Action: ${latestAction}
Latest Story: ${latestStory}

Analyze the latest turn and return the updated MemoryState.`;

  const provider = settings.bgProvider || settings.provider || 'default';
  const baseUrl = settings.bgBaseUrl || settings.baseUrl;
  const apiKey = settings.bgApiKey || settings.apiKey;
  const model = settings.bgModel || settings.model || 'gpt-3.5-turbo';

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
    return parseJSONResponse(content);
  }

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

  return parseJSONResponse(response.text || '{}');
};

export const generateStoryTurn = async (
  context: string,
  action: string,
  inventory: string[],
  skills: Skill[],
  quests: Quest[],
  npcStates: NpcState[],
  stats: CharacterStats,
  currentLocation: string = '未知地点',
  memory: MemoryState = { summary: '', worldInfo: [] }
): Promise<GameState> => {
  const settings = getSettings();
  const systemInstruction = `You are an infinite choose-your-own-adventure game engine.
The user is playing a text-based adventure.
Continue the story based on the user's action. 

STORY LENGTH & DETAIL (CRITICAL):
- You MUST write rich, immersive, and detailed narratives.
- Each turn's \`storyText\` MUST be at least 3 to 4 substantial paragraphs long (around 300-500 words).
- Do NOT output brief or rushed summaries. Players want to read a novel-like experience.
- Describe the environment, sensory details (sights, sounds, smells), the character's internal thoughts, and the exact flow of actions in vivid detail.
- Expand on dialogues, combat maneuvers, and atmospheric tension.

Update the inventory, skills, quests, npcStates, location, and stats (hp, maxHp, gold, level, exp, maxExp, skillPoints, attributes) if the story dictates it (e.g., taking damage, finding gold, leveling up, moving to a new area, learning a new skill).

ACTION VALIDATION (CRITICAL - ANTI-CHEAT):
- When the player submits an action that does not match their current level, attributes, or attempts to forcefully break physical/game laws (e.g., "I instantly kill the demon king and get the artifact" at level 1), you MUST judge their action as a FAILED attempt.
- Describe the painful consequences of this failed action in the storyText (e.g., taking severe damage from backlash, being mocked, or triggering a trap).
- NEVER directly agree to or validate the player's overpowered/cheating inputs.

GAME OVER HANDLING (CRITICAL):
- If stats.hp <= 0 and a miracle does NOT occur, you MUST set the \`isGameOver\` boolean to true.
- Generate a final death ending in the \`storyText\`.
- Set the \`choices\` array to be completely empty [].

NPC & FACTION STATE:
- You must track and update the \`npcStates\` array (e.g., \`[{"name": "NPC Name", "affinity": 50, "isAlive": true}]\`).
- Real-time update their affinity based on the player's dialogue and actions.
- Use this affinity to determine merchant prices, NPC assistance, or hostile behavior.

STRUCTURED QUEST TRACKER:
- Manage quests using the \`quests\` array: \`[{id: string, name: string, step: number, status: 'active' | 'completed' | 'failed'}]\`.
- When detecting specific plot nodes or progress, update the \`step\` or \`status\` of the relevant quest.
- You can add new quests to the array when the player accepts them.

PLAYER LEVEL & EXP SYSTEM (CRITICAL):
- The player gains EXP by defeating enemies, completing quests, or making significant discoveries.
- The EXP required for the next level grows exponentially (e.g., Lv1->Lv2 needs 100 EXP, Lv2->Lv3 needs 300 EXP, Lv3->Lv4 needs 600 EXP, etc.).
- If the player's \`exp\` exceeds \`maxExp\`, increment their \`level\` by 1, subtract \`maxExp\` from \`exp\`, and increase \`maxExp\` for the next level (e.g., multiply by 1.5 or 2).
- When the player levels up, you MUST increment their \`skillPoints\` by 1, and fully restore their \`hp\` to \`maxHp\`. You can also slightly increase \`maxHp\`.

SKILL SYSTEM RULES (CRITICAL):
- Skills are objects with \`name\`, \`level\`, \`exp\`, and \`maxLevel\`.
- Normal skills have a \`maxLevel\` of 15. Extremely powerful/overpowered skills have a \`maxLevel\` of 8.
- If the user uses a skill, or defeats an enemy using a skill, you MUST increase that skill's \`exp\`. The amount of EXP gained depends on the difficulty of the action or the strength of the monster defeated.
- The EXP required for the next level grows exponentially (e.g., Lv1->Lv2 needs 100 EXP, Lv2->Lv3 needs 300 EXP, Lv3->Lv4 needs 700 EXP, Lv4->Lv5 needs 1500 EXP, etc.). The gap between levels is HUGE, meaning it takes a very long time to level up a skill.
- If a skill's \`exp\` exceeds the requirement for the next level, increment its \`level\` and keep the remaining \`exp\`. Do not exceed \`maxLevel\`.
- CRITICAL RULE FOR LEARNING NEW SKILLS: The player CANNOT simply invent or learn new skills out of thin air, even if they have skillPoints.
- New skills can ONLY be learned through specific, rare encounters: finding an ancient scroll, discovering a grimoire, or being taught by a master.
- The probability of encountering these skill-learning opportunities should be VERY LOW to prevent the player from becoming overpowered too quickly.
- When they do encounter such an opportunity and choose to learn the skill, add it to the \`skills\` array with \`level\` 1, \`exp\` 0, and appropriate \`maxLevel\`, and you MUST decrement their \`skillPoints\` by 1.

CRITICAL RULE FOR ATTRIBUTES: DO NOT automatically increase attributes on level up. Attributes are core mechanics and MUST NOT grow casually. 
An attribute can ONLY increase by 1 point under strict conditions:
1. The user explicitly undergoes intense, dedicated training.
2. The user consumes a very rare magical artifact.
3. The user achieves a monumental milestone or survives a deadly ordeal related to that attribute.
If an attribute does increase, you MUST make it a significant narrative event and explicitly mention it in the storyText (e.g., "经过地狱般的锻炼，你的力量提升了！").
Occasionally (e.g., after a major boss fight or finding a hidden sanctuary), you can provide a special choice for the user to train or meditate to increase a specific attribute.
Provide 3-4 choices for the user's next action. 
- At least ONE choice MUST be a standard action.
- If the user is in combat or a challenging situation, include choices that utilize their Current Skills.
- You MUST frequently include choices that test the user's Attributes (Strength, Agility, Intelligence, Charisma, Luck). Format these choices clearly, e.g., "[力量检定] 强行推开巨石", "[敏捷检定] 尝试躲避陷阱", "[智力检定] 解读古老的符文", "[魅力检定] 说服守卫放行", "[幸运检定] 闭着眼睛随便选一条路". 
- CRITICAL: 当故事文本中出现需要属性检定的选项时，在选项旁添加相应的属性提示（例如：“[力量检定]”）。
- When the user selects an attribute check choice, you MUST determine the success or failure based on their current attribute value (10 is average, >15 is good, >20 is excellent) and describe the outcome vividly in the next turn's storyText.
- If they have skillPoints > 0 AND they are currently interacting with a rare skill source (e.g., a master, a scroll, a grimoire), you can provide a choice to learn a new skill. Do NOT provide this choice randomly.

TEXT FORMATTING & ANIMATIONS (CRITICAL):
To make the story more immersive, you MUST FREQUENTLY use the following formatting tags in your storyText. Do NOT output plain text for important events.
- Use **bold** for ALL important items, character names, or strong emphasis.
- Use color tags for ALL elemental effects, damage, or specific moods. Available colors: [red], [blue], [green], [yellow], [purple], [indigo], [orange], [gold], [cyan], [pink], [teal], [lime], [fuchsia], [rose], [sky], [amber], [gray], [white], [black].
- Use animation tags for ALL dynamic effects, injuries, or magical occurrences. Available animations: [wave], [shake], [glitch], [pulse], [bounce], [spin], [float], [flicker], [glow].
  - Example: The dragon breathes a torrent of [wave][orange]scorching fire[/orange][/wave].
  - Example: You take [shake][red]15 damage[/red][/shake].
  - Example: A [glitch]mysterious voice[/glitch] echoes in your mind.
  - Example: The artifact begins to [pulse][blue]glow softly[/blue][/pulse].
  - Example: You found [gold]100枚金币[/gold]!
  - Example: A [float][cyan]ghostly figure[/cyan][/float] appears.
  - Example: The torch [flicker][orange]sputters in the wind[/orange][/flicker].
You MUST combine colors and animations for maximum impact (e.g., [shake][red]...[/red][/shake]).

ENEMY AI & COMBAT MECHANICS:
If the user is in combat or encounters an enemy, you MUST simulate the enemy's AI behavior in the storyText and choices:
1. Attack Patterns: Enemies should have distinct attack patterns (e.g., a goblin might try to steal gold and run, a heavy knight might charge up a devastating strike for one turn before releasing it).
2. Telegraphing: Describe the enemy's stance or preparation in the storyText so the player can anticipate the next move.
3. Escape Logic: If an enemy is severely wounded or outmatched, it might attempt to flee, surrender, or call for reinforcements.
4. Dynamic Choices: Provide combat choices that react to the enemy's telegraphed moves (e.g., "Dodge the incoming fireball", "Block the heavy strike", "Chase the fleeing thief").
5. Combat Logs: If any combat action occurs (attack, defense, dodge, damage taken, hit/miss), you MUST provide detailed logs in the \`combatLogs\` array. For example: "你挥剑砍向哥布林，造成了 15 点伤害！", "哥布林的匕首刺偏了，你成功闪避！", "你举起盾牌格挡，受到了 5 点伤害。". If no combat occurred, return an empty array.

MIRACLE MECHANIC (EXTREMELY RARE):
If the player is in a highly challenging event or combat, has been stuck in this situation for a long time, has very low HP (e.g., below 20%), and is on the verge of death, there is a VERY LOW probability (around 5%) that a "miracle" occurs to help them survive.
1. The miracle MUST NOT be absurd. It must have a reasonable and logical explanation based on the story context.
2. Examples of reasonable miracles:
   - A sudden breakthrough in a skill or attribute due to extreme pressure (e.g., leveling up, attribute burst).
   - An unexpected ally arriving, but only if it makes sense in the current location.
   - Finding a hidden flaw in the enemy's defense.
   - A previously acquired item suddenly reacting to the danger.
3. Do NOT overuse this. It should feel like a desperate, last-second salvation, not a common occurrence. If a miracle happens, describe it dramatically and adjust the stats/story accordingly to let the player survive this turn.

IMPORTANT: The storyText, choices, inventory, skills, quests, location, and combatLogs MUST be written in Simplified Chinese.`;

  // Extract active lorebook entries
  const activeLore = (memory.worldInfo || []).filter(entry => {
    // Handle both old format (keyword) and new format (keywords)
    const keywords: string[] = entry.keywords ? entry.keywords : ((entry as any).keyword ? [(entry as any).keyword] : []);
    return keywords.some(kw => kw && (action.includes(kw) || context.includes(kw)));
  });

  const dynamicContext = `【剧情摘要】
${memory.summary || 'None yet.'}

【世界设定参考】
${activeLore.length > 0 ? activeLore.map(w => {
  const kws: string[] = w.keywords ? w.keywords : ((w as any).keyword ? [(w as any).keyword] : []);
  return `[${kws.join(', ')}] ${w.content}`;
}).join(' | ') : 'None'}

Current context: ${context || 'The beginning of the adventure.'}
User's action: ${action}
Current Inventory: ${inventory.join(', ') || 'Empty'}
Current Skills: ${skills.map(s => s.name + ' (Lv.' + s.level + ', EXP:' + s.exp + ', MaxLv:' + s.maxLevel + ')').join(', ') || 'None'}
Current Quests: ${quests.length > 0 ? JSON.stringify(quests) : 'None'}
Current NPC States: ${npcStates.length > 0 ? JSON.stringify(npcStates) : 'None'}
Current Location: ${currentLocation}
Current Stats: HP ${stats.hp}/${stats.maxHp}, Gold ${stats.gold}, Level ${stats.level}, EXP ${stats.exp || 0}/${stats.maxExp || 100}, Skill Points ${stats.skillPoints || 0}
Current Attributes: Strength ${stats.attributes?.strength || 10}, Agility ${stats.attributes?.agility || 10}, Intelligence ${stats.attributes?.intelligence || 10}, Charisma ${stats.attributes?.charisma || 10}, Luck ${stats.attributes?.luck || 10}`;

  if (settings.provider === 'custom' && settings.baseUrl && settings.apiKey) {
    const customSystemInstruction = systemInstruction + `\n\nYou MUST return ONLY a valid JSON object with the exact following structure:
{
  "storyText": "string",
  "choices": ["string"],
  "inventory": ["string"],
  "skills": [
    {
      "name": "string",
      "level": number,
      "exp": number,
      "maxLevel": number
    }
  ],
  "quests": [
    {
      "id": "string",
      "name": "string",
      "step": number,
      "status": "active" | "completed" | "failed"
    }
  ],
  "npcStates": [
    {
      "name": "string",
      "affinity": number,
      "isAlive": boolean
    }
  ],
  "isGameOver": boolean,
  "location": "string",
  "stats": { 
    "hp": number, 
    "maxHp": number, 
    "gold": number, 
    "level": number, 
    "exp": number,
    "maxExp": number,
    "skillPoints": number,
    "attributes": { "strength": number, "agility": number, "intelligence": number, "charisma": number, "luck": number }
  },
  "combatLogs": ["string"]
}`;

    const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: customSystemInstruction },
          { role: 'user', content: dynamicContext }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`Custom API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return parseJSONResponse(content);
  }

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: dynamicContext,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          storyText: { type: Type.STRING, description: 'The narrative text for this turn. Must be highly detailed, immersive, and at least 3-4 paragraphs long.' },
          choices: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Options for the user.' },
          inventory: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Updated inventory.' },
          skills: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                level: { type: Type.INTEGER },
                exp: { type: Type.INTEGER },
                maxLevel: { type: Type.INTEGER }
              },
              required: ['name', 'level', 'exp', 'maxLevel']
            }, 
            description: 'Updated skills.' 
          },
          quests: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                step: { type: Type.INTEGER },
                status: { type: Type.STRING }
              },
              required: ['id', 'name', 'step', 'status']
            },
            description: 'Updated quests.'
          },
          npcStates: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                affinity: { type: Type.INTEGER },
                isAlive: { type: Type.BOOLEAN }
              },
              required: ['name', 'affinity', 'isAlive']
            },
            description: 'NPC states and affinities.'
          },
          isGameOver: { type: Type.BOOLEAN, description: 'True if the player is dead and the game is over.' },
          location: { type: Type.STRING, description: 'The current location of the player.' },
          stats: {
            type: Type.OBJECT,
            properties: {
              hp: { type: Type.INTEGER },
              maxHp: { type: Type.INTEGER },
              gold: { type: Type.INTEGER },
              level: { type: Type.INTEGER },
              exp: { type: Type.INTEGER },
              maxExp: { type: Type.INTEGER },
              skillPoints: { type: Type.INTEGER },
              attributes: {
                type: Type.OBJECT,
                properties: {
                  strength: { type: Type.INTEGER },
                  agility: { type: Type.INTEGER },
                  intelligence: { type: Type.INTEGER },
                  charisma: { type: Type.INTEGER },
                  luck: { type: Type.INTEGER }
                },
                required: ['strength', 'agility', 'intelligence', 'charisma', 'luck']
              }
            },
            required: ['hp', 'maxHp', 'gold', 'level', 'exp', 'maxExp', 'skillPoints', 'attributes']
          },
          combatLogs: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Detailed combat logs if combat occurred.' }
        },
        required: ['storyText', 'choices', 'inventory', 'skills', 'quests', 'npcStates', 'location', 'stats']
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
