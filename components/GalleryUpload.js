'use client';

import { useState } from 'react';
import { Upload, X, Loader2, Plus, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GalleryUpload({ onGalleryChange, existingImages = [] }) {
  const [uploading, setUploading] = useState(false);
  const [galleryImages, setGalleryImages] = useState(existingImages);
  const [error, setError] = useState(null);

  const handleImageUpload = async (file) => {
    setUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('forkcast_token');
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const data = await response.json();
      
      const newImages = [...galleryImages, data.url];
      setGalleryImages(newImages);
      
      if (onGalleryChange) {
        onGalleryChange(newImages);
      }
      
    } catch (error) {
      console.error('Error uploading image:', error);
      setError(error.message || 'Error uploading image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.includes('image')) {
      setError('Please select an image file');
      return;
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size should be less than 10MB');
      return;
    }

    await handleImageUpload(file);
    
    // Reset the input
    e.target.value = '';
  };

  const removeImage = (indexToRemove) => {
    const newImages = galleryImages.filter((_, index) => index !== indexToRemove);
    setGalleryImages(newImages);
    
    if (onGalleryChange) {
      onGalleryChange(newImages);
    }
  };

  return (
    <div className="space-y-4">
      {/* Gallery Images Grid */}
      {galleryImages.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {galleryImages.map((imageUrl, index) => (
            <div key={index} className="relative group">
              <img
                src={imageUrl}
                alt={`Gallery ${index + 1}`}
                className="w-full h-24 object-cover rounded-md border"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(index)}
                disabled={uploading}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add More Images Button */}
      <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 cursor-pointer hover:border-muted-foreground/50 transition-colors">
        <input
          type="file"
          id="gallery-images"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*"
          disabled={uploading}
        />
        <label htmlFor="gallery-images" className="cursor-pointer text-center">
          {uploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
              <p className="mt-2 text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {galleryImages.length === 0 ? (
                <>
                  <Images className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-foreground">
                    Add gallery photos
                  </p>
                </>
              ) : (
                <>
                  <Plus className="h-6 w-6 text-muted-foreground" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add more photos
                  </p>
                </>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, GIF up to 10MB
              </p>
            </div>
          )}
        </label>
      </div>

      {error && (
        <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}