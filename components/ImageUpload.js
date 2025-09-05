'use client';

import { useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ImageUpload({ onUploadComplete, existingImage = null }) {
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(existingImage);
  const [error, setError] = useState(null);

  const handleImageChange = (e) => {
    setError(null);
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    // Check file type
    if (!file.type.includes('image')) {
      setError('Please select an image file');
      return;
    }
    
    // Check file size (max 10MB for Cloudinary free tier)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size should be less than 10MB');
      return;
    }
    
    // Preview the image
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (file) => {
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
      
      if (onUploadComplete) {
        onUploadComplete(data.url);
      }
      
      setSelectedImage(data.url);
    } catch (error) {
      console.error('Error uploading image:', error);
      setError(error.message || 'Error uploading image. Please try again.');
      setSelectedImage(existingImage);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    handleImageChange(e);
    await handleUpload(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (onUploadComplete) {
      onUploadComplete(null);
    }
  };

  return (
    <div className="space-y-4">
      {selectedImage ? (
        <div className="relative">
          <img
            src={selectedImage}
            alt="Meal preview"
            className="w-full h-48 object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
            onClick={removeImage}
            disabled={uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 cursor-pointer hover:border-muted-foreground/50 transition-colors">
          <input
            type="file"
            id="meal-image"
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*"
            disabled={uploading}
          />
          <label htmlFor="meal-image" className="cursor-pointer text-center">
            {uploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
                <p className="mt-2 text-sm text-muted-foreground">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-foreground">
                  Click to upload meal photo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF up to 10MB
                </p>
              </div>
            )}
          </label>
        </div>
      )}

      {error && (
        <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}