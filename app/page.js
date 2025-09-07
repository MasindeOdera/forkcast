'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Search, 
  User, 
  LogOut, 
  ChefHat, 
  Users, 
  Loader2,
  UtensilsCrossed,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

import AuthForm from '@/components/AuthForm';
import MealCard from '@/components/MealCard';
import MealForm from '@/components/MealForm';
import MealSuggestions from '@/components/MealSuggestions';

export default function App() {
  const [user, setUser] = useState(null);
  const [meals, setMeals] = useState([]);
  const [myMeals, setMyMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('discover');
  const [showMealForm, setShowMealForm] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for existing authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('forkcast_token');
    const userData = localStorage.getItem('forkcast_user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('forkcast_token');
        localStorage.removeItem('forkcast_user');
      }
    }
    
    setLoading(false);
  }, []);

  // Load meals when user changes or tab changes
  useEffect(() => {
    if (user) {
      loadMeals();
    }
  }, [user, activeTab]);

  const loadMeals = async () => {
    try {
      const token = localStorage.getItem('forkcast_token');
      
      // Load all meals for discovery
      const allMealsResponse = await fetch('/api/meals', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (allMealsResponse.ok) {
        const allMealsData = await allMealsResponse.json();
        setMeals(allMealsData);
      }

      // Load user's own meals
      const myMealsResponse = await fetch(`/api/meals?userId=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (myMealsResponse.ok) {
        const myMealsData = await myMealsResponse.json();
        setMyMeals(myMealsData);
      }
    } catch (error) {
      console.error('Error loading meals:', error);
      toast.error('Failed to load meals');
    }
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    toast.success(`Welcome ${userData.username}!`);
  };

  const handleLogout = () => {
    localStorage.removeItem('forkcast_token');
    localStorage.removeItem('forkcast_user');
    setUser(null);
    setMeals([]);
    setMyMeals([]);
    toast.success('Logged out successfully');
  };

  const handleMealSubmit = async (formData) => {
    setIsSubmitting(true);
    
    try {
      const token = localStorage.getItem('forkcast_token');
      const url = editingMeal ? `/api/meals/${editingMeal.id}` : '/api/meals';
      const method = editingMeal ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      let errorData;
      
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        // If it's not JSON, it might be an HTML error page
        const textResponse = await response.text();
        console.error('Non-JSON response:', textResponse);
        throw new Error('Server returned an unexpected response. Please try again.');
      }

      if (!response.ok) {
        if (errorData.details && Array.isArray(errorData.details)) {
          throw new Error(`${errorData.error}\n• ${errorData.details.join('\n• ')}`);
        }
        throw new Error(errorData.error || 'Failed to save meal');
      }

      const savedMeal = errorData; // It's actually the saved meal data
      
      toast.success(editingMeal ? 'Meal updated successfully! 🎉' : 'Meal created successfully! 🎉');
      
      // Refresh meals
      await loadMeals();
      
      // Close form and reset editing state
      setShowMealForm(false);
      setEditingMeal(null);
      
      // Switch to My Meals tab if creating new meal
      if (!editingMeal) {
        setActiveTab('my-meals');
      }
    } catch (error) {
      console.error('Error saving meal:', error);
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMeal = (meal) => {
    setEditingMeal(meal);
    setShowMealForm(true);
  };

  const handleDeleteMeal = async (meal) => {
    if (!confirm('Are you sure you want to delete this meal?')) {
      return;
    }

    try {
      const token = localStorage.getItem('forkcast_token');
      const response = await fetch(`/api/meals/${meal.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete meal');
      }

      toast.success('Meal deleted successfully');
      await loadMeals();
    } catch (error) {
      console.error('Error deleting meal:', error);
      toast.error(error.message);
    }
  };

  const handleAddToMealPlan = async (meal) => {
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
        toast.success(`"${meal.title}" copied to your collection! 🎉`);
        // Refresh meals
        await loadMeals();
      } else {
        throw new Error('Failed to copy meal');
      }
    } catch (error) {
      console.error('Error copying meal:', error);
      toast.error('Failed to copy meal. Please try again.');
    }
  };

  const filteredMeals = meals.filter(meal => {
    // First apply search filter
    const matchesSearch = meal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meal.ingredients.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meal.user?.username.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Filter out user's own meals from discover tab
    if (meal.userId === user.id) return false;
    
    // Filter out meals that the user has already copied (check if user has a meal with "(from username)" in title)
    const hasCopiedMeal = myMeals.some(userMeal => 
      userMeal.title.includes(`(from ${meal.user?.username})`) && 
      userMeal.ingredients === meal.ingredients &&
      userMeal.instructions === meal.instructions
    );
    
    return !hasCopiedMeal;
  });

  const filteredMyMeals = myMeals.filter(meal =>
    meal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    meal.ingredients.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🍴 <span>Forkcast</span>
            </h1>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              Beta
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                setEditingMeal(null);
                setShowMealForm(true);
              }}
              size="sm"
              className="hidden sm:flex"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Meal
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {user.username?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{user.username}</p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground">
                      {user.email || 'Meal planning enthusiast'}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={loadMeals}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <div className="flex flex-col gap-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search meals, ingredients, or chefs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="discover" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Discover</span>
                </TabsTrigger>
                <TabsTrigger value="my-meals" className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4" />
                  <span className="hidden sm:inline">My Meals</span>
                  <Badge variant="secondary" className="ml-1">
                    {myMeals.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="ai-suggestions" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">AI Ideas</span>
                  <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary">
                    AI
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <Button
                onClick={() => {
                  setEditingMeal(null);
                  setShowMealForm(true);
                }}
                size="sm"
                className="sm:hidden"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <TabsContent value="discover" className="space-y-6">
              {filteredMeals.length === 0 ? (
                <div className="text-center py-12">
                  <UtensilsCrossed className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No meals found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? 'Try adjusting your search terms' : 'Be the first to share a meal!'}
                  </p>
                  <Button 
                    className="mt-4"
                    onClick={() => {
                      setEditingMeal(null);
                      setShowMealForm(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Meal
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredMeals.map((meal) => (
                    <MealCard
                      key={meal.id}
                      meal={meal}
                      currentUserId={user.id}
                      onEdit={handleEditMeal}
                      onDelete={handleDeleteMeal}
                      onAddToMealPlan={handleAddToMealPlan}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="my-meals" className="space-y-6">
              {filteredMyMeals.length === 0 ? (
                <div className="text-center py-12">
                  <ChefHat className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No meals yet</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No meals match your search' : 'Start building your recipe collection!'}
                  </p>
                  <Button 
                    className="mt-4"
                    onClick={() => {
                      setEditingMeal(null);
                      setShowMealForm(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Meal
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredMyMeals.map((meal) => (
                    <MealCard
                      key={meal.id}
                      meal={meal}
                      currentUserId={user.id}
                      onEdit={handleEditMeal}
                      onDelete={handleDeleteMeal}
                      onAddToMealPlan={handleAddToMealPlan}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="ai-suggestions" className="space-y-6">
              <div className="flex items-center justify-center">
                <MealSuggestions />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Meal Form Dialog */}
      <MealForm
        isOpen={showMealForm}
        onClose={() => {
          setShowMealForm(false);
          setEditingMeal(null);
        }}
        onSubmit={handleMealSubmit}
        initialData={editingMeal}
        isLoading={isSubmitting}
      />
    </div>
  );
}