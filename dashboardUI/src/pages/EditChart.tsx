import React, { useState } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { 
  Database, 
  Code, 
  BarChart3,
  Zap,
  Save,
  ArrowLeft,
  Filter,
  Snowflake,
  SlidersHorizontal
} from 'lucide-react';
import JsCompiler from "../components/JsCompiler";
import AddDataSource from "../components/AddDataSource";
import HighChartField from "../components/HighChartField";
import Hooks from '../components/Hooks';
import SnowflakeConnector from '../components/SnowflakeConnector';
import Parameters from '../components/Parameters';
import Filters from '../components/Filters';

// Define the available tabs
type TabKey = 'connectionManager' | 'parameters' | 'dataSource' | 'filters' | 'hooks' | 'highChart';

// Tab configuration
interface Tab {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
}

// Define the URL params type
interface ChartParams {
  id: string;
  [key: string]: string | undefined;
}

// Navigation Bar Component
const NavBar: React.FC<{ chartId: string }> = ({ chartId }) => {
  const navigate = useNavigate();

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 items-center h-16">
          {/* Left section */}
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate("/dashboards")}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden sm:inline">Back to Charts</span>
            </button>
            
            <div className="h-6 border-l border-gray-300"></div>
            
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Chart Editor</h1>
                <p className="text-sm text-gray-500">ID: {chartId}</p>
              </div>
            </div>
          </div>

          {/* Center section - Auto-saved status */}
          <div className="flex justify-center">
            <div className="flex items-center space-x-1 bg-green-50 px-3 py-1 rounded-full">
              
            </div>
          </div>

          {/* Right section */}
          <div className="flex justify-end items-center">
            <button 
              onClick={() => navigate("/dashboards")}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

// Tab Button Component
interface TabButtonProps {
  tab: Tab;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ tab, isActive, onClick }) => {
  const Icon = tab.icon;
  
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center space-x-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-all duration-200
        ${isActive 
          ? 'bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm' 
          : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
        }
      `}
      type="button"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{tab.label}</span>
    </button>
  );
};

// Tab Content Component
interface TabContentProps {
  children: React.ReactNode;
}

const TabContent: React.FC<TabContentProps> = ({ children }) => {
  return (
    <div className="bg-white rounded-b-lg rounded-tr-lg border border-gray-200 shadow-sm min-h-[500px]">
      {children}
    </div>
  );
};

const EditChart: React.FC = () => {
  const { id } = useParams<ChartParams>();
  
  // State to manage active tab
  const [activeTab, setActiveTab] = useState<TabKey>('connectionManager');

  // Tab configuration
  const tabs: Tab[] = [
    {
      key: 'connectionManager',
      label: 'Connection Manager',
      icon: Snowflake,
      component: SnowflakeConnector
    },
    {
      key: 'parameters',
      label: 'Parameters',
      icon: SlidersHorizontal,
      component: Parameters
    },
    {
      key: 'dataSource',
      label: 'Data Source',
      icon: Database,
      component: AddDataSource
    },
    {
      key: 'filters',
      label: 'Filters',
      icon: Filter,
      component: Filters
    },
    {
      key: 'hooks',
      label: 'Calculations',
      icon: Zap,
      component: Hooks
    },
    {
      key: 'highChart',
      label: 'Chart Config',
      icon: BarChart3,
      component: HighChartField
    }
  ];

  // Get the active tab component
  const ActiveComponent = tabs.find(tab => tab.key === activeTab)?.component || SnowflakeConnector;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <NavBar chartId={id || 'No ID provided'} />
      
      {/* Main Content */}
      <div className="p-6 w-full mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                Chart Configuration
              </h2>
              <p className="text-gray-600 text-lg">
                Configure your chart's connections, parameters, data sources, filters, hooks, and visualization settings
              </p>
            </div>
          </div>
        </div>

        {/* Tabs Container */}
        <div className="w-full">
          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center gap-1 bg-gray-100 p-1 rounded-t-lg border-b border-gray-200">
            {tabs.map((tab) => (
              <TabButton
                key={tab.key}
                tab={tab}
                isActive={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              />
            ))}
          </div>

          {/* Tab Content */}
          <TabContent>
            <ActiveComponent />
          </TabContent>
        </div>
      </div>
    </div>
  );
};

export default EditChart;



// import { useParams } from "react-router-dom";
// import JsCompiler from "../components/JsCompiler";
// import AddDataSource from "../components/AddDataSource";
// import HighChartField from "../components/HighChartField";

// export default function EditChart() {
//   const { id } = useParams<{ id: string }>();

//   return (
//     <div style={{ padding: '20px' }}>
//       <h2 className="text-xl font-semibold pl-4">Editing Chart ID: {id}</h2>
//       <AddDataSource />
//       <JsCompiler />
//       <HighChartField/>
//     </div>
//   );
// }



// import { useParams,useNavigate } from "react-router-dom"
// import { useState } from "react"
// import { useRecoilState } from "recoil"
// import { chartConfigState } from "../recoil/ChartConfig"

// export default function AddChart(){
//     const {id}=useParams()
//     const navigate=useNavigate()
//     const [chartConfig,setchartConfig]=useState("")
//     const [chartConfigs,setchartConfigs]=useRecoilState(chartConfigState)

//     const handleSubmit=(e:React.FormEvent)=>{
//         e.preventDefault()
//             try{
//                 const parsed=JSON.parse(chartConfig);
//                 console.log(parsed)
//                 setchartConfigs((prev)=>({...prev,[id!]:parsed}))
//                 console.log(chartConfigs)
//                 navigate("/dashboards");
//             }catch(err){
//                 alert("Invalid Json format")
//             }
//     }

//     return(
//         <div style={{padding:"10px"}}>
//             <h2>Adding Dashboard : {id}</h2>
//             <form onSubmit={handleSubmit}>
//                 <textarea
//                     rows={10}
//                     cols={50}
//                     value={chartConfig}
//                     onChange={(e)=>setchartConfig(e.target.value)}
//                     placeholder="Paste HighCharts JSOn config here"
//                 />
//                 <br/>
//                 <button type="submit">Add Chart</button>
//             </form>
//         </div>
//     )
// }