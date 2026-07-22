'use client';

import { useState, useEffect, useCallback } from 'react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  LogOut,
  ChefHat,
  Users,
  Loader2,
  UtensilsCrossed,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CalendarDays,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import AuthForm from '@/components/AuthForm';
import MealCard from '@/components/MealCard';
import MealForm from '@/components/MealForm';
import MealSuggestions from '@/components/MealSuggestions';
import { EmptyState } from '@/components/ui/empty-state';
import { MealCardGrid } from '@/components/ui/meal-card-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';

export default function App() {
  // ─── Auth state ─────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ─── Data state ─────────────────────────────────────────────────────
  const [meals, setMeals] = useState([]);
  const [myMeals, setMyMeals] = useState([]);

  // Fine-grained request-status: 'idle' | 'loading' | 'success' | 'error'.
  // Distinguishing these unlocks: skeleton on first load, cached data +
  // subtle refresh spinner on subsequent loads, and a proper error card
  // (with a "Try again" CTA) when the fetch actually failed.
  const [mealsStatus, setMealsStatus] = useState('idle');
  const [mealsError, setMealsError] = useState(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('discover');
  const [showMealForm, setShowMealForm] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete-confirmation dialog state (replaces window.confirm).
  const [pendingDelete, setPendingDelete] = useState(null); // { meal } | null
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Bootstrap from localStorage ────────────────────────────────────
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

    setAuthLoading(false);
  }, []);

  // ─── Session-expired handler ────────────────────────────────────────
  // Called from any request that comes back with SESSION_EXPIRED. Clears
  // credentials, drops the user back to the login form, and shows ONE
  // clear toast (previous behaviour was to silently render an empty list).
  const handleSessionExpired = useCallback(() => {
    localStorage.removeItem('forkcast_token');
    localStorage.removeItem('forkcast_user');
    setUser(null);
    setMeals([]);
    setMyMeals([]);
    setMealsStatus('idle');
    setMealsError(null);
    toast.error('Your session has expired. Please log in again.');
  }, []);

  // ─── Meals loader ───────────────────────────────────────────────────
  // `isRefresh=true` means "we already have data on screen, just refetch
  // quietly" (no skeleton flash). `isRefresh=false` means "first load, show
  // skeletons".
  const loadMeals = useCallback(
    async (isRefresh = false) => {
      if (!user) return;

      setMealsStatus(isRefresh ? 'success' : 'loading');
      setMealsError(null);

      const [allRes, mineRes] = await Promise.all([
        apiGet('/api/meals'),
        apiGet(`/api/meals?userId=${encodeURIComponent(user.id)}`),
      ]);

      // Any 401 from either call → session expired flow, stop here.
      if (allRes.error?.code === 'SESSION_EXPIRED' || mineRes.error?.code === 'SESSION_EXPIRED') {
        handleSessionExpired();
        return;
      }

      if (!allRes.ok || !mineRes.ok) {
        const err = allRes.error || mineRes.error;
        setMealsStatus('error');
        setMealsError(err);
        // Only toast on a *refresh* failure — on first-load failure the
        // inline error card is the primary signal, so we don't double-up.
        if (isRefresh) toast.error(err?.message || 'Failed to refresh meals.');
        return;
      }

      setMeals(Array.isArray(allRes.data) ? allRes.data : []);
      setMyMeals(Array.isArray(mineRes.data) ? mineRes.data : []);
      setMealsStatus('success');
    },
    [user, handleSessionExpired]
  );

  useEffect(() => {
    if (user) loadMeals(false);
  }, [user, loadMeals]);

  // ─── Handlers ───────────────────────────────────────────────────────
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
    setMealsStatus('idle');
    setMealsError(null);
    toast.success('Logged out successfully');
  };

  const handleMealSubmit = async (formData) => {
    setIsSubmitting(true);
    try {
      const res = editingMeal
        ? await apiPut(`/api/meals/${editingMeal.id}`, formData)
        : await apiPost('/api/meals', formData);

      if (res.error?.code === 'SESSION_EXPIRED') {
        handleSessionExpired();
        return;
      }

      if (!res.ok) {
        // Server-side validation errors come back as { error, details: [] }.
        if (res.data?.details && Array.isArray(res.data.details)) {
          throw new Error(`${res.data.error}\n• ${res.data.details.join('\n• ')}`);
        }
        throw new Error(res.error?.message || 'Failed to save meal.');
      }

      toast.success(editingMeal ? 'Meal updated! 🎉' : 'Meal created! 🎉');
      await loadMeals(true);
      setShowMealForm(false);
      setEditingMeal(null);
      if (!editingMeal) setActiveTab('my-meals');
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

  // Delete now opens a proper confirm dialog instead of native confirm().
  const handleDeleteMeal = (meal) => {
    setPendingDelete({ meal });
  };

  const confirmDeleteMeal = async () => {
    if (!pendingDelete) return;
    const { meal } = pendingDelete;
    setIsDeleting(true);
    try {
      const res = await apiDelete(`/api/meals/${meal.id}`);
      if (res.error?.code === 'SESSION_EXPIRED') {
        handleSessionExpired();
        return;
      }
      if (!res.ok) {
        throw new Error(res.error?.message || 'Failed to delete meal.');
      }
      toast.success('Meal deleted');
      await loadMeals(true);
      setPendingDelete(null);
    } catch (error) {
      console.error('Error deleting meal:', error);
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddToMealPlan = async (meal) => {
    const res = await apiPost('/api/meals', {
      title: `${meal.title} (from ${meal.user?.username})`,
      ingredients: meal.ingredients,
      instructions: meal.instructions,
      imageUrl: meal.imageUrl,
      galleryImages: meal.galleryImages || [],
    });

    if (res.error?.code === 'SESSION_EXPIRED') {
      handleSessionExpired();
      return;
    }

    if (!res.ok) {
      toast.error(res.error?.message || 'Failed to copy meal. Please try again.');
      return;
    }

    toast.success(`"${meal.title}" copied to your collection! 🎉`);
    await loadMeals(true);
  };

  // ─── Derived data ───────────────────────────────────────────────────
  const filteredMeals = meals.filter(
    (meal) =>
      meal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meal.ingredients.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meal.user?.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMyMeals = myMeals.filter(
    (meal) =>
      meal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meal.ingredients.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── Render ─────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={handleAuthSuccess} />;
  }

  // A tiny renderer that picks the right state (loading / error / empty /
  // populated) for a meal list. Keeps the JSX below tight.
  const renderMealSection = ({ items, isMine, searchActive }) => {
    // First-time load: full skeleton grid.
    if (mealsStatus === 'loading') {
      return <MealCardGrid count={6} />;
    }

    // Fetch failed and we have nothing to show → prominent error card.
    if (mealsStatus === 'error' && meals.length === 0 && myMeals.length === 0) {
      return (
        <EmptyState
          variant="error"
          icon={AlertTriangle}
          title="We couldn't load your meals"
          description={
            mealsError?.message ||
            'Something went wrong on our end. Please try again in a moment.'
          }
          action={{
            label: 'Try again',
            icon: RefreshCw,
            onClick: () => loadMeals(false),
          }}
        />
      );
    }

    // Empty (either no data at all, or search filtered everything out).
    if (items.length === 0) {
      if (searchActive) {
        return (
          <EmptyState
            icon={Search}
            title="No matches"
            description={`No meals match "${searchQuery}". Try a different search term.`}
            action={{ label: 'Clear search', onClick: () => setSearchQuery('') }}
          />
        );
      }
      return (
        <EmptyState
          icon={isMine ? ChefHat : UtensilsCrossed}
          title={isMine ? 'No meals yet' : 'No meals found'}
          description={
            isMine
              ? 'Start building your recipe collection — your creations will show up here.'
              : 'Nobody has shared a meal yet. Be the first!'
          }
          action={{
            label: isMine ? 'Create your first meal' : 'Add your first meal',
            icon: Plus,
            onClick: () => {
              setEditingMeal(null);
              setShowMealForm(true);
            },
          }}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((meal) => (
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
    );
  };

  const isRefreshing = mealsStatus === 'loading' && meals.length + myMeals.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🍴 <span>Forkcast</span>
            </h1>
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
                <DropdownMenuItem onClick={() => loadMeals(true)} disabled={mealsStatus === 'loading'}>
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${mealsStatus === 'loading' ? 'animate-spin' : ''}`}
                  />
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

          {/* Refresh indicator when refetching over existing data */}
          {isRefreshing && (
            <div
              className="flex items-center gap-2 text-xs text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              Refreshing meals…
            </div>
          )}

          {/* Non-blocking error banner: we have data but the last refresh failed. */}
          {mealsStatus === 'error' && (meals.length > 0 || myMeals.length > 0) && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm"
            >
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <span>{mealsError?.message || 'Refresh failed. Showing cached meals.'}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => loadMeals(false)}>
                <RefreshCw className="mr-2 h-3 w-3" />
                Retry
              </Button>
            </div>
          )}

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
                {/*
                  Renamed from "AI Ideas" → "Plan" because this tab hosts
                  both AI ideation AND the Weekly Planner (calendar). "Plan"
                  covers both without being AI-specific.
                */}
                <TabsTrigger value="ai-suggestions" className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span className="hidden sm:inline">Plan</span>
                  <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary gap-1">
                    <Sparkles className="h-3 w-3" />
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
              {renderMealSection({
                items: filteredMeals,
                isMine: false,
                searchActive: !!searchQuery,
              })}
            </TabsContent>

            <TabsContent value="my-meals" className="space-y-6">
              {renderMealSection({
                items: filteredMyMeals,
                isMine: true,
                searchActive: !!searchQuery,
              })}
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

      {/* Delete confirmation dialog (replaces window.confirm) */}
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o && !isDeleting) setPendingDelete(null);
        }}
        title="Delete this meal?"
        description={
          pendingDelete ? (
            <span>
              This will permanently delete{' '}
              <span className="font-medium text-foreground">
                “{pendingDelete.meal.title}”
              </span>{' '}
              from your collection. This can't be undone.
            </span>
          ) : null
        }
        confirmLabel="Delete meal"
        cancelLabel="Keep it"
        destructive
        loading={isDeleting}
        onConfirm={confirmDeleteMeal}
      />
    </div>
  );
}
