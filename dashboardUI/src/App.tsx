import { BrowserRouter,Routes,Route } from 'react-router-dom';
import './App.css';
import DropDragDashboard from './pages/DragDropDashboard';
import EditChart from './pages/EditChart';
import GlobalCalculationWrapper from './components/GlobalCalculationWrapper';
import DashboardsManagement from './pages/DashboardManagement';


function App() {
  return (
    <GlobalCalculationWrapper>
      <BrowserRouter>
        <Routes>
          <Route path="/dashboards" element={<DropDragDashboard/>}/>
          <Route path="/addChart/:id" element={<EditChart/>}/>
          <Route path ="/" element={<DashboardsManagement/>}/>
        </Routes>
      </BrowserRouter>
    </GlobalCalculationWrapper>
  );
}

export default App;
