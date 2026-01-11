/**
 * Gallery Analytics Page
 * Dedicated route for photo gallery analytics
 */

import { GalleryAnalyticsDashboard } from '@/components/gallery/GalleryAnalyticsDashboard';

export default function GalleryAnalytics() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gallery Analytics</h1>
        <p className="text-muted-foreground">
          Track photo gallery engagement and performance
        </p>
      </div>

      <GalleryAnalyticsDashboard />
    </div>
  );
}
