import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePortalPreviewSession } from '@/hooks/usePortalPreviewSession';

export function PreviewBanner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { customerName, email } = usePortalPreviewSession();
  
  const customerId = searchParams.get('customerId');

  const handleExit = () => {
    // Navigate back to customer detail if we have customerId, otherwise to customers list
    if (customerId) {
      navigate(`/customers/${customerId}`);
    } else {
      navigate('/customers');
    }
  };

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-medium">
            Preview Mode
            {customerName && (
              <span className="hidden sm:inline">
                {' '}— Viewing as {customerName}
                {email && <span className="opacity-75"> ({email})</span>}
              </span>
            )}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExit}
          className="h-7 text-amber-950 hover:bg-amber-600 hover:text-amber-950"
        >
          <X className="h-4 w-4 mr-1" />
          Exit Preview
        </Button>
      </div>
    </div>
  );
}

export default PreviewBanner;
