import { Outlet, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePortalSession } from '@/hooks/usePortalSession';
import { PortalHeader } from './PortalHeader';
import { PortalNav } from './PortalNav';
import { Skeleton } from '@/components/ui/skeleton';

export function PortalLayout() {
  const { isAuthenticated, isLoading, businesses, activeBusinessId } = usePortalSession();

  // Show skeleton while validating session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/portal/login" replace />;
  }

  // Find current business for branding
  const currentBusiness = businesses.find(b => b.businessId === activeBusinessId);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PortalHeader 
        businessName={currentBusiness?.businessName || 'Customer Portal'}
        logoUrl={currentBusiness?.logoUrl}
        businesses={businesses}
        activeBusinessId={activeBusinessId}
      />
      
      <PortalNav />
      
      <main className="flex-1 container mx-auto px-4 py-6">
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
      </main>

      <footer className="border-t border-border bg-card py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Need help? Contact {currentBusiness?.businessName || 'support'}</p>
        </div>
      </footer>
    </div>
  );
}

export default PortalLayout;
