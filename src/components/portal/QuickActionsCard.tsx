import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, CreditCard, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePortalBasePath } from '@/hooks/usePortalBasePath';

export function QuickActionsCard() {
  const { buildPath, isPreviewMode } = usePortalBasePath();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {!isPreviewMode && (
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button asChild variant="outline" className="justify-start h-auto py-3 w-full">
                <Link to={buildPath('/request-service')} className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Request Service</p>
                    <p className="text-xs text-muted-foreground">Schedule a new job</p>
                  </div>
                </Link>
              </Button>
            </motion.div>
          )}

          <motion.div whileTap={{ scale: 0.98 }}>
            <Button asChild variant="outline" className="justify-start h-auto py-3 w-full">
              <Link to={buildPath('/documents?tab=invoices')} className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <CreditCard className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Pay Invoice</p>
                  <p className="text-xs text-muted-foreground">View and pay invoices</p>
                </div>
              </Link>
            </Button>
          </motion.div>

          {!isPreviewMode && (
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button asChild variant="outline" className="justify-start h-auto py-3 w-full">
                <Link to={buildPath('/account')} className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <MessageCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Contact Support</p>
                    <p className="text-xs text-muted-foreground">Get help from the team</p>
                  </div>
                </Link>
              </Button>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default QuickActionsCard;
