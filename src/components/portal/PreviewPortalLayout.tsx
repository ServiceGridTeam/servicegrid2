import { Outlet, Navigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PortalPreviewProvider } from '@/contexts/PortalPreviewContext';
import { usePortalPreviewSession } from '@/hooks/usePortalPreviewSession';
import { PreviewBanner } from './PreviewBanner';
import { PortalHeader } from './PortalHeader';
import { PortalNav } from './PortalNav';
import { PortalErrorBoundary } from './PortalErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';

function PreviewPortalContent() {
  const [searchParams] = useSearchParams();
  const { isLoading, businesses, activeBusinessId } = usePortalPreviewSession();
  
  const customerId = searchParams.get('customerId');
  const businessId = searchParams.get('businessId');

  // Redirect if missing required params
  if (!customerId || !businessId) {
    return <Navigate to="/customers" replace />;
  }

  // Show skeleton while loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PreviewBanner />
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Find current business for branding
  const currentBusiness = businesses.find(b => b.businessId === activeBusinessId);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PreviewBanner />
      
      <PortalHeader 
        businessName={currentBusiness?.businessName || 'Customer Portal'}
        logoUrl={currentBusiness?.logoUrl}
        businesses={businesses}
        activeBusinessId={activeBusinessId}
      />
      
      <PortalNav />
      
      <main className="flex-1 container mx-auto px-4 py-6">
        <PortalErrorBoundary>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeBusinessId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </PortalErrorBoundary>
      </main>

      <footer className="border-t border-border bg-card py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Preview Mode — This is how customers see their portal</p>
        </div>
      </footer>
    </div>
  );
}

export function PreviewPortalLayout() {
  return (
    <PortalPreviewProvider>
      <PreviewPortalContent />
    </PortalPreviewProvider>
  );
}

export default PreviewPortalLayout;
