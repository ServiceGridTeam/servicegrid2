/**
 * Gallery Email Gate
 * Email collection form for gated galleries
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, Loader2 } from 'lucide-react';

interface GalleryEmailGateProps {
  businessName: string;
  logoUrl?: string | null;
  onSubmit: (email: string) => void;
  isLoading?: boolean;
}

export function GalleryEmailGate({
  businessName,
  logoUrl,
  onSubmit,
  isLoading = false,
}: GalleryEmailGateProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    onSubmit(trimmedEmail);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          {/* Logo */}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={businessName}
              className="h-12 w-12 rounded-lg object-cover mx-auto mb-4"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-foreground font-bold text-xl">
                {businessName[0]?.toUpperCase() || 'G'}
              </span>
            </div>
          )}
          
          <CardTitle className="text-xl">{businessName}</CardTitle>
          <CardDescription className="mt-2">
            Enter your email to view the photo gallery
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  className="pl-10"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading Gallery...
                </>
              ) : (
                'View Gallery'
              )}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-4">
            <Lock className="inline h-3 w-3 mr-1" />
            Your email will only be used to track gallery access and will not be shared.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
