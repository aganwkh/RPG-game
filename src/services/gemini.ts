import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || 'dummy_key_to_prevent_crash';
const ai = new GoogleGenAI({ apiKey });

// We'll use Flash for fast routing and state extraction
export const flashModel = "gemini-3-flash-preview";
// We'll use Pro for main story generation
export const proModel = "gemini-3.1-pro-preview";

export async function generateDirectorNote(
  action: string,
  location: string,
  mysteries: string[],
  inventory: string[],
  quests: string[],
): Promise<string> {
  const prompt = `
You are the "Shadow Director" of a text RPG.
Your job is to output a single, concise Director's Note (under 50 words) to guide the main story writer.
Do NOT write the story yourself. Just give instructions on tone, pacing, and what to focus on.

Context:
- Player Action: "${action}"
- Current Location: "${location}"
- Active Mysteries: ${mysteries.join(", ")}
- Inventory: ${inventory.join(", ")}
- Active Quests: ${quests.join(", ")}

Output a short instruction like: "Make it rain to set a sad mood. Hint at the missing heir. Don't reveal monster HP."
  `;

  const response = await ai.models.generateContent({
    model: flashModel,
    contents: prompt,
  });

  return response.text || "";
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
    const result = JSON.parse(response.text || "{}");
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
    const result = JSON.parse(response.text || "{}");
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
  directorNote: string,
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

[DIRECTOR's NOTE (Absolute Priority)]: ${directorNote}
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
  currentState: { currentLocation: string, activeMysteries: string[] },
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
  "completedQuestIds": ["string"]
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
        },
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}");
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
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse initialization", e);
    throw new Error("Failed to initialize game");
  }
}
