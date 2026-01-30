import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import DropDragDashboard from './pages/DragDropDashboard';
import EditChart from './pages/EditChart';
import EmbedView from './pages/EmbedView';
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
            
            {/* Edit Chart (Protected) - Most specific, must come first */}
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

            {/* View Embed View - /dashboardName/viewName/embed (Protected) */}
            <Route 
              path="/:dashboardSlug/:viewSlug/embed" 
              element={
                <ProtectedRoute>
                  <EmbedView />
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
            
            {/* Dashboard Embed View - /dashboardName/embed (Protected) */}
            <Route 
              path="/:dashboardSlug/embed" 
              element={
                <ProtectedRoute>
                  <EmbedView />
                </ProtectedRoute>
              }
            />

            {/* Dashboard Views - /dashboardName (Protected) - Most general, must come last */}
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

            {/* Catch all - redirect to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </GlobalCalculationWrapper>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
