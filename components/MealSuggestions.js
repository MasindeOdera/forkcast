'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ChefHat,
  Copy,
  Check,
  Calendar,
  Lightbulb,
  Plus,
  Sparkles,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import MealSuggestionForm from './MealSuggestionForm';
import MealPlanningCalendar from './MealPlanningCalendar';
import { EmptyState } from '@/components/ui/empty-state';
import { apiPost } from '@/lib/api-client';

export default function MealSuggestions() {
  const [suggestions, setSuggestions] = useState('');
  const [copied, setCopied] = useState(false);
  const [parsedMeals, setParsedMeals] = useState([]);
  // Track the AI request lifecycle so the results panel can show a
  // dedicated loading state (skeletons + "Cooking up ideas…") instead of
  // freezing the submit button and leaving the panel blank.
  const [aiStatus, setAiStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [aiError, setAiError] = useState(null);
  const [lastPrompt, setLastPrompt] = useState(null);

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
    setAiStatus('idle');
    setAiError(null);
    setLastPrompt(null);
  };

  // Parse AI suggestions into draggable meal objects.
  // (Same behaviour as before — fixed a small precedence bug on the bullet-
  // line detection so it correctly requires `currentMeal` to be set.)
  const parseAISuggestions = (suggestionsText) => {
    const meals = [];
    const lines = suggestionsText.split('\n');
    let currentMeal = null;
    let section = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Detect meal titles (numbered items or standalone titles).
      if (
        line.match(/^\d+\.\s+(.+)/) ||
        (line.endsWith(':') &&
          !line.toLowerCase().includes('ingredient') &&
          !line.toLowerCase().includes('instruction'))
      ) {
        if (currentMeal && currentMeal.title) meals.push(currentMeal);
        const title = line.replace(/^\d+\.\s*/, '').replace(/:$/, '');
        currentMeal = {
          id: `ai-${Date.now()}-${meals.length}`,
          title,
          ingredients: [],
          instructions: [],
          imageUrl: null,
          isAIGenerated: true,
          user: { username: 'AI Assistant' },
        };
        section = '';
      } else if (line.toLowerCase().includes('ingredient') && line.endsWith(':')) {
        section = 'ingredients';
      } else if (
        (line.toLowerCase().includes('instruction') ||
          line.toLowerCase().includes('direction')) &&
        line.endsWith(':')
      ) {
        section = 'instructions';
      } else if (currentMeal && (line.startsWith('-') || line.startsWith('•'))) {
        const content = line.replace(/^[-•]\s*/, '');
        if (section === 'ingredients') currentMeal.ingredients.push(content);
        else if (section === 'instructions') currentMeal.instructions.push(content);
      } else if (currentMeal && line) {
        if (
          line.toLowerCase().includes('cup') ||
          line.toLowerCase().includes('tbsp') ||
          line.toLowerCase().includes('tsp') ||
          line.toLowerCase().includes('lb') ||
          line.toLowerCase().includes('oz') ||
          section === 'ingredients'
        ) {
          currentMeal.ingredients.push(line);
        } else if (section === 'instructions') {
          currentMeal.instructions.push(line);
        }
      }
    }

    if (currentMeal && currentMeal.title) meals.push(currentMeal);

    return meals.map((meal) => ({
      ...meal,
      ingredients: meal.ingredients.join('\n') || 'No ingredients specified',
      instructions: meal.instructions.join('\n') || 'No instructions specified',
    }));
  };

  // Called by MealSuggestionForm when the API responds. We now also get
  // status + error so the panel can render the right state instead of
  // stuffing an "Error: …" string into `suggestions`.
  const handleSuggestionsReceived = (result) => {
    // Backwards-compat: some callers may still pass a raw string.
    if (typeof result === 'string') {
      setSuggestions(result);
      setParsedMeals(parseAISuggestions(result));
      setAiStatus('success');
      setAiError(null);
      return;
    }
    const { status, suggestions: text, error, prompt } = result || {};
    setLastPrompt(prompt || null);
    if (status === 'loading') {
      setAiStatus('loading');
      setAiError(null);
      return;
    }
    if (status === 'error') {
      setAiStatus('error');
      setAiError(error || 'Something went wrong.');
      setSuggestions('');
      setParsedMeals([]);
      return;
    }
    // success
    setSuggestions(text || '');
    setParsedMeals(parseAISuggestions(text || ''));
    setAiStatus('success');
    setAiError(null);
  };

  const handleAddAIMealToPlan = async (meal) => {
    const res = await apiPost('/api/meals', {
      title: `${meal.title} (AI Generated)`,
      ingredients: meal.ingredients,
      instructions: meal.instructions,
      imageUrl: meal.imageUrl,
      galleryImages: [],
    });
    if (!res.ok) {
      toast.error(res.error?.message || 'Could not add AI meal to your recipes.');
      return;
    }
    toast.success(`"${meal.title}" added to your recipes! 🎉`);
  };

  // Drag and drop handlers for AI meals.
  const handleDragStart = (e, meal) => {
    e.dataTransfer.setData('application/json', JSON.stringify(meal));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Skeleton block used while the LLM is thinking.
  const AiLoadingSkeleton = () => (
    <div className="space-y-4" role="status" aria-label="Generating AI meal ideas">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 animate-pulse text-primary" aria-hidden="true" />
        <span>Cooking up ideas…</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-primary/20">
            <CardHeader className="pb-2 space-y-2">
              <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-4/6" />
              <Skeleton className="h-8 w-full mt-3" />
            </CardContent>
          </Card>
        ))}
      </div>
      <span className="sr-only">Generating AI meal ideas…</span>
    </div>
  );

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

          {/* Loading state while the LLM responds */}
          {aiStatus === 'loading' && <AiLoadingSkeleton />}

          {/* Error state — with a retry hint pointing at the form */}
          {aiStatus === 'error' && (
            <EmptyState
              variant="error"
              icon={AlertTriangle}
              title="Couldn't generate ideas"
              description={
                aiError ||
                "The AI service didn't respond in time. Give it another try."
              }
              action={{
                label: 'Try again',
                icon: RefreshCw,
                onClick: () => {
                  setAiStatus('idle');
                  setAiError(null);
                  // Scroll the form back into view so retry is one click.
                  document.querySelector('[data-suggestion-form]')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                },
              }}
            />
          )}

          {/* Draggable AI Meal Cards */}
          {aiStatus === 'success' && parsedMeals.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-primary" />
                AI Generated Meals — Drag to Calendar
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
                  <strong>Tip:</strong> Drag any AI-generated meal directly onto the
                  Weekly Planner calendar slots, or click &ldquo;Add to My Recipes&rdquo;
                  to save them permanently.
                </p>
              </div>
            </div>
          )}

          {/* Success but parser couldn't extract any cards → show raw text panel only */}
          {aiStatus === 'success' && parsedMeals.length === 0 && suggestions && (
            <EmptyState
              icon={Lightbulb}
              title="No structured meals found"
              description="The AI returned text but we couldn't parse it into meal cards. See the raw response below."
            />
          )}

          {/* Raw AI Suggestions Display */}
          {aiStatus === 'success' && suggestions && (
            <Card className="w-full">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-primary" />
                    Raw AI Suggestions
                  </CardTitle>
                  <CardDescription>Full AI response for reference</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
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
                  <Button variant="outline" size="sm" onClick={clearSuggestions} className="shrink-0">
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none text-sm leading-relaxed">
                  {suggestions.split('\n').map((line, i) => {
                    if (!line.trim()) return <br key={i} />;
                    if (line.match(/^\d+\.\s/) || line.endsWith(':')) {
                      return (
                        <h3
                          key={i}
                          className="font-semibold text-foreground mt-4 mb-2 first:mt-0"
                        >
                          {line}
                        </h3>
                      );
                    }
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
                    <Sparkles className="h-3 w-3" />
                    <span>Powered by AI • Generated just for you</span>
                    <Badge variant="secondary" className="text-xs">
                      Beta
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Idle empty-state hint (only when there's nothing in progress or on screen) */}
          {aiStatus === 'idle' && parsedMeals.length === 0 && !suggestions && (
            <EmptyState
              icon={Sparkles}
              title="Meal ideas will appear here"
              description="Fill in the form above and hit ‘Get AI Meal Suggestions’ — we'll conjure up a few options tailored to your ingredients and preferences."
              className="border-primary/20 bg-primary/5"
            />
          )}
        </TabsContent>

        <TabsContent value="meal-planner" className="space-y-6">
          <MealPlanningCalendar />
        </TabsContent>
      </Tabs>
    </div>
  );
}
