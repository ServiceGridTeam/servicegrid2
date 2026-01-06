import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePortalAuth } from '@/hooks/usePortalAuth';

type ValidationState = 'validating' | 'success' | 'error';

export default function MagicLinkLanding() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { validateMagicLink, error } = usePortalAuth();
  const [validationState, setValidationState] = useState<ValidationState>('validating');
  const [customerName, setCustomerName] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setValidationState('error');
      return;
    }

    const validate = async () => {
      const result = await validateMagicLink(token);
      
      if (result.success) {
        setValidationState('success');
        // Brief pause to show success state
        setTimeout(() => {
          navigate('/portal', { replace: true });
        }, 1000);
      } else {
        setValidationState('error');
      }
    };

    validate();
  }, [token, validateMagicLink, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="border-border/50 shadow-xl">
          <CardContent className="pt-8 pb-8">
            {validationState === 'validating' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Signing you in...</h2>
                <p className="text-muted-foreground text-sm">
                  Please wait while we verify your link
                </p>
              </motion.div>
            )}

            {validationState === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="text-center"
              >
                <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h2 className="text-xl font-semibold mb-2">
                  {customerName ? `Welcome back, ${customerName}!` : 'Welcome!'}
                </h2>
                <p className="text-muted-foreground text-sm">
                  Redirecting to your portal...
                </p>
              </motion.div>
            )}

            {validationState === 'error' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Link expired or invalid</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  {error || 'This link may have already been used or has expired.'}
                </p>
                <Button onClick={() => navigate('/portal/login')} className="w-full">
                  Request a new link
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
