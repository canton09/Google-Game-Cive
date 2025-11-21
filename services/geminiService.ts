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

    const prompt = `
    You are the chronicler of a virtual civilization simulation.
    Current State:
    - Generation: ${gameState.generation}
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

export const generateCivilizationSnapshot = async (gameState: GameState): Promise<string | null> => {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
    Generate a minimalist, isometric 3D render of a simulated civilization suitable for a game screenshot.
    
    Scene Composition:
    - Camera: Isometric view, looking down at a flat dark slate terrain with a subtle grid.
    - Inhabitants: ${gameState.agents.length} small, glowing abstract humanoid figures (cyan/blue dots or capsule shapes) moving purposefully.
    - Architecture: ${gameState.buildings.length} geometric low-poly buildings (pink cubes for houses, violet prisms for storage).
    - Resources: Clusters of emerald green spheres (food), amber blocks (wood), and grey rocks (stone) scattered around.
    - Atmosphere: Dark, atmospheric, sci-fi UI interface aesthetic.
    ${gameState.disasterActive ? `- Event: The scene is affected by a ${gameState.disasterType}, showing dynamic weather or shaking effects.` : '- Mood: Peaceful and busy.'}
    - Style: Digital art, clean lines, glowing neon accents, deep contrast.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    imageSize: '1K',
                    aspectRatio: "1:1"
                }
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (e: any) {
        console.error("Snapshot generation failed", e);
        throw e;
    }
};