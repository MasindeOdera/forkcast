#!/usr/bin/env python3
"""
Simple Flask API for AI meal suggestions using Emergent LLM integration.
This service runs alongside the Next.js app to provide AI capabilities.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import asyncio
import os
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

from emergentintegrations.llm.chat import LlmChat, UserMessage

app = Flask(__name__)
CORS(app)

EMERGENT_LLM_KEY = os.getenv('EMERGENT_LLM_KEY')

def run_async(coro):
    """Helper to run async code in sync context"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()

async def get_meal_suggestions(prompt, options=None):
    """Generate meal suggestions using Emergent LLM"""
    options = options or {}
    
    system_message = """You are a professional chef and meal planning expert. 
    When asked for meal suggestions, provide exactly 3 meal ideas in valid JSON format.
    Each meal should have: name, description, ingredients (as array), cookingTime, difficulty.
    
    IMPORTANT: Return ONLY valid JSON array, no markdown, no explanation, just the JSON.
    
    Example format:
    [
      {
        "name": "Meal Name",
        "description": "Brief description",
        "ingredients": ["ingredient 1", "ingredient 2"],
        "cookingTime": "30 minutes",
        "difficulty": "Easy"
      }
    ]"""
    
    # Build the user prompt with context
    user_prompt = f"Suggest 3 meal ideas based on: {prompt}"
    
    if options.get('ingredients'):
        user_prompt += f"\nPreferred ingredients: {options['ingredients']}"
    if options.get('dietary'):
        user_prompt += f"\nDietary requirements: {options['dietary']}"
    if options.get('cuisine'):
        user_prompt += f"\nCuisine preference: {options['cuisine']}"
    if options.get('mealType'):
        user_prompt += f"\nMeal type: {options['mealType']}"
    
    user_prompt += "\n\nReturn ONLY the JSON array with 3 meals, no other text."
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"meal-suggestion-{os.urandom(4).hex()}",
        system_message=system_message
    ).with_model("openai", "gpt-4o-mini")
    
    user_message = UserMessage(text=user_prompt)
    response = await chat.send_message(user_message)
    
    # Parse the JSON response
    try:
        # Clean up the response - remove markdown code blocks if present
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        response_text = response_text.strip()
        
        suggestions = json.loads(response_text)
        return suggestions
    except json.JSONDecodeError:
        # If parsing fails, return mock data
        return [
            {
                "name": "Quick Stir-Fry",
                "description": "A healthy and fast vegetable stir-fry",
                "ingredients": ["Mixed vegetables", "Soy sauce", "Garlic", "Ginger", "Rice"],
                "cookingTime": "15 minutes",
                "difficulty": "Easy"
            },
            {
                "name": "Pasta Primavera",
                "description": "Light pasta with fresh seasonal vegetables",
                "ingredients": ["Pasta", "Cherry tomatoes", "Zucchini", "Bell peppers", "Olive oil", "Parmesan"],
                "cookingTime": "25 minutes",
                "difficulty": "Easy"
            },
            {
                "name": "Chicken Bowl",
                "description": "Protein-rich bowl with grains and vegetables",
                "ingredients": ["Chicken breast", "Quinoa", "Avocado", "Black beans", "Corn", "Lime"],
                "cookingTime": "30 minutes",
                "difficulty": "Medium"
            }
        ]

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "ai-meal-suggestions"})

@app.route('/suggest', methods=['POST'])
def suggest_meals():
    try:
        data = request.json or {}
        prompt = data.get('prompt', 'healthy dinner ideas')
        options = {
            'ingredients': data.get('ingredients'),
            'dietary': data.get('dietary'),
            'cuisine': data.get('cuisine'),
            'mealType': data.get('mealType')
        }
        
        suggestions = run_async(get_meal_suggestions(prompt, options))
        return jsonify({"suggestions": suggestions})
    except Exception as e:
        print(f"Error generating suggestions: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('AI_SERVICE_PORT', 5001))
    print(f"Starting AI Meal Suggestions service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
