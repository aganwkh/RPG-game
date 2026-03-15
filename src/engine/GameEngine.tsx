import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { GameState, ChatMessage, Item, Triplet, QuestNode } from "../types";
import * as gemini from "../services/gemini";

interface GameContextType {
  state: GameState;
  messages: ChatMessage[];
  isProcessing: boolean;
  processAction: (action: string) => Promise<void>;
  startGame: () => Promise<void>;
  useItem: (itemId: string) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within a GameProvider");
  return context;
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<GameState>({
    inventory: [],
    activeMysteries: [],
    knowledgeGraph: [],
    questDAG: {},
    currentLocation: "Unknown",
    hp: 100,
    maxHp: 100,
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const addMessage = (role: ChatMessage["role"], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString() + Math.random(), role, content },
    ]);
  };

  const startGame = useCallback(async () => {
    if (isInitialized) return;
    setIsProcessing(true);
    try {
      const initData = await gemini.initializeGame();

      setState((prev) => ({
        ...prev,
        currentLocation: initData.location,
        activeMysteries: initData.activeMysteries,
        questDAG: initData.questDAG,
        knowledgeGraph: initData.initialTriplets,
      }));

      addMessage("assistant", initData.initialStory);
      setIsInitialized(true);
    } catch (error) {
      console.error("Failed to start game:", error);
      addMessage("system", "Failed to initialize the game. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [isInitialized]);

  const processAction = useCallback(
    async (action: string) => {
      if (isProcessing) return;
      setIsProcessing(true);
      addMessage("user", action);

      try {
        // 1. Shadow Director (Multi-Agent Router)
        const directorNote = await gemini.generateDirectorNote(
          action,
          state.currentLocation,
          state.activeMysteries,
          state.inventory.map((i) => i.name),
          Object.values(state.questDAG)
            .filter((q) => q.status === "active")
            .map((q) => q.title),
        );

        // 2. Reverse RAG Probe (Inventory Resonance)
        const inventoryTruths = state.inventory
          .filter((i) => !i.isUnresolvedMystery && i.hiddenTruth)
          .map((i) => ({ id: i.id, name: i.name, truth: i.hiddenTruth! }));

        const resonance = await gemini.checkInventoryResonance(
          state.currentLocation,
          inventoryTruths,
        );
        let resonanceNote = null;
        if (resonance) {
          resonanceNote = `[System: The item '${state.inventory.find((i) => i.id === resonance.id)?.name}' resonates with the current location. ${resonance.resonanceNote}]`;
        }

        // 3. Lazy Evaluation (Schrödinger's Item)
        // If the player seems stuck (e.g., action contains "help", "stuck", "don't know")
        // or if we just randomly decide to collapse a mystery. Let's do it if they type "stuck" for now.
        let collapseNote = null;
        if (
          action.toLowerCase().includes("stuck") ||
          action.toLowerCase().includes("help")
        ) {
          const mysteryItem = state.inventory.find(
            (i) => i.isUnresolvedMystery,
          );
          if (mysteryItem) {
            const collapseResult = await gemini.collapseMystery(
              action,
              mysteryItem,
              state.currentLocation,
              state.activeMysteries,
            );

            // Update the item in state
            setState((prev) => ({
              ...prev,
              inventory: prev.inventory.map((i) =>
                i.id === mysteryItem.id
                  ? {
                      ...i,
                      isUnresolvedMystery: false,
                      hiddenTruth: collapseResult.newTruth,
                    }
                  : i,
              ),
            }));
            collapseNote = `[System: The mysterious item '${mysteryItem.name}' suddenly reveals its true nature: ${collapseResult.newTruth}. ${collapseResult.collapseNote}]`;
          }
        }

        // 4. Main Story Generation
        // Extract relevant triplets for context (simple filter for now)
        const relevantTriplets = state.knowledgeGraph
          .filter(
            (t) =>
              t.source.includes(state.currentLocation) ||
              t.target.includes(state.currentLocation) ||
              action.includes(t.source) ||
              action.includes(t.target),
          )
          .map((t) => `${t.source} ${t.relation} ${t.target}`);

        const activeQuests = Object.values(state.questDAG)
          .filter((q) => q.status === "active")
          .map((q) => q.title);

        const stream = await gemini.generateMainStoryStream(
          action,
          relevantTriplets,
          directorNote,
          resonanceNote,
          collapseNote,
          activeQuests,
          state.currentLocation,
        );

        let fullStory = "";
        addMessage("assistant", ""); // Placeholder for streaming

        for await (const chunk of stream) {
          const text = (chunk as any).text;
          if (text) {
            fullStory += text;
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1].content = fullStory;
              return newMessages;
            });
          }
        }

        // 5. State Extraction
        const updates = await gemini.extractStateUpdates(fullStory, state);

        setState((prev) => {
          const newState = { ...prev };

          if (updates.newItems && updates.newItems.length > 0) {
            const itemsToAdd = updates.newItems.map((item: any) => ({
              id: Date.now().toString() + Math.random(),
              name: item.name,
              type: item.type as any,
              surfaceDescription: item.surfaceDescription,
              hiddenTruth: item.hiddenTruth,
              isUnresolvedMystery: item.isUnresolvedMystery,
              usageCondition: item.usageCondition,
            }));
            newState.inventory = [...newState.inventory, ...itemsToAdd];
            addMessage(
              "system",
              `Obtained: ${itemsToAdd.map((i) => i.name).join(", ")}`,
            );
          }

          if (updates.newTriplets && updates.newTriplets.length > 0) {
            newState.knowledgeGraph = [
              ...newState.knowledgeGraph,
              ...updates.newTriplets,
            ];
          }

          if (updates.hpChange) {
            newState.hp = Math.min(
              newState.maxHp,
              Math.max(0, newState.hp + updates.hpChange),
            );
            if (updates.hpChange < 0)
              addMessage(
                "system",
                `Took ${Math.abs(updates.hpChange)} damage.`,
              );
            if (updates.hpChange > 0)
              addMessage("system", `Healed ${updates.hpChange} HP.`);
          }

          if (
            updates.newLocation &&
            updates.newLocation !== prev.currentLocation
          ) {
            newState.currentLocation = updates.newLocation;
            addMessage("system", `Moved to: ${updates.newLocation}`);
          }

          if (
            updates.completedQuestIds &&
            updates.completedQuestIds.length > 0
          ) {
            const newQuestDAG = { ...newState.questDAG };
            updates.completedQuestIds.forEach((id: string) => {
              if (newQuestDAG[id]) {
                newQuestDAG[id].status = "completed";
                addMessage(
                  "system",
                  `Quest Completed: ${newQuestDAG[id].title}`,
                );
              }
            });

            // Check for newly available quests
            Object.keys(newQuestDAG).forEach((id) => {
              const quest = newQuestDAG[id];
              if (quest.status === "locked") {
                const allDepsMet = quest.dependencies.every(
                  (depId) => newQuestDAG[depId]?.status === "completed",
                );
                if (allDepsMet) {
                  quest.status = "active";
                  addMessage("system", `New Quest Available: ${quest.title}`);
                }
              }
            });
            newState.questDAG = newQuestDAG;
          }

          return newState;
        });
      } catch (error) {
        console.error("Error processing action:", error);
        addMessage(
          "system",
          "An error occurred while processing your action. The weave of fate is tangled.",
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [state, isProcessing],
  );

  const useItem = useCallback(
    (itemId: string) => {
      const item = state.inventory.find((i) => i.id === itemId);
      if (!item) return;

      // Mechanical Anchoring: Frontend interception
      if (item.usageCondition) {
        // Simple check: if the usage condition mentions a keyword not in the current location or recent story, block it.
        // In a real game, this would be more robust. For now, we'll just send it to the engine as an action.
        addMessage(
          "system",
          `Attempting to use ${item.name}... Condition: ${item.usageCondition}`,
        );
        processAction(`I use the ${item.name}.`);
      } else {
        processAction(`I use the ${item.name}.`);
      }
    },
    [state.inventory, processAction],
  );

  return (
    <GameContext.Provider
      value={{
        state,
        messages,
        isProcessing,
        processAction,
        startGame,
        useItem,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
