import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, X, Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { useOptimisticServiceRequest } from '@/hooks/useOptimisticServiceRequest';
import { cn } from '@/lib/utils';

const SERVICE_TYPES = [
  { value: 'repair', label: 'Repair' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'installation', label: 'Installation' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

const URGENCY_OPTIONS = [
  { value: 'low', label: 'Low', description: 'When convenient' },
  { value: 'normal', label: 'Normal', description: 'Within a week' },
  { value: 'high', label: 'High', description: 'Within 1-2 days' },
  { value: 'emergency', label: 'Emergency', description: 'ASAP' },
];

const TIME_OPTIONS = [
  { value: 'morning', label: 'Morning', description: '8am - 12pm' },
  { value: 'afternoon', label: 'Afternoon', description: '12pm - 5pm' },
  { value: 'evening', label: 'Evening', description: '5pm - 8pm' },
  { value: 'flexible', label: 'Flexible', description: 'Any time' },
];

interface CustomerServiceRequestFormProps {
  onSuccess?: () => void;
}

export function CustomerServiceRequestForm({ onSuccess }: CustomerServiceRequestFormProps) {
  const [serviceType, setServiceType] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'normal' | 'high' | 'emergency'>('normal');
  const [preferredTimes, setPreferredTimes] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { photos, addPhotos, removePhoto, retryUpload, getUrls, isUploading, canAddMore, maxPhotos } = usePhotoUpload();
  const { submit, isPending } = useOptimisticServiceRequest();

  const toggleTime = (time: string) => {
    setPreferredTimes(prev => 
      prev.includes(time) 
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addPhotos(e.target.files);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    submit({
      serviceType: serviceType || undefined,
      description,
      urgency,
      preferredTimes: preferredTimes.length > 0 ? preferredTimes : undefined,
      photoUrls: getUrls(),
    }, {
      onSuccess: () => {
        setIsSubmitted(true);
        onSuccess?.();
      },
    });
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        >
          <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
        </motion.div>
        <h3 className="text-xl font-semibold mb-2">Request Submitted!</h3>
        <p className="text-muted-foreground">
          We'll review your request and get back to you soon.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Service Type */}
      <div className="space-y-2">
        <Label>Service Type</Label>
        <Select value={serviceType} onValueChange={setServiceType}>
          <SelectTrigger>
            <SelectValue placeholder="Select a service type" />
          </SelectTrigger>
          <SelectContent>
            {SERVICE_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          placeholder="Please describe what you need help with..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          required
        />
      </div>

      {/* Urgency */}
      <div className="space-y-2">
        <Label>Urgency</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {URGENCY_OPTIONS.map(option => (
            <motion.button
              key={option.value}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setUrgency(option.value as typeof urgency)}
              className={cn(
                'p-3 rounded-lg border text-left transition-colors',
                urgency === option.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-muted-foreground">{option.description}</div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Preferred Times */}
      <div className="space-y-2">
        <Label>Preferred Times</Label>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map(option => (
            <motion.button
              key={option.value}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleTime(option.value)}
              className={cn(
                'px-4 py-2 rounded-full border text-sm transition-colors',
                preferredTimes.includes(option.value)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {option.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Photo Upload */}
      <div className="space-y-2">
        <Label>Photos (optional)</Label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {photos.map(photo => (
            <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border">
              <img
                src={photo.localUrl}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
              {photo.progress > 0 && photo.progress < 100 && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              {photo.error && (
                <div className="absolute inset-0 bg-destructive/80 flex flex-col items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-destructive-foreground mb-1" />
                  <button
                    type="button"
                    onClick={() => retryUpload(photo.id)}
                    className="text-xs text-destructive-foreground underline"
                  >
                    Retry
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-background"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          
          {canAddMore && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <Camera className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{photos.length}/{maxPhotos}</span>
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full"
        disabled={!description.trim() || isPending || isUploading}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : isUploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Uploading photos...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Submit Request
          </>
        )}
      </Button>
    </form>
  );
}

export default CustomerServiceRequestForm;
