import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import DropDragDashboard from './pages/DragDropDashboard';
import EditChart from './pages/EditChart';
import GlobalCalculationWrapper from './components/GlobalCalculationWrapper';
import DashboardsManagement from './pages/DashboardManagement';
import DashboardViews from './pages/DashboardViews';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import { DataInitializer } from './components/DataInitializer';
import ErrorBoundary from './components/ErrorBoundary';
import { DashboardProvider } from './context/DashboardContext';

// Wrapper component that provides dashboard context AND initializes data
// DataInitializer must be INSIDE a Route to have access to useParams()
const ViewDataWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DashboardProvider>
    <DataInitializer />
    {children}
  </DashboardProvider>
);

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <GlobalCalculationWrapper>
          <Routes>
            {/* Login Page - Default route */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Home - Dashboard Management (Protected) */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <DashboardsManagement />
                </ProtectedRoute>
              } 
            />
            
            {/* Dashboard Views - /dashboardName (Protected) */}
            <Route 
              path="/:dashboardName" 
              element={
                <ProtectedRoute>
                  <DashboardProvider>
                    <DashboardViews />
                  </DashboardProvider>
                </ProtectedRoute>
              } 
            />
            
            {/* View Editor - /dashboardName/viewName (Protected) */}
            <Route 
              path="/:dashboardName/:viewName" 
              element={
                <ProtectedRoute>
                  <ViewDataWrapper>
                    <DropDragDashboard />
                  </ViewDataWrapper>
                </ProtectedRoute>
              }
            />
            
            {/* Edit Chart (Protected) */}
            <Route 
              path="/:dashboardName/:viewName/addChart/:id" 
              element={
                <ProtectedRoute>
                  <ViewDataWrapper>
                    <EditChart />
                  </ViewDataWrapper>
                </ProtectedRoute>
              }
            />

            {/* Catch all - redirect to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </GlobalCalculationWrapper>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
