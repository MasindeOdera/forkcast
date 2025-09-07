'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChefHat, Clock, Star, Copy, Check, Calendar, Lightbulb, Plus } from 'lucide-react';
import MealSuggestionForm from './MealSuggestionForm';
import MealPlanningCalendar from './MealPlanningCalendar';

export default function MealSuggestions() {
  const [suggestions, setSuggestions] = useState('');
  const [copied, setCopied] = useState(false);
  const [parsedMeals, setParsedMeals] = useState([]);

  const handleCopy = async () => {
    if (suggestions) {
      await navigator.clipboard.writeText(suggestions);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const clearSuggestions = () => {
    setSuggestions('');
    setParsedMeals([]);
  };

  // Parse AI suggestions into draggable meal objects
  const parseAISuggestions = (suggestionsText) => {
    const meals = [];
    const lines = suggestionsText.split('\n');
    let currentMeal = null;
    let section = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Detect meal titles (numbered items or standalone titles)
      if (line.match(/^\d+\.\s+(.+)/) || (line.endsWith(':') && !line.toLowerCase().includes('ingredient') && !line.toLowerCase().includes('instruction'))) {
        // Save previous meal if exists
        if (currentMeal && currentMeal.title) {
          meals.push(currentMeal);
        }
        
        // Start new meal
        const title = line.replace(/^\d+\.\s*/, '').replace(/:$/, '');
        currentMeal = {
          id: `ai-${Date.now()}-${meals.length}`,
          title: title,
          ingredients: [],
          instructions: [],
          imageUrl: null,
          isAIGenerated: true,
          user: { username: 'AI Assistant' }
        };
        section = '';
      }
      // Detect ingredients section
      else if (line.toLowerCase().includes('ingredient') && line.endsWith(':')) {
        section = 'ingredients';
      }
      // Detect instructions section
      else if ((line.toLowerCase().includes('instruction') || line.toLowerCase().includes('direction')) && line.endsWith(':')) {
        section = 'instructions';
      }
      // Add content to current section
      else if (currentMeal && line.startsWith('-') || line.startsWith('•')) {
        const content = line.replace(/^[-•]\s*/, '');
        if (section === 'ingredients') {
          currentMeal.ingredients.push(content);
        } else if (section === 'instructions') {
          currentMeal.instructions.push(content);
        }
      }
      // If no specific section, try to classify the content
      else if (currentMeal && line) {
        // If it looks like an ingredient list (contains common ingredient words)
        if (line.toLowerCase().includes('cup') || 
            line.toLowerCase().includes('tbsp') || 
            line.toLowerCase().includes('tsp') ||
            line.toLowerCase().includes('lb') ||
            line.toLowerCase().includes('oz') || 
            section === 'ingredients') {
          currentMeal.ingredients.push(line);
        }
        // Otherwise treat as instruction
        else if (section === 'instructions') {
          currentMeal.instructions.push(line);
        }
      }
    }
    
    // Add the last meal
    if (currentMeal && currentMeal.title) {
      meals.push(currentMeal);
    }

    // Convert arrays to strings for compatibility
    return meals.map(meal => ({
      ...meal,
      ingredients: meal.ingredients.join('\n') || 'No ingredients specified',
      instructions: meal.instructions.join('\n') || 'No instructions specified'
    }));
  };

  const handleSuggestionsReceived = (suggestionsText) => {
    setSuggestions(suggestionsText);
    const parsed = parseAISuggestions(suggestionsText);
    setParsedMeals(parsed);
  };

  const handleAddAIMealToPlan = async (meal) => {
    try {
      const token = localStorage.getItem('forkcast_token');
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: `${meal.title} (AI Generated)`,
          ingredients: meal.ingredients,
          instructions: meal.instructions,
          imageUrl: meal.imageUrl,
          galleryImages: []
        })
      });

      if (response.ok) {
        console.log('AI meal added to your collection!');
        // You might want to show a toast here
      }
    } catch (error) {
      console.error('Error adding AI meal:', error);
    }
  };

  // Drag and drop handlers for AI meals
  const handleDragStart = (e, meal) => {
    e.dataTransfer.setData('application/json', JSON.stringify(meal));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <Tabs defaultValue="ai-ideas" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai-ideas" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            <span className="hidden sm:inline">AI Ideas</span>
          </TabsTrigger>
          <TabsTrigger value="meal-planner" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Weekly Planner</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai-ideas" className="space-y-6">
          <MealSuggestionForm onSuggestionsReceived={handleSuggestionsReceived} />
          
          {/* Draggable AI Meal Cards */}
          {parsedMeals.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-primary" />
                AI Generated Meals - Drag to Calendar
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {parsedMeals.map((meal) => (
                  <Card 
                    key={meal.id} 
                    className="cursor-grab hover:shadow-lg transition-shadow border-primary/20"
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, meal)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                          AI
                        </Badge>
                        {meal.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium mb-1">Ingredients:</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {meal.ingredients.split('\n').slice(0, 2).join(', ')}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Instructions:</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {meal.instructions.split('\n')[0]}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddAIMealToPlan(meal)}
                        className="w-full h-8 text-xs"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add to My Recipes
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  <strong>Tip:</strong> Drag any AI-generated meal directly onto the Weekly Planner calendar slots, or click "Add to My Recipes" to save them permanently.
                </p>
              </div>
            </div>
          )}
          
          {/* Raw AI Suggestions Display */}
          {suggestions && (
            <Card className="w-full">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-primary" />
                    Raw AI Suggestions
                  </CardTitle>
                  <CardDescription>
                    Full AI response for reference
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSuggestions}
                    className="shrink-0"
                  >
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none text-sm leading-relaxed">
                  {suggestions.split('\n').map((line, i) => {
                    if (!line.trim()) return <br key={i} />;
                    
                    // Style headers (lines that end with : or are numbered)
                    if (line.match(/^\d+\.\s/) || line.endsWith(':')) {
                      return (
                        <h3 key={i} className="font-semibold text-foreground mt-4 mb-2 first:mt-0">
                          {line}
                        </h3>
                      );
                    }
                    
                    // Style bullet points
                    if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
                      return (
                        <p key={i} className="ml-4 text-muted-foreground">
                          {line}
                        </p>
                      );
                    }
                    
                    return (
                      <p key={i} className="text-foreground mb-2">
                        {line}
                      </p>
                    );
                  })}
                </div>
                
                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Star className="h-3 w-3" />
                    <span>Powered by AI • Generated just for you</span>
                    <Badge variant="secondary" className="text-xs">
                      Beta
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="meal-planner" className="space-y-6">
          <MealPlanningCalendar />
        </TabsContent>
      </Tabs>
    </div>
  );
}