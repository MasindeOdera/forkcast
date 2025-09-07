'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Clock, ChefHat, Eye, Edit, Trash2, ChevronLeft, ChevronRight, Images, Plus, Download, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function MealCard({ meal, currentUserId, onEdit, onDelete, onAddToMealPlan }) {
  const [showDetails, setShowDetails] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const contentRef = useRef(null);
  const isOwner = meal.userId === currentUserId;

  // Combine main image and gallery images
  const allImages = [
    ...(meal.imageUrl ? [meal.imageUrl] : []),
    ...(meal.galleryImages || [])
  ];

  const formatIngredients = (ingredients) => {
    if (typeof ingredients === 'string') {
      return ingredients.split('\n').filter(ingredient => ingredient.trim());
    }
    return Array.isArray(ingredients) ? ingredients : [];
  };

  const formatInstructions = (instructions) => {
    if (typeof instructions === 'string') {
      return instructions.split('\n').filter(instruction => instruction.trim());
    }
    return Array.isArray(instructions) ? instructions : [];
  };

  const navigateImage = (direction) => {
    if (allImages.length <= 1) return;
    
    setCurrentImageIndex(prev => {
      if (direction === 'next') {
        return prev === allImages.length - 1 ? 0 : prev + 1;
      } else {
        return prev === 0 ? allImages.length - 1 : prev - 1;
      }
    });
  };

  const downloadRecipeAsPDF = async () => {
    setIsDownloading(true);
    
    try {
      // Dynamically import the PDF libraries
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      
      // Create a temporary container for PDF content
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.padding = '40px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      
      tempDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2D5016; font-size: 28px; margin-bottom: 10px; font-weight: bold;">${meal.title}</h1>
          <p style="color: #666; font-size: 14px; margin: 5px 0;">by ${meal.user?.username || 'Unknown'}</p>
          <p style="color: #888; font-size: 12px;">Generated from Forkcast • ${new Date().toLocaleDateString()}</p>
        </div>
        
        ${allImages.length > 0 ? `
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${allImages[0]}" style="max-width: 100%; height: 200px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          </div>
        ` : ''}
        
        <div style="margin-bottom: 25px;">
          <h2 style="color: #2D5016; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #2D5016; padding-bottom: 5px;">🥘 Ingredients</h2>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${formatIngredients(meal.ingredients).map(ingredient => 
              `<li style="margin-bottom: 8px; padding-left: 20px; position: relative;">
                <span style="position: absolute; left: 0; color: #2D5016; font-weight: bold;">•</span>
                ${ingredient}
              </li>`
            ).join('')}
          </ul>
        </div>
        
        <div style="margin-bottom: 25px;">
          <h2 style="color: #2D5016; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #2D5016; padding-bottom: 5px;">👨‍🍳 Instructions</h2>
          <ol style="padding-left: 20px; margin: 0;">
            ${formatInstructions(meal.instructions).map((instruction, index) => 
              `<li style="margin-bottom: 12px; line-height: 1.6;">
                <strong style="color: #2D5016;">Step ${index + 1}:</strong> ${instruction}
              </li>`
            ).join('')}
          </ol>
        </div>
        
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 12px;">
          <p>🍴 Happy cooking! Visit Forkcast for more delicious recipes.</p>
        </div>
      `;
      
      document.body.appendChild(tempDiv);
      
      // Convert to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: 'white',
        width: 800,
        windowWidth: 800
      });
      
      // Clean up
      document.body.removeChild(tempDiv);
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add the canvas as image to PDF
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Download the PDF
      const fileName = `${meal.title.replace(/[^a-zA-Z0-9]/g, '_')}_recipe.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image Section with Gallery Navigation */}
      <div className="aspect-video relative overflow-hidden group">
        {allImages.length > 0 ? (
          <>
            <img
              src={allImages[currentImageIndex]}
              alt={meal.title}
              className="w-full h-full object-cover"
            />
            
            {/* Image Navigation */}
            {allImages.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => navigateImage('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => navigateImage('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                {/* Image Counter */}
                <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                  {currentImageIndex + 1} / {allImages.length}
                </div>
              </>
            )}
            
            {/* Gallery Badge */}
            {allImages.length > 1 && (
              <Badge className="absolute top-2 left-2 bg-black/50 text-white border-none">
                <Images className="h-3 w-3 mr-1" />
                {allImages.length}
              </Badge>
            )}
          </>
        ) : (
          // Placeholder for meals without images
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <ChefHat className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm font-medium">No Photo</p>
            </div>
          </div>
        )}
      </div>
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg line-clamp-2">{meal.title}</CardTitle>
          {isOwner && (
            <div className="flex gap-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit?.(meal)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete?.(meal)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">
              {meal.user?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <span>{meal.user?.username || 'Unknown'}</span>
          <span>•</span>
          <Clock className="h-3 w-3" />
          <span>{formatDistanceToNow(new Date(meal.createdAt), { addSuffix: true })}</span>
        </div>
      </CardHeader>
      
      <CardContent className="pb-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {formatIngredients(meal.ingredients).length} ingredients
            </span>
            {allImages.length > 1 && (
              <>
                <span>•</span>
                <Images className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {allImages.length} photos
                </span>
              </>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-2">
            {formatInstructions(meal.instructions)[0] || 'No instructions available'}
          </p>
        </div>
      </CardContent>
      
      <CardFooter>
        <div className="flex flex-col gap-2 w-full">
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Eye className="mr-2 h-4 w-4" />
                View Recipe
              </Button>
            </DialogTrigger>
            
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="text-xl">{meal.title}</DialogTitle>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>by {meal.user?.username}</span>
                  <span>•</span>
                  <Clock className="h-4 w-4" />
                  <span>{formatDistanceToNow(new Date(meal.createdAt), { addSuffix: true })}</span>
                </div>
              </DialogHeader>
              
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-6">
                  {/* Gallery Section in Dialog */}
                  {allImages.length > 0 && (
                    <div className="space-y-4">
                      <img
                        src={allImages[currentImageIndex]}
                        alt={meal.title}
                        className="w-full h-64 object-cover rounded-lg"
                      />
                      
                      {/* Thumbnail Navigation */}
                      {allImages.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {allImages.map((image, index) => (
                            <img
                              key={index}
                              src={image}
                              alt={`${meal.title} ${index + 1}`}
                              className={`w-16 h-16 object-cover rounded cursor-pointer flex-shrink-0 border-2 transition-all ${
                                index === currentImageIndex 
                                  ? 'border-primary ring-2 ring-primary/20' 
                                  : 'border-transparent hover:border-muted-foreground'
                              }`}
                              onClick={() => setCurrentImageIndex(index)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <ChefHat className="h-5 w-5" />
                      Ingredients
                    </h3>
                    <ul className="space-y-1">
                      {formatIngredients(meal.ingredients).map((ingredient, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span className="text-sm">{ingredient}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Instructions
                    </h3>
                    <ol className="space-y-2">
                      {formatInstructions(meal.instructions).map((instruction, index) => (
                        <li key={index} className="flex gap-3">
                          <Badge variant="outline" className="min-w-[1.5rem] h-6 text-xs">
                            {index + 1}
                          </Badge>
                          <span className="text-sm flex-1">{instruction}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
          
          {/* Add to Meal Plan button for non-owner meals - now below View Recipe */}
          {!isOwner && onAddToMealPlan && (
            <Button 
              variant="default" 
              size="sm"
              onClick={() => onAddToMealPlan(meal)}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add to Plan
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}