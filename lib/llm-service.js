// Simple LLM service using OpenAI-compatible API with Emergent key
export class MealSuggestionService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async getMealSuggestions(prompt, options = {}) {
    try {
      const systemPrompt = `You are a culinary expert AI assistant for Forkcast, a meal planning app. Your role is to suggest delicious, creative meal ideas based on user preferences, dietary restrictions, available ingredients, or desired cuisines. 

Please provide 3-5 specific meal suggestions in a clear, organized format. For each suggestion, include:
- Meal name
- Brief description (1-2 sentences)
- Key ingredients
- Estimated cooking time
- Difficulty level (Easy/Medium/Hard)

Format your response as a numbered list with clear sections for each meal.`;

      const userPrompt = this.formatPrompt(prompt, options);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get AI response');
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'No suggestions available';
    } catch (error) {
      console.error('Error getting meal suggestions:', error);
      throw new Error('Failed to generate meal suggestions: ' + error.message);
    }
  }

  formatPrompt(basePrompt, options) {
    const { ingredients, dietary, cuisine, mealType } = options;
    
    let formattedPrompt = basePrompt || 'Please suggest some meal ideas';
    
    if (ingredients && ingredients.length > 0) {
      formattedPrompt += `\n\nIngredients I have available: ${ingredients.join(', ')}`;
    }
    
    if (dietary) {
      formattedPrompt += `\n\nDietary requirements: ${dietary}`;
    }
    
    if (cuisine) {
      formattedPrompt += `\n\nPreferred cuisine: ${cuisine}`;
    }
    
    if (mealType) {
      formattedPrompt += `\n\nMeal type: ${mealType}`;
    }
    
    formattedPrompt += '\n\nPlease provide detailed, practical meal suggestions that I can actually cook.';
    
    return formattedPrompt;
  }
}