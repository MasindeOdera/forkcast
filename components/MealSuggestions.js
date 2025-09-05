'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChefHat, Clock, Star, Copy, Check } from 'lucide-react';
import MealSuggestionForm from './MealSuggestionForm';

export default function MealSuggestions() {
  const [suggestions, setSuggestions] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (suggestions) {
      await navigator.clipboard.writeText(suggestions);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const clearSuggestions = () => {
    setSuggestions('');
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <MealSuggestionForm onSuggestionsReceived={setSuggestions} />
      
      {suggestions && (
        <Card className="w-full">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-primary" />
                Your AI Meal Suggestions
              </CardTitle>
              <CardDescription>
                Based on your preferences, here are some personalized meal ideas
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
    </div>
  );
}