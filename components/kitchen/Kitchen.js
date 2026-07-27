'use client';

/**
 * components/kitchen/Kitchen.js
 * -----------------------------
 * Top-level container for the Kitchen tab. Owns the sub-tabs
 * (Shopping List / Pantry) and nothing else — sub-components are
 * responsible for their own data.
 */

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShoppingCart, Package } from 'lucide-react';
import ShoppingList from './ShoppingList';
import Pantry from './Pantry';

export default function Kitchen() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <Tabs defaultValue="shopping" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="shopping" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Shopping List</span>
          </TabsTrigger>
          <TabsTrigger value="pantry" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Pantry</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shopping" className="space-y-6">
          <ShoppingList />
        </TabsContent>
        <TabsContent value="pantry" className="space-y-6">
          <Pantry />
        </TabsContent>
      </Tabs>
    </div>
  );
}
