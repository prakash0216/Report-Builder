// components/GlobalCalculationWrapper.tsx
import React, { useState, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { topNState } from '../recoil/topN';
import { storedLogicsState } from '../recoil/StoredLogic';
import { useGlobalRecalculation } from '../recoil/useGlobalRecalculation';

interface GlobalCalculationWrapperProps {
  children: React.ReactNode;
}

const GlobalCalculationWrapper: React.FC<GlobalCalculationWrapperProps> = ({ children }) => {
  const topNValue = useRecoilValue(topNState);
  const storedLogics = useRecoilValue(storedLogicsState);
  const [isGlobalRecalculating, setIsGlobalRecalculating] = useState(false);
  
  // This hook will run globally and handle recalculations
  const { recalculateAllLogics } = useGlobalRecalculation();

  // Track global recalculation state
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (topNValue && storedLogics.length > 0) {
      setIsGlobalRecalculating(true);
      
      // Set a timeout to hide the loader
      timeoutId = setTimeout(() => {
        setIsGlobalRecalculating(false);
      }, 2000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [topNValue, storedLogics.length]);

  return (
    <>
      {/* Global Recalculation Overlay - shows on any page */}
      {isGlobalRecalculating && storedLogics.length > 0 && (
        <div className="fixed inset-0 z-[70] bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-xl flex items-center space-x-4 max-w-md mx-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
            <div>
              <h3 className="font-medium text-gray-900">Updating Variables</h3>
              <p className="text-sm text-gray-600 mt-1">
                Recalculating with topN = {topNValue}...
              </p>
              <p className="text-xs text-gray-500 mt-1">
                This will update all charts automatically
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