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
              <Route path="/dashboards" element={<DropDragDashboard/>}/>
              <Route path="/addChart/:id" element={<EditChart/>}/>
              <Route path="dashboard/:dashboardId/views" element={<DashboardViews />} />
              <Route path ="/" element={<DashboardsManagement/>}/>
            </Routes>
          </GlobalCalculationWrapper>
        </BrowserRouter>
      </ErrorBoundary>
  );
}

export default App;
