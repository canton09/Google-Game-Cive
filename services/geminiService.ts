
import { GoogleGenAI } from "@google/genai";
import { GameState } from "../types";

export const generateLore = async (gameState: GameState): Promise<string | null> => {
    if (!process.env.API_KEY) return null;
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Calculate average stats to give personality to the civ
    const avgSpeed = gameState.agents.reduce((acc, a) => acc + a.stats.speed, 0) / (gameState.agents.length || 1);
    const avgStr = gameState.agents.reduce((acc, a) => acc + a.stats.maxCarry, 0) / (gameState.agents.length || 1);
    const avgRes = gameState.agents.reduce((acc, a) => acc + a.stats.resilience, 0) / (gameState.agents.length || 1);

    const dominantTrait = 
        avgSpeed > 2 ? "Swift" : 
        avgStr > 15 ? "Strong" : 
        avgRes > 0.3 ? "Resilient" : "Balanced";

    // Approx year calc for AI context (matches App.tsx roughly)
    const currentYear = Math.floor(gameState.totalTime / 3600) + 1;

    const prompt = `
    You are the chronicler of a virtual civilization simulation.
    Current State:
    - Year: ${currentYear}
    - Population: ${gameState.agents.length} (Peak: ${gameState.populationPeak})
    - Resources: Food ${Math.floor(gameState.resources.FOOD)}, Wood ${Math.floor(gameState.resources.WOOD)}, Stone ${Math.floor(gameState.resources.STONE)}
    - Dominant Evolutionary Trait: ${dominantTrait}
    - Recent Disaster: ${gameState.disasterType || "None"}

    Write a ONE sentence historical log entry describing the current era or a significant recent development in Chinese (Simplified), using a mythical, slightly cryptic tone. Do not use markdown.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text?.trim() || null;
    } catch (e: any) {
        if (e.status === 429 || e.code === 429 || e.message?.includes('429') || e.status === 'RESOURCE_EXHAUSTED') {
            console.warn("Lore generation skipped: Rate limit exceeded.");
            return null;
        }
        console.error("Lore generation failed", e);
        return null;
    }
};
