'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Save, Plus } from 'lucide-react';
import ImageUpload from './ImageUpload';
import GalleryUpload from './GalleryUpload';

export default function MealForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData = null,
  isLoading = false 
}) {
  const [formData, setFormData] = useState({
    title: '',
    ingredients: '',
    instructions: '',
    imageUrl: null,
    galleryImages: []
  });
  const [formErrors, setFormErrors] = useState({});

  // Reset form when dialog opens/closes or initial data changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        ingredients: typeof initialData.ingredients === 'string' 
          ? initialData.ingredients 
          : Array.isArray(initialData.ingredients) 
            ? initialData.ingredients.join('\n')
            : '',
        instructions: typeof initialData.instructions === 'string'
          ? initialData.instructions
          : Array.isArray(initialData.instructions)
            ? initialData.instructions.join('\n')
            : '',
        imageUrl: initialData.imageUrl || null,
        galleryImages: initialData.galleryImages || []
      });
    } else {
      setFormData({
        title: '',
        ingredients: '',
        instructions: '',
        imageUrl: null,
        galleryImages: []
      });
    }
    // Whenever the dialog opens or the initial data changes, wipe out any
    // stale validation errors from the previous session.
    setFormErrors({});
  }, [initialData, isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear the inline error for a field the moment the user starts fixing it.
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleImageUpload = (imageUrl) => {
    setFormData({
      ...formData,
      imageUrl
    });
  };

  const handleGalleryUpload = (galleryImages) => {
    setFormData({
      ...formData,
      galleryImages
    });
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Meal title is required';
    } else if (formData.title.trim().length < 3) {
      errors.title = 'Give your meal a name at least 3 characters long';
    }
    
    if (!formData.ingredients.trim()) {
      errors.ingredients = 'Ingredients list is required';
    } else if (formData.ingredients.trim().length < 10) {
      errors.ingredients = 'Please provide more detailed ingredients (at least 10 characters)';
    }
    
    if (!formData.instructions.trim()) {
      errors.instructions = 'Cooking instructions are required';
    } else if (formData.instructions.trim().length < 20) {
      errors.instructions = 'Please provide more detailed instructions (at least 20 characters)';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
  };

  const isEditing = !!initialData;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Save className="h-5 w-5" />
                Edit Meal
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Add New Meal
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Meal Title *</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g., Homemade Spaghetti Carbonara"
              value={formData.title}
              onChange={handleInputChange}
              className={formErrors.title ? 'border-destructive' : ''}
              required
            />
            {formErrors.title && (
              <p className="text-sm text-destructive">{formErrors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Meal Photo</Label>
            <ImageUpload
              onUploadComplete={handleImageUpload}
              existingImage={formData.imageUrl}
            />
          </div>

          <div className="space-y-2">
            <Label>Gallery Photos (Optional)</Label>
            <GalleryUpload
              onGalleryChange={handleGalleryUpload}
              existingImages={formData.galleryImages}
            />
            <p className="text-xs text-muted-foreground">
              Add extra photos to showcase your meal from different angles
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ingredients">Ingredients *</Label>
            <Textarea
              id="ingredients"
              name="ingredients"
              placeholder="List ingredients, one per line:
- 400g spaghetti
- 200g pancetta
- 4 large eggs
- 100g Parmesan cheese
- Black pepper to taste"
              value={formData.ingredients}
              onChange={handleInputChange}
              rows={6}
              className={formErrors.ingredients ? 'border-destructive' : ''}
              aria-invalid={!!formErrors.ingredients}
              aria-describedby={formErrors.ingredients ? 'ingredients-error' : 'ingredients-hint'}
              required
            />
            {formErrors.ingredients ? (
              <p id="ingredients-error" className="text-sm text-destructive">
                {formErrors.ingredients}
              </p>
            ) : (
              <p id="ingredients-hint" className="text-xs text-muted-foreground">
                List each ingredient on a new line
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Cooking Instructions *</Label>
            <Textarea
              id="instructions"
              name="instructions"
              placeholder="Step-by-step instructions:
1. Boil the spaghetti according to package directions
2. While pasta cooks, fry pancetta until crispy
3. Beat eggs with grated Parmesan and black pepper
4. Drain pasta, reserving some pasta water
5. Mix hot pasta with pancetta and egg mixture
6. Add pasta water if needed for creaminess"
              value={formData.instructions}
              onChange={handleInputChange}
              rows={8}
              className={formErrors.instructions ? 'border-destructive' : ''}
              aria-invalid={!!formErrors.instructions}
              aria-describedby={formErrors.instructions ? 'instructions-error' : 'instructions-hint'}
              required
            />
            {formErrors.instructions ? (
              <p id="instructions-error" className="text-sm text-destructive">
                {formErrors.instructions}
              </p>
            ) : (
              <p id="instructions-hint" className="text-xs text-muted-foreground">
                Write clear, step-by-step instructions. No need to number steps - just separate each step with a line break.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading || !formData.title.trim() || !formData.ingredients.trim() || !formData.instructions.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEditing ? 'Update Meal' : 'Create Meal'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}