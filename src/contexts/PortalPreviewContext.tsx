import { createContext, useContext, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

interface PortalPreviewState {
  isPreviewMode: boolean;
  customerId: string | null;
  businessId: string | null;
}

const PortalPreviewContext = createContext<PortalPreviewState>({
  isPreviewMode: false,
  customerId: null,
  businessId: null,
});

export function usePortalPreview() {
  return useContext(PortalPreviewContext);
}

interface PortalPreviewProviderProps {
  children: ReactNode;
}

export function PortalPreviewProvider({ children }: PortalPreviewProviderProps) {
  const [searchParams] = useSearchParams();
  
  const customerId = searchParams.get('customerId');
  const businessId = searchParams.get('businessId');
  
  const value: PortalPreviewState = {
    isPreviewMode: true,
    customerId,
    businessId,
  };
  
  return (
    <PortalPreviewContext.Provider value={value}>
      {children}
    </PortalPreviewContext.Provider>
  );
}

export default PortalPreviewContext;
