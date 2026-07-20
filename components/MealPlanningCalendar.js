'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChefHat, Plus, Utensils, Coffee, Clock, Sparkles, ChevronLeft, ChevronRight, Users, X } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, parseISO, isToday } from 'date-fns';

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: Coffee },
  { value: 'lunch', label: 'Lunch', icon: Utensils },
  { value: 'dinner', label: 'Dinner', icon: ChefHat },
];

export default function MealPlanningCalendar() {
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date()));
  const [mealPlan, setMealPlan] = useState({});
  const [userMeals, setUserMeals] = useState([]);
  const [allMeals, setAllMeals] = useState([]);
  const [showMealSelector, setShowMealSelector] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState('');
  const [loadingMeals, setLoadingMeals] = useState(true);
  const [showCommunityPlans, setShowCommunityPlans] = useState(false);
  const [draggedMeal, setDraggedMeal] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // Load user's meals and meal plan data
  useEffect(() => {
    loadUserMeals();
    loadMealPlan();
    // Default the mobile day picker to today if it falls inside the current week, otherwise first day
    const todayIdx = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i))
      .findIndex((d) => isSameDay(d, new Date()));
    setSelectedDayIndex(todayIdx >= 0 ? todayIdx : 0);
  }, [currentWeek]);

  const loadUserMeals = async () => {
    try {
      const token = localStorage.getItem('forkcast_token');
      const user = JSON.parse(localStorage.getItem('forkcast_user') || '{}');
      
      // Load user's own meals
      const userResponse = await fetch(`/api/meals?userId=${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (userResponse.ok) {
        const userMealsData = await userResponse.json();
        setUserMeals(userMealsData);
      }

      // Load all meals for community view
      const allResponse = await fetch('/api/meals', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (allResponse.ok) {
        const allMealsData = await allResponse.json();
        setAllMeals(allMealsData);
      }
    } catch (error) {
      console.error('Error loading meals:', error);
    } finally {
      setLoadingMeals(false);
    }
  };

  // Drag and drop functions
  const handleDragStart = (e, meal) => {
    setDraggedMeal(meal);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, date, mealType) => {
    e.preventDefault();
    
    // Try to get meal from dataTransfer (for AI meals)
    try {
      const mealData = e.dataTransfer.getData('application/json');
      if (mealData) {
        const meal = JSON.parse(mealData);
        
        // If it's an AI-generated meal, first add it to user's collection
        if (meal.isAIGenerated) {
          handleAddAIMealToCollection(meal, date, mealType);
        } else {
          addMealToSlot(date, mealType, meal);
        }
        setDraggedMeal(null);
        return;
      }
    } catch (error) {
      console.log('No JSON data in drag transfer, using draggedMeal');
    }
    
    // Fallback to existing draggedMeal logic
    if (draggedMeal) {
      addMealToSlot(date, mealType, draggedMeal);
      setDraggedMeal(null);
    }
  };

  // Handle AI meal drop - add to collection first, then to calendar
  const handleAddAIMealToCollection = async (aiMeal, date, mealType) => {
    try {
      const token = localStorage.getItem('forkcast_token');
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: `${aiMeal.title} (AI Generated)`,
          ingredients: aiMeal.ingredients,
          instructions: aiMeal.instructions,
          imageUrl: aiMeal.imageUrl,
          galleryImages: []
        })
      });

      if (response.ok) {
        const newMeal = await response.json();
        
        // Add the new meal to the calendar slot
        addMealToSlot(date, mealType, newMeal);
        
        // Refresh user meals to include the new AI meal
        loadUserMeals();
        
        console.log('AI meal added to collection and calendar!');
      }
    } catch (error) {
      console.error('Error adding AI meal:', error);
    }
  };

  const handleAddToMealPlan = (meal) => {
    // Copy the meal to current user's collection first
    copyMealToUser(meal);
  };

  const copyMealToUser = async (meal) => {
    try {
      const token = localStorage.getItem('forkcast_token');
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: `${meal.title} (from ${meal.user?.username})`,
          ingredients: meal.ingredients,
          instructions: meal.instructions,
          imageUrl: meal.imageUrl,
          galleryImages: meal.galleryImages || []
        })
      });

      if (response.ok) {
        const newMeal = await response.json();
        // Refresh user meals
        loadUserMeals();
        // Show success message or notification
        console.log('Meal copied successfully!');
      }
    } catch (error) {
      console.error('Error copying meal:', error);
    }
  };

  const loadMealPlan = async () => {
    try {
      const token = localStorage.getItem('forkcast_token');
      const startDate = format(currentWeek, 'yyyy-MM-dd');
      const endDate = format(addDays(currentWeek, 6), 'yyyy-MM-dd');
      
      const url = `/api/meal-plans?startDate=${startDate}&endDate=${endDate}${showCommunityPlans ? '&includeOthers=true' : ''}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const plans = await response.json();
        
        // Convert array to object for easier lookup
        const planObject = {};
        plans.forEach(plan => {
          const key = `${plan.date}-${plan.mealType}`;
          planObject[key] = {
            id: plan.meal.id,
            title: plan.meal.title,
            imageUrl: plan.meal.imageUrl,
            ingredients: plan.meal.ingredients,
            instructions: plan.meal.instructions,
            isOwn: plan.isOwn,
            user: plan.user,
            planId: plan.id
          };
        });
        
        setMealPlan(planObject);
      }
    } catch (error) {
      console.error('Error loading meal plan:', error);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  const getMealForSlot = (date, mealType) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return mealPlan[`${dateKey}-${mealType}`];
  };

  const addMealToSlot = async (date, mealType, meal) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    
    // Update local state immediately for responsiveness
    setMealPlan(prev => ({
      ...prev,
      [`${dateKey}-${mealType}`]: meal
    }));
    
    // Save to backend
    try {
      const token = localStorage.getItem('forkcast_token');
      const response = await fetch('/api/meal-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: dateKey,
          mealType,
          mealId: meal.id
        })
      });
      
      if (!response.ok) {
        // Revert local state if backend fails
        setMealPlan(prev => {
          const newPlan = { ...prev };
          delete newPlan[`${dateKey}-${mealType}`];
          return newPlan;
        });
        throw new Error('Failed to save meal plan');
      }
    } catch (error) {
      console.error('Error saving meal plan:', error);
      // Could show a toast notification here
    }
    
    setShowMealSelector(false);
    setSelectedSlot(null);
  };

  const removeMealFromSlot = async (date, mealType) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const originalMeal = mealPlan[`${dateKey}-${mealType}`];
    
    // Update local state immediately
    setMealPlan(prev => {
      const newPlan = { ...prev };
      delete newPlan[`${dateKey}-${mealType}`];
      return newPlan;
    });
    
    // Remove from backend
    try {
      const token = localStorage.getItem('forkcast_token');
      const response = await fetch('/api/meal-plans', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: dateKey,
          mealType
        })
      });
      
      if (!response.ok) {
        // Revert local state if backend fails
        if (originalMeal) {
          setMealPlan(prev => ({
            ...prev,
            [`${dateKey}-${mealType}`]: originalMeal
          }));
        }
        throw new Error('Failed to remove meal plan');
      }
    } catch (error) {
      console.error('Error removing meal plan:', error);
      // Could show a toast notification here
    }
  };

  const openMealSelector = (date, mealType) => {
    setSelectedSlot({ date, mealType });
    setShowMealSelector(true);
  };

  const generateWeeklyAISuggestions = async () => {
    try {
      const token = localStorage.getItem('forkcast_token');
      const response = await fetch('/api/meal-suggestions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: `Create a weekly meal plan for ${format(currentWeek, 'MMMM do')} with variety and balance. Include breakfast, lunch, and dinner suggestions that are practical and delicious.`,
          mealType: 'weekly-plan'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
    }
  };

  const navigateWeek = (direction) => {
    setCurrentWeek(prev => addDays(prev, direction * 7));
    // loadMealPlan will be called automatically via useEffect when currentWeek changes
  };

  const getMealTypeColor = (mealType) => {
    switch (mealType) {
      case 'breakfast': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'lunch': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'dinner': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 md:space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          {/* Desktop header (original layout) */}
          <div className="hidden md:flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Weekly Meal Planner
              </CardTitle>
              <CardDescription>
                Plan your meals for the week of {format(currentWeek, 'MMMM do, yyyy')}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigateWeek(-1)}>
                Previous Week
              </Button>
              <Button variant="outline" onClick={() => navigateWeek(1)}>
                Next Week
              </Button>
              <Button 
                variant={showCommunityPlans ? "default" : "outline"}
                onClick={() => {
                  setShowCommunityPlans(!showCommunityPlans);
                  setTimeout(() => loadMealPlan(), 100);
                }}
              >
                {showCommunityPlans ? 'Hide Community' : 'Show Community'}
              </Button>
              <Button onClick={generateWeeklyAISuggestions} className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Weekly Plan
              </Button>
            </div>
          </div>

          {/* Mobile header (compact, tailored) */}
          <div className="md:hidden space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  Weekly Planner
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Week of {format(currentWeek, 'MMM d, yyyy')}
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={generateWeeklyAISuggestions}
                className="flex items-center gap-1.5 shrink-0 h-8 px-3"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-xs">AI Plan</span>
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek(-1)}
                className="h-9 w-9 p-0 shrink-0"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-center text-xs font-medium text-muted-foreground">
                {format(currentWeek, 'MMM d')} – {format(addDays(currentWeek, 6), 'MMM d')}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek(1)}
                className="h-9 w-9 p-0 shrink-0"
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant={showCommunityPlans ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setShowCommunityPlans(!showCommunityPlans);
                  setTimeout(() => loadMealPlan(), 100);
                }}
                className="h-9 px-2.5 shrink-0"
                aria-label="Toggle community plans"
              >
                <Users className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Mobile day picker + single-day view */}
      <div className="md:hidden space-y-3">
        {/* Horizontal day chips */}
        <div className="-mx-1 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-1 pb-1 min-w-max">
            {weekDays.map((date, idx) => {
              const isSelected = idx === selectedDayIndex;
              const isTodayDate = isToday(date);
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`
                    flex flex-col items-center justify-center rounded-xl border transition-all shrink-0
                    min-w-[56px] h-16 px-2
                    ${isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background text-foreground border-border hover:border-primary/40'}
                  `}
                >
                  <span className={`text-[10px] font-medium uppercase tracking-wide ${isSelected ? 'opacity-90' : 'text-muted-foreground'}`}>
                    {format(date, 'EEE')}
                  </span>
                  <span className="text-lg font-semibold leading-none mt-1">
                    {format(date, 'd')}
                  </span>
                  {isTodayDate && !isSelected && (
                    <span className="mt-1 h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day full label */}
        <div className="px-1">
          <h3 className="text-lg font-semibold">
            {format(weekDays[selectedDayIndex], 'EEEE')}
            {isToday(weekDays[selectedDayIndex]) && (
              <span className="ml-2 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full align-middle">
                Today
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">
            {format(weekDays[selectedDayIndex], 'MMMM d, yyyy')}
          </p>
        </div>

        {/* Meal type cards for selected day */}
        <div className="space-y-3">
          {MEAL_TYPES.map(({ value: mealType, label, icon: Icon }) => {
            const date = weekDays[selectedDayIndex];
            const plannedMeal = getMealForSlot(date, mealType);
            return (
              <Card
                key={mealType}
                className="overflow-hidden"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, date, mealType)}
              >
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                  <Badge className={`ml-auto text-[10px] ${getMealTypeColor(mealType)}`}>
                    {mealType}
                  </Badge>
                </div>
                <CardContent className="p-3">
                  {plannedMeal ? (
                    <div className="flex items-center gap-3">
                      {plannedMeal.imageUrl ? (
                        <img
                          src={plannedMeal.imageUrl}
                          alt={plannedMeal.title}
                          className="w-16 h-16 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Icon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-2">
                          {plannedMeal.title}
                        </h4>
                        {plannedMeal.isOwn === false && (
                          <Badge variant="outline" className="mt-1 text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                            by {plannedMeal.user?.username}
                          </Badge>
                        )}
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs flex-1"
                            onClick={() => openMealSelector(date, mealType)}
                          >
                            Change
                          </Button>
                          {plannedMeal.isOwn !== false && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeMealFromSlot(date, mealType)}
                              aria-label="Remove meal"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => openMealSelector(date, mealType)}
                      className="w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed border-muted-foreground/25 rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <Plus className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Add {label.toLowerCase()}</span>
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Calendar Grid (desktop) */}
      <div className="hidden md:grid grid-cols-8 gap-4">
        {/* Time slots header */}
        <div className="space-y-4">
          <div className="h-12"></div> {/* Spacer for date headers */}
          {MEAL_TYPES.map(({ value, label, icon: Icon }) => (
            <Card key={value} className="h-32 flex items-center justify-center">
              <div className="text-center">
                <Icon className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">{label}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Calendar days */}
        {weekDays.map((date) => (
          <div key={date.toISOString()} className="space-y-4">
            {/* Date header */}
            <Card className="h-12 flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm font-medium">{format(date, 'EEE')}</p>
                <p className="text-xs text-muted-foreground">{format(date, 'MMM d')}</p>
              </div>
            </Card>

            {/* Meal slots */}
            {MEAL_TYPES.map(({ value: mealType }) => {
              const plannedMeal = getMealForSlot(date, mealType);
              
              return (
                <Card key={mealType} className="h-32 relative group cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent 
                    className="p-3 h-full"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, date, mealType)}
                  >
                    {plannedMeal ? (
                      <div className="h-full flex flex-col">
                        <div className="flex-1">
                          <h4 className="text-xs font-medium line-clamp-2 mb-1">
                            {plannedMeal.title}
                          </h4>
                          <div className="flex items-center gap-1 mb-1">
                            <Badge className={`text-xs ${getMealTypeColor(mealType)}`}>
                              {MEAL_TYPES.find(t => t.value === mealType)?.label}
                            </Badge>
                            {plannedMeal.isOwn === false && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                by {plannedMeal.user?.username}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                            onClick={() => openMealSelector(date, mealType)}
                          >
                            Change
                          </Button>
                          {plannedMeal.isOwn !== false && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              onClick={() => removeMealFromSlot(date, mealType)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="h-full flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded hover:border-muted-foreground/50 transition-colors"
                        onClick={() => openMealSelector(date, mealType)}
                      >
                        <div className="text-center">
                          <Plus className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Add meal</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}
      </div>

      {/* AI Suggestions */}
      {aiSuggestions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Weekly Meal Plan Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none text-sm">
              {aiSuggestions.split('\n').map((line, i) => (
                <p key={i} className="mb-2">{line}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meal Selector Dialog */}
      <Dialog open={showMealSelector} onOpenChange={setShowMealSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Select Meal for {selectedSlot && format(selectedSlot.date, 'EEEE, MMMM do')} - {' '}
              {selectedSlot && MEAL_TYPES.find(t => t.value === selectedSlot.mealType)?.label}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {loadingMeals ? (
              <p className="text-center text-muted-foreground">Loading meals...</p>
            ) : (
              <div className="space-y-4">
                {/* User's own meals */}
                {userMeals.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-sm">Your Meals</h4>
                    <div className="space-y-2">
                      {userMeals.map((meal) => (
                        <Card 
                          key={meal.id} 
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, meal)}
                          onClick={() => selectedSlot && addMealToSlot(selectedSlot.date, selectedSlot.mealType, meal)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              {meal.imageUrl && (
                                <img 
                                  src={meal.imageUrl} 
                                  alt={meal.title}
                                  className="w-12 h-12 object-cover rounded"
                                />
                              )}
                              <div className="flex-1">
                                <h4 className="font-medium">{meal.title}</h4>
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {meal.ingredients.split('\n')[0]}
                                </p>
                              </div>
                              <Badge className="text-xs bg-green-100 text-green-800">
                                Yours
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Community meals */}
                {showCommunityPlans && allMeals.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-sm">Community Meals</h4>
                    <div className="space-y-2">
                      {allMeals.filter(meal => {
                        const currentUserId = JSON.parse(localStorage.getItem('forkcast_user') || '{}').id;
                        // Filter out meals by current user
                        if (meal.userId === currentUserId) return false;
                        
                        // Filter out meals that the user has already copied (check if user has a meal with "(from username)" in title)
                        const hasCopiedMeal = userMeals.some(userMeal => 
                          userMeal.title.includes(`(from ${meal.user?.username})`) && 
                          userMeal.ingredients === meal.ingredients &&
                          userMeal.instructions === meal.instructions
                        );
                        
                        return !hasCopiedMeal;
                      }).map((meal) => (
                        <Card 
                          key={meal.id} 
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, meal)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              {meal.imageUrl && (
                                <img 
                                  src={meal.imageUrl} 
                                  alt={meal.title}
                                  className="w-12 h-12 object-cover rounded"
                                />
                              )}
                              <div className="flex-1">
                                <h4 className="font-medium">{meal.title}</h4>
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {meal.ingredients.split('\n')[0]}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  by {meal.user?.username}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToMealPlan(meal);
                                  }}
                                  className="h-6 px-2 text-xs"
                                >
                                  Copy
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {userMeals.length === 0 && (!showCommunityPlans || allMeals.length === 0) && (
                  <p className="text-center text-muted-foreground">
                    No meals available. Create some meals first!
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}