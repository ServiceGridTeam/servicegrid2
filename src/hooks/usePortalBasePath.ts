import { useLocation } from 'react-router-dom';

export function usePortalBasePath() {
  const location = useLocation();
  const isPreviewMode = location.pathname.startsWith('/portal/preview');
  
  // Preserve query params (customerId, businessId) in preview mode
  const searchParams = isPreviewMode ? location.search : '';
  
  return {
    basePath: isPreviewMode ? '/portal/preview' : '/portal',
    isPreviewMode,
    // Helper to build full path with query params preserved
    buildPath: (subPath: string) => {
      const normalizedSubPath = subPath.startsWith('/') ? subPath : `/${subPath}`;
      const path = isPreviewMode 
        ? `/portal/preview${normalizedSubPath === '/' ? '' : normalizedSubPath}` 
        : `/portal${normalizedSubPath === '/' ? '' : normalizedSubPath}`;
      
      // For preview mode, append search params if not already in subPath
      if (isPreviewMode && !subPath.includes('?')) {
        return `${path}${searchParams}`;
      } else if (isPreviewMode && subPath.includes('?')) {
        // Merge query params
        const urlParams = new URLSearchParams(searchParams);
        const subPathParams = new URLSearchParams(subPath.split('?')[1] || '');
        subPathParams.forEach((value, key) => urlParams.set(key, value));
        const basePath = path.split('?')[0];
        return `${basePath}?${urlParams.toString()}`;
      }
      return path || '/portal';
    }
  };
}
