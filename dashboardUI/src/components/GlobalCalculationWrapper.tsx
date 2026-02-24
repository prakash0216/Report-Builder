// components/GlobalCalculationWrapper.tsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useGlobalRecalculation } from '../recoil/useGlobalRecalculation';

interface GlobalCalculationWrapperProps {
  children: React.ReactNode;
}

const GlobalCalculationWrapper: React.FC<GlobalCalculationWrapperProps> = ({ children }) => {
  const location = useLocation();
  
  // Check if we're on a dashboard VIEW route (/:dashboardName/:viewName)
  // Exactly 2 path segments, excluding embed and edit pages
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const isDashboardRoute = pathSegments.length === 2
    && pathSegments[1] !== 'embed'
    && !location.pathname.includes('/addChart/');
  
  // Always call the hook (React rules), but it will check route internally
  const { isRecalculating } = useGlobalRecalculation();

  console.log(`[Wrapper] Current route: ${location.pathname}, Dashboard route: ${isDashboardRoute}`);

  return (
    <>
      {/* Only show overlay when on dashboard AND recalculating */}
      {isDashboardRoute && isRecalculating && (
        <div className="fixed inset-0 z-[70] bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-xl flex items-center space-x-4 max-w-md mx-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
            <div>
              <h3 className="font-medium text-gray-900">Building the data</h3>
              <p className="text-sm text-gray-600 mt-1">
                Updating Variables
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Charts will update automatically when complete
              </p>
            </div>
          </div>
        </div>
      )}
      
      {children}
    </>
  );
};

export default GlobalCalculationWrapper;