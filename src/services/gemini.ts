import { GoogleGenAI, Type } from "@google/genai";
import { PacingMetrics, DirectorNote } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function parseJSON(text: string) {
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON:", text, e);
    return {};
  }
}

// We'll use Flash for fast routing and state extraction
export const flashModel = "gemini-3-flash-preview";
// We'll use Pro for main story generation
export const proModel = "gemini-3.1-pro-preview";

export async function fetchDirectorAPI(
  metrics: PacingMetrics,
  tensionLevel: number,
  currentActGoal: string,
  currentActCondition: string,
  recentStory: string,
): Promise<DirectorNote> {
  const prompt = `
You are the "Shadow Director" of a text RPG.
Your job is to control the pacing and narrative tension.

Current Metrics:
- Turns since last combat: ${metrics.turnsSinceLastCombat}
- Turns in current location: ${metrics.turnsInCurrentLocation}
- Turns since main quest update: ${metrics.turnsSinceMainQuestUpdate}
- Consecutive dialogue turns: ${metrics.consecutiveDialogueTurns}
- Global Tension Level: ${tensionLevel}/100

Current Act Goal: ${currentActGoal}
Completion Condition: ${currentActCondition}

Recent Story Context:
"${recentStory}"

Forced Decision Matrix:
1. If tension < 20 AND turns since last combat > 8, you MUST output a plot_injection (e.g., enemy ambush, sudden crisis) and set pacing to "normal".
2. If turns in current location > 15 AND completion condition is not met, you MUST set pacing to "fast-forward" to push the player forward.
3. If the player has met the completion condition based on the recent story, you MUST set advance_act to true.

Output a JSON object matching this schema:
{
  "pacing": "fast-forward" | "normal" | "slow-burn",
  "plot_injection": "string (empty if none)",
  "advance_act": boolean,
  "weather_or_mood": "peaceful" | "tense" | "horror" | "neutral"
}
  `;

  try {
    const response = await ai.models.generateContent({
      model: flashModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pacing: { type: Type.STRING },
            plot_injection: { type: Type.STRING },
            advance_act: { type: Type.BOOLEAN },
            weather_or_mood: { type: Type.STRING },
          },
          required: ["pacing", "plot_injection", "advance_act", "weather_or_mood"],
        },
      },
    });

    const result = parseJSON(response.text || "{}");
    return {
      pacing: result.pacing || "normal",
      plot_injection: result.plot_injection || "",
      advance_act: result.advance_act || false,
      weather_or_mood: result.weather_or_mood || "neutral",
    } as DirectorNote;
  } catch (e) {
    console.error("Director API failed, using fallback", e);
    return {
      pacing: "normal",
      plot_injection: "",
      advance_act: false,
      weather_or_mood: "neutral",
    };
  }
}

export async function checkInventoryResonance(
  location: string,
  inventoryTruths: { id: string; name: string; truth: string }[],
): Promise<{ id: string; resonanceNote: string } | null> {
  if (inventoryTruths.length === 0) return null;

  const prompt = `
You are the "Reverse RAG Probe" of a text RPG.
Your job is to check if any item in the player's inventory "resonates" with the current location.

Current Location: "${location}"

Inventory Items and their Hidden Truths:
${inventoryTruths.map((i) => `- ID: ${i.id}, Name: ${i.name}, Truth: ${i.truth}`).join("\n")}

If an item strongly relates to the location (e.g., a key for a door here, a relic from this ruin), output a JSON object with the item ID and a short instruction for the main writer on how the item reacts (e.g., glows, vibrates).
If no strong resonance, return null.
  `;

  const response = await ai.models.generateContent({
    model: flashModel,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description:
              "The ID of the resonating item, or empty string if none.",
          },
          resonanceNote: {
            type: Type.STRING,
            description: "Instruction for the main writer.",
          },
        },
      },
    },
  });

  try {
    const result = parseJSON(response.text || "{}");
    if (result.id && result.resonanceNote) {
      return result;
    }
  } catch (e) {
    console.error("Failed to parse resonance", e);
  }
  return null;
}

export async function collapseMystery(
  action: string,
  mysteryItem: { id: string; name: string },
  location: string,
  mysteries: string[],
): Promise<{ id: string; newTruth: string; collapseNote: string }> {
  const prompt = `
You are the "Lazy Evaluator" of a text RPG.
The player is stuck or needs a breakthrough. They have an unresolved mystery item: "${mysteryItem.name}".
Your job is to "collapse" this item's identity into something crucial for the current situation or an active mystery.

Context:
- Player Action: "${action}"
- Current Location: "${location}"
- Active Mysteries: ${mysteries.join(", ")}

Output a JSON object with:
1. newTruth: The newly decided hidden truth of the item (e.g., "This is actually the key to the sealed door in the current room.").
2. collapseNote: An instruction for the main writer to reveal this truth through a sudden memory, a glow, or a reaction.
  `;

  const response = await ai.models.generateContent({
    model: flashModel,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          newTruth: { type: Type.STRING },
          collapseNote: { type: Type.STRING },
        },
        required: ["newTruth", "collapseNote"],
      },
    },
  });

  try {
    const result = parseJSON(response.text || "{}");
    return {
      id: mysteryItem.id,
      newTruth: result.newTruth,
      collapseNote: result.collapseNote,
    };
  } catch (e) {
    console.error("Failed to parse collapse", e);
    return {
      id: mysteryItem.id,
      newTruth: "It remains a mystery.",
      collapseNote: "The item pulses faintly.",
    };
  }
}

export async function generateMainStoryStream(
  action: string,
  contextTriplets: string[],
  systemRoll: string | null,
  directorNote: DirectorNote | undefined,
  currentActGoal: string,
  resonanceNote: string | null,
  collapseNote: string | null,
  activeQuests: string[],
  location: string,
) {
  const prompt = `
You are the main storyteller of a text RPG.
Write the next part of the story based on the player's action.
Be immersive, descriptive, and engaging.

Context (Knowledge Graph):
${contextTriplets.join("\n")}

Current Location: "${location}"
Active Quests: ${activeQuests.join(", ")}

[SYSTEM HIGHEST PRIORITY GUIDANCE]:
${systemRoll ? `- Action Evaluation: ${systemRoll}` : ""}
${directorNote ? `- Pacing: ${directorNote.pacing}` : ""}
${directorNote?.plot_injection ? `- Plot Injection (MUST INCLUDE): ${directorNote.plot_injection}` : ""}
- Current Act Goal: ${currentActGoal}

${resonanceNote ? `[RESONANCE NOTE (Absolute Priority)]: ${resonanceNote}` : ""}
${collapseNote ? `[MYSTERY REVEAL NOTE (Absolute Priority)]: ${collapseNote}` : ""}

Player Action: "${action}"

Write the story response (1-3 paragraphs). Do not output JSON.
  `;

  return await ai.models.generateContentStream({
    model: proModel,
    contents: prompt,
  });
}

export async function extractStateUpdates(
  recentStory: string,
  currentState: any,
) {
  const prompt = `
You are the "State Extractor" of a text RPG.
Analyze the recent story and extract updates to the game state.

Recent Story:
"${recentStory}"

Current Location: "${currentState.currentLocation}"
Active Mysteries: ${currentState.activeMysteries.join(", ")}

Extract the following in JSON format:
1. newItems: Array of new items the player acquired.
   - For each item, provide: name, type (Consumable, Quest Item, Material, Unknown), surfaceDescription.
   - If it's a mysterious/unknown item, set isUnresolvedMystery to true and leave hiddenTruth empty.
   - If it's a known item, set isUnresolvedMystery to false and provide hiddenTruth (link it to Active Mysteries if possible).
   - Provide usageCondition if applicable (e.g., "Requires a locked door").
2. newTriplets: Array of new knowledge graph triplets (source, relation, target) discovered in the story.
3. hpChange: Number (positive for heal, negative for damage, 0 for no change).
4. newLocation: String (if the player moved to a new distinct area, otherwise empty string).
5. completedQuestIds: Array of quest IDs that were completed in this story segment.
6. expChange: Number. Dynamic Reward Scaling Rule:
   - Traveling/Idle: 0-5 EXP
   - Combat/Puzzle Solving: 20-50 EXP
   - Act Progression/Boss Defeated: 100-300 EXP

JSON Schema:
{
  "newItems": [
    {
      "name": "string",
      "type": "string",
      "surfaceDescription": "string",
      "hiddenTruth": "string",
      "isUnresolvedMystery": boolean,
      "usageCondition": "string"
    }
  ],
  "newTriplets": [
    { "source": "string", "relation": "string", "target": "string" }
  ],
  "hpChange": number,
  "newLocation": "string",
  "completedQuestIds": ["string"],
  "expChange": number
}
  `;

  const response = await ai.models.generateContent({
    model: flashModel,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          newItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                type: { type: Type.STRING },
                surfaceDescription: { type: Type.STRING },
                hiddenTruth: { type: Type.STRING },
                isUnresolvedMystery: { type: Type.BOOLEAN },
                usageCondition: { type: Type.STRING },
              },
            },
          },
          newTriplets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                relation: { type: Type.STRING },
                target: { type: Type.STRING },
              },
            },
          },
          hpChange: { type: Type.NUMBER },
          newLocation: { type: Type.STRING },
          completedQuestIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          expChange: { type: Type.NUMBER },
        },
      },
    },
  });

  try {
    return parseJSON(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse state updates", e);
    return {};
  }
}

export async function initializeGame() {
  const prompt = `
You are the "World Builder" of a text RPG.
Generate the initial state for a new game.
We need a compelling starting scenario with a clear main quest and some mysteries.

Output a JSON object with:
1. initialStory: The opening paragraph of the game.
2. location: The starting location name.
3. activeMysteries: Array of 2-3 long-term mysteries (e.g., "The missing heir", "The source of the corruption").
4. questDAG: A dictionary of 3-4 quests forming a Directed Acyclic Graph.
   - Keys are quest IDs (e.g., "q1", "q2").
   - Values are objects with: title, description, dependencies (array of prerequisite quest IDs), status ('active' for the first one, 'locked' for others).
5. initialTriplets: Array of 3-5 knowledge graph triplets establishing the starting lore.
  `;

  const response = await ai.models.generateContent({
    model: proModel,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          initialStory: { type: Type.STRING },
          location: { type: Type.STRING },
          activeMysteries: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          questDAG: {
            type: Type.OBJECT,
            additionalProperties: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                dependencies: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                status: { type: Type.STRING },
              },
            },
          },
          initialTriplets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                relation: { type: Type.STRING },
                target: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  try {
    return parseJSON(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse initialization", e);
    throw new Error("Failed to initialize game");
  }
}
