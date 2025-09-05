'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';

export default function MealSuggestionForm({ onSuggestionsReceived }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    prompt: '',
    ingredients: '',
    dietary: '',
    cuisine: '',
    mealType: 'dinner'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('forkcast_token');
      const response = await fetch('/api/meal-suggestions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: formData.prompt,
          ingredients: formData.ingredients.split(',').map(i => i.trim()).filter(Boolean),
          dietary: formData.dietary,
          cuisine: formData.cuisine,
          mealType: formData.mealType
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get suggestions');
      }
      
      const data = await response.json();
      onSuggestionsReceived(data.suggestions);
    } catch (error) {
      console.error('Error getting meal suggestions:', error);
      onSuggestionsReceived(`Error: ${error.message}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Meal Suggestions
        </CardTitle>
        <CardDescription>
          Describe what you're looking for or tell me what ingredients you have on hand
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              What kind of meal are you looking for? *
            </label>
            <Textarea
              name="prompt"
              placeholder="E.g., I want something quick and healthy for lunch, or I'm craving comfort food"
              value={formData.prompt}
              onChange={handleChange}
              className="w-full"
              rows={3}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Ingredients you have (comma separated)
            </label>
            <Input
              name="ingredients"
              placeholder="E.g., chicken, spinach, rice, garlic, onions"
              value={formData.ingredients}
              onChange={handleChange}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Dietary Preferences
              </label>
              <Select
                value={formData.dietary}
                onValueChange={(value) => handleSelectChange('dietary', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="vegetarian">Vegetarian</SelectItem>
                  <SelectItem value="vegan">Vegan</SelectItem>
                  <SelectItem value="gluten-free">Gluten-Free</SelectItem>
                  <SelectItem value="keto">Keto</SelectItem>
                  <SelectItem value="low-carb">Low Carb</SelectItem>
                  <SelectItem value="dairy-free">Dairy-Free</SelectItem>
                  <SelectItem value="paleo">Paleo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Cuisine Style
              </label>
              <Select
                value={formData.cuisine}
                onValueChange={(value) => handleSelectChange('cuisine', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="italian">Italian</SelectItem>
                  <SelectItem value="mexican">Mexican</SelectItem>
                  <SelectItem value="indian">Indian</SelectItem>
                  <SelectItem value="chinese">Chinese</SelectItem>
                  <SelectItem value="japanese">Japanese</SelectItem>
                  <SelectItem value="thai">Thai</SelectItem>
                  <SelectItem value="mediterranean">Mediterranean</SelectItem>
                  <SelectItem value="american">American</SelectItem>
                  <SelectItem value="french">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Meal Type
              </label>
              <Select
                value={formData.mealType}
                onValueChange={(value) => handleSelectChange('mealType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Dinner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                  <SelectItem value="dessert">Dessert</SelectItem>
                  <SelectItem value="appetizer">Appetizer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={loading || !formData.prompt.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating AI Suggestions...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Get AI Meal Suggestions
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}