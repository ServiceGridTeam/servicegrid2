import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomerServiceRequestForm } from '@/components/portal/CustomerServiceRequestForm';

export default function PortalServiceRequest() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate('/portal/schedule')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Schedule
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Request Service</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerServiceRequestForm 
              onSuccess={() => navigate('/portal/schedule')}
            />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
