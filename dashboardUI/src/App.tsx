import { BrowserRouter,Routes,Route } from 'react-router-dom';
import './App.css';
import DropDragDashboard from './pages/DragDropDashboard';
import EditChart from './pages/EditChart';
import GlobalCalculationWrapper from './components/GlobalCalculationWrapper';
import DashboardsManagement from './pages/DashboardManagement';
import DashboardViews from './pages/DashboardViews';
import { DataInitializer } from './components/DataInitializer';
import ErrorBoundary from './components/ErrorBoundary';


function App() {
  return (
      <ErrorBoundary>
        <BrowserRouter>
          <DataInitializer />
          <GlobalCalculationWrapper>
            <Routes>
              {/* Home - Dashboard Management */}
              <Route path="/" element={<DashboardsManagement/>}/>
              
              {/* Dashboard Views - /dashboardName */}
              <Route path="/:dashboardName" element={<DashboardViews />} />
              
              {/* View Editor - /dashboardName/viewName */}
              <Route path="/:dashboardName/:viewName" element={<DropDragDashboard/>}/>
              
              {/* Edit Chart */}
              <Route path="/:dashboardName/:viewName/addChart/:id" element={<EditChart/>}/>
            </Routes>
          </GlobalCalculationWrapper>
        </BrowserRouter>
      </ErrorBoundary>
  );
}

export default App;
