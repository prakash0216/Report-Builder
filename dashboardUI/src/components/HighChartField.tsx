import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chartConfigState } from "../recoil/ChartConfig";
import { useRecoilState, useRecoilValue, useRecoilCallback } from "recoil";
import { variableAtomFamily } from '../recoil/VariableFamily';
import { variableNamesState, variableUpdateTriggerState } from '../recoil/Variabletracker';
import ResizableChart from "./ResizableChart";

// Helper to safely parse values
const safeParse = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    try {
      return Function('"use strict";return (' + value + ')')();
    } catch {
      return value;
    }
  }
};

// Helper to replace variable references in JSON string
const replaceVariableReferences = (jsonString: string, variables: Record<string, any>): string => {
  let result = jsonString;
  
  // Replace variables, handling quoted and unquoted cases
  Object.entries(variables).forEach(([name, value]) => {
    const replacement = JSON.stringify(value);
    
    // Replace quoted variable placeholders (e.g. "${var}")
    result = result.replace(new RegExp(`"\\$\\{${name}\\}"`, 'g'), replacement);
    // Replace unquoted variable placeholders (e.g. ${var})
    result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), replacement);
  });
  
  return result;
};

// Component to display available variables
const VariableList = ({ variables }: { variables: Record<string, any> }) => {
  const variableCount = Object.keys(variables).length;
  
  if (variableCount === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {/* info icon */}
            <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">No Variables Available</h3>
            <p className="text-sm text-blue-600 mt-1">
              Run some code in the JS compiler to create variables that you can use here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-green-800 flex items-center">
          {/* variable icon */}
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Available Variables
        </h3>
        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
          {variableCount} variable{variableCount !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="text-xs text-green-600 mb-3">
        Use <code className="bg-green-100 px-1 rounded">${`{variableName}`}</code> syntax in your JSON
      </div>
      
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {Object.entries(variables).map(([name, value]) => (
          <div key={name} className="flex items-start bg-white rounded p-2 border border-green-100">
            <code className="font-mono text-blue-600 text-xs mr-3 flex-shrink-0 bg-blue-50 px-1 rounded">
              ${`{${name}}`}
            </code>
            <span 
              className="text-gray-700 text-xs flex-1"
              title={typeof value === 'object' ? JSON.stringify(value) : String(value)}
            >
              {typeof value === 'object' 
                ? JSON.stringify(value).substring(0, 40) + (JSON.stringify(value).length > 40 ? '...' : '')
                : String(value)
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Custom hook to get all variables reactively with fix
const useAllVariables = (): Record<string, any> => {
  const variableNames = useRecoilValue(variableNamesState);
  const updateTrigger = useRecoilValue(variableUpdateTriggerState);
  
  const getAllVariables = useRecoilCallback(({ snapshot }) => async (): Promise<Record<string, any>> => {
    const variables: Record<string, any> = {};
    const varNameArray: string[] = Array.from(variableNames);
    
    for (const varName of varNameArray) {
      try {
        const varValue = await snapshot.getPromise(variableAtomFamily(varName));
        if (varValue !== undefined && varValue !== null) {
          // Only parse if string, else use value as is
          variables[varName] = typeof varValue === 'string' ? safeParse(varValue) : varValue;
        }
      } catch (e) {
        console.warn(`Could not get variable ${varName}:`, e);
      }
    }
    
    return variables;
  }, [variableNames]);

  const [variables, setVariables] = useState<Record<string, any>>({});

  useEffect(() => {
    getAllVariables().then(setVariables);
  }, [getAllVariables, updateTrigger]);

  return variables;
};

interface ChartConfigData {
  template?: string;
  processed?: any;
  [key: string]: any;
}

export default function HighChartField() {
  const { id } = useParams<{ id: string }>();
  const [chartConfig, setChartConfig] = useState<string>("");
  const [chartConfigs, setChartConfigs] = useRecoilState<Record<string, ChartConfigData>>(chartConfigState);
  const [chartKey, setChartKey] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [showProcessedConfig, setShowProcessedConfig] = useState<boolean>(false);
  const navigate = useNavigate();

  const availableVariables = useAllVariables();

  const processedChartConfig = useMemo(() => {
    if (!chartConfig.trim()) return null;
    
    try {
      const configWithVariables = replaceVariableReferences(chartConfig, availableVariables);
      const parsedConfig = JSON.parse(configWithVariables);
      setError("");
      return parsedConfig;
    } catch (error: any) {
      setError(`Configuration error: ${error.message}`);
      return null;
    }
  }, [chartConfig, availableVariables]);

  useEffect(() => {
    if (id && chartConfigs[id]) {
      if (chartConfigs[id].template) {
        setChartConfig(chartConfigs[id].template!);
      } else {
        setChartConfig(JSON.stringify(chartConfigs[id], null, 2));
      }
    }
  }, [id, chartConfigs]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setChartConfig(value);

    if (!value.trim()) {
      setError("");
      return;
    }

    if (!id) return;

    try {
      const configWithVariables = replaceVariableReferences(value, availableVariables);
      const parsedConfig = JSON.parse(configWithVariables);
      
      setChartConfigs(prev => ({
        ...prev,
        [id]: { 
          template: value, 
          processed: parsedConfig 
        },
      }));

      setChartKey(prev => prev + 1);
      setError("");
    } catch (error: any) {
      setError(`Invalid JSON: ${error.message}`);
    }
  };

  const insertSampleTemplate = () => {
    const sampleTemplate = `{
      "chart": {
          "type": "line",
          "height": 400
      },
      "title": {
          "text": "Sample Chart with Variables"
      },
      "subtitle": {
          "text": "Data from JS Compiler Variables"
      },
      "xAxis": {
          "categories": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
      },
      "yAxis": {
          "title": {
          "text": "Values"
          }
      },
      "plotOptions": {
          "line": {
          "dataLabels": {
              "enabled": true
          }
          }
      },
      "series": [{
          "name": "Dynamic Data",
          "data": \${d1}
      }],
      "credits": {
          "enabled": false
      }
      }`;
    setChartConfig(sampleTemplate);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chart Configuration</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create and customize your Highcharts visualization
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => navigate("/dashboards")}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center text-sm font-medium"
          >
            {/* icon */}
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h2a2 2 0 012 2v2H8V5z" />
            </svg>
            View Dashboards
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
        {/* Left Panel - Configuration */}
        <div className="flex flex-col bg-white border-r border-gray-200 overflow-hidden">
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100">
            <VariableList variables={availableVariables} />
          </div>
          <div className="flex-1 flex flex-col px-6 py-4 overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <label className="text-sm font-semibold text-gray-700">
                Highcharts JSON Configuration
              </label>
              <div className="flex items-center text-xs text-gray-500">
                {/* info icon */}
                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Live preview updates automatically
              </div>
            </div>
            
            {/* Error Display - Moved above textarea */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex">
                  <svg className="h-5 w-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Configuration Error</h3>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex-1 relative">
              <textarea
                className={`w-full h-full p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none ${
                  error ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Enter your Highcharts configuration here..."
                value={chartConfig}
                onChange={handleChange}
              />
            </div>

            <div className="flex-shrink-0 pt-4 border-t border-gray-100 mt-4">
              <div className="flex justify-between space-x-3">
                <button
                  onClick={insertSampleTemplate}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center font-medium"
                >
                  {/* plus icon */}
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Insert Sample
                </button>
                <button
                  onClick={() => navigate("/dashboards")}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center text-sm font-medium"
                >
                  {/* check icon */}
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save & Go to Dashboards
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Preview */}
        <div className="flex flex-col bg-gray-50 overflow-hidden">
          <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  {/* chart icon */}
                  <svg className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Live Preview
                </h2>
                <p className="text-sm text-gray-600">Chart updates automatically with your changes</p>
              </div>
              
              {processedChartConfig && (
                <button
                  onClick={() => setShowProcessedConfig(!showProcessedConfig)}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  {showProcessedConfig ? 'Hide' : 'Show'} Processed JSON
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-1 p-6 flex flex-col">
            <div className="flex-1 border border-gray-300 rounded-lg bg-white overflow-hidden shadow-sm">
              {processedChartConfig ? (
                <ResizableChart key={chartKey} options={processedChartConfig} />
              ) : error ? (
                <div className="h-full flex items-center justify-center bg-red-50">
                  <div className="text-center p-4">
                    {/* error icon */}
                    <svg className="h-12 w-12 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-medium text-red-800 mb-2">Chart Error</h3>
                    <p className="text-sm text-red-600 max-w-sm">{error}</p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-50">
                  <div className="text-center p-4">
                    {/* empty state icon */}
                    <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for Configuration</h3>
                    <p className="text-sm text-gray-600 mb-4">Enter a valid Highcharts configuration to see your chart</p>
                    <button
                      onClick={insertSampleTemplate}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Insert a sample template to get started
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Processed Config Panel */}
            {showProcessedConfig && processedChartConfig && (
              <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4 mt-4 rounded-lg shadow-sm">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Processed Configuration</h4>
                <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-auto max-h-40 border">
                  {JSON.stringify(processedChartConfig, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



// import { useState, useEffect, useMemo } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import { chartConfigState } from "../recoil/ChartConfig";
// import { useRecoilState, useRecoilValue, useRecoilCallback } from "recoil";
// import { variableAtomFamily } from '../recoil/VariableFamily';
// import { variableNamesState, variableUpdateTriggerState } from '../recoil/Variabletracker';
// import ResizableChart from "./ResizableChart";

// // Helper to safely parse values
// const safeParse = (value: string): any => {
//   try {
//     return JSON.parse(value);
//   } catch {
//     try {
//       return Function('"use strict";return (' + value + ')')();
//     } catch {
//       return value;
//     }
//   }
// };

// // Helper to replace variable references in JSON string
// const replaceVariableReferences = (jsonString: string, variables: Record<string, any>): string => {
//   let result = jsonString;
  
//   // Replace ${variableName} patterns
//   Object.entries(variables).forEach(([name, value]) => {
//     const regex = new RegExp(`\\$\\{${name}\\}`, 'g');
//     result = result.replace(regex, JSON.stringify(value));
//   });
  
//   return result;
// };

// // Component to display available variables
// const VariableList = ({ variables }: { variables: Record<string, any> }) => {
//   const variableCount = Object.keys(variables).length;
  
//   if (variableCount === 0) {
//     return (
//       <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
//         <div className="flex items-center">
//           <div className="flex-shrink-0">
//             <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//             </svg>
//           </div>
//           <div className="ml-3">
//             <h3 className="text-sm font-medium text-blue-800">No Variables Available</h3>
//             <p className="text-sm text-blue-600 mt-1">
//               Run some code in the JS compiler to create variables that you can use here.
//             </p>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
//       <div className="flex items-center justify-between mb-3">
//         <h3 className="text-sm font-semibold text-green-800 flex items-center">
//           <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
//           </svg>
//           Available Variables
//         </h3>
//         <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
//           {variableCount} variable{variableCount !== 1 ? 's' : ''}
//         </span>
//       </div>
      
//       <div className="text-xs text-green-600 mb-3">
//         Use <code className="bg-green-100 px-1 rounded">${`{variableName}`}</code> syntax in your JSON
//       </div>
      
//       <div className="space-y-2 max-h-32 overflow-y-auto">
//         {Object.entries(variables).map(([name, value]) => (
//           <div key={name} className="flex items-start bg-white rounded p-2 border border-green-100">
//             <code className="font-mono text-blue-600 text-xs mr-3 flex-shrink-0 bg-blue-50 px-1 rounded">
//               ${`{${name}}`}
//             </code>
//             <span 
//               className="text-gray-700 text-xs flex-1"
//               title={typeof value === 'object' ? JSON.stringify(value) : String(value)}
//             >
//               {typeof value === 'object' 
//                 ? JSON.stringify(value).substring(0, 40) + (JSON.stringify(value).length > 40 ? '...' : '')
//                 : String(value)
//               }
//             </span>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// };

// // Custom hook to get all variables reactively
// const useAllVariables = (): Record<string, any> => {
//   const variableNames = useRecoilValue(variableNamesState);
//   const updateTrigger = useRecoilValue(variableUpdateTriggerState);
  
//   const getAllVariables = useRecoilCallback(({ snapshot }) => async (): Promise<Record<string, any>> => {
//     const variables: Record<string, any> = {};
//     const varNameArray: string[] = Array.from(variableNames);
    
//     for (const varName of varNameArray) {
//       try {
//         const varValue = await snapshot.getPromise(variableAtomFamily(varName));
//         if (varValue !== undefined && varValue !== null) {
//           variables[varName] = safeParse(varValue);
//         }
//       } catch (e) {
//         console.warn(`Could not get variable ${varName}:`, e);
//       }
//     }
    
//     return variables;
//   }, [variableNames]);

//   const [variables, setVariables] = useState<Record<string, any>>({});

//   useEffect(() => {
//     getAllVariables().then(setVariables);
//   }, [getAllVariables, updateTrigger]);

//   return variables;
// };

// interface ChartConfigData {
//   template?: string;
//   processed?: any;
//   [key: string]: any;
// }

// export default function HighChartField() {
//   const { id } = useParams<{ id: string }>();
//   const [chartConfig, setChartConfig] = useState<string>("");
//   const [chartConfigs, setChartConfigs] = useRecoilState<Record<string, ChartConfigData>>(chartConfigState);
//   const [chartKey, setChartKey] = useState<number>(0);
//   const [error, setError] = useState<string>("");
//   const [showProcessedConfig, setShowProcessedConfig] = useState<boolean>(false);
//   const navigate = useNavigate();

//   const availableVariables = useAllVariables();

//   const processedChartConfig = useMemo(() => {
//     if (!chartConfig.trim()) return null;
    
//     try {
//       const configWithVariables = replaceVariableReferences(chartConfig, availableVariables);
//       const parsedConfig = JSON.parse(configWithVariables);
//       setError("");
//       return parsedConfig;
//     } catch (error: any) {
//       setError(`Configuration error: ${error.message}`);
//       return null;
//     }
//   }, [chartConfig, availableVariables]);

//   useEffect(() => {
//     if (id && chartConfigs[id]) {
//       if (chartConfigs[id].template) {
//         setChartConfig(chartConfigs[id].template!);
//       } else {
//         setChartConfig(JSON.stringify(chartConfigs[id], null, 2));
//       }
//     }
//   }, [id, chartConfigs]);

//   const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
//     const value = e.target.value;
//     setChartConfig(value);

//     if (!value.trim()) {
//       setError("");
//       return;
//     }

//     if (!id) return;

//     try {
//       const configWithVariables = replaceVariableReferences(value, availableVariables);
//       const parsedConfig = JSON.parse(configWithVariables);
      
//       setChartConfigs(prev => ({
//         ...prev,
//         [id]: { 
//           template: value, 
//           processed: parsedConfig 
//         },
//       }));

//       setChartKey(prev => prev + 1);
//       setError("");
//     } catch (error: any) {
//       setError(`Invalid JSON: ${error.message}`);
//     }
//   };

//   const insertSampleTemplate = () => {
//     const sampleTemplate = `{
//         "chart": {
//             "type": "line",
//             "height": 400
//         },
//         "title": {
//             "text": "Sample Chart with Variables"
//         },
//         "subtitle": {
//             "text": "Data from JS Compiler Variables"
//         },
//         "xAxis": {
//             "categories": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
//         },
//         "yAxis": {
//             "title": {
//             "text": "Values"
//             }
//         },
//         "plotOptions": {
//             "line": {
//             "dataLabels": {
//                 "enabled": true
//             }
//             }
//         },
//         "series": [{
//             "name": "Dynamic Data",
//             "data": [10,20,30,40,50,60]
//         }],
//         "credits": {
//             "enabled": false
//         }
//         }`;
//     setChartConfig(sampleTemplate);
//   };

//   return (
//     <div className="min-h-screen bg-gray-50 flex flex-col">
//       {/* Header */}
//       <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
//         <div>
//           <h1 className="text-2xl font-bold text-gray-900">Chart Configuration</h1>
//           <p className="text-sm text-gray-600 mt-1">
//             Create and customize your Highcharts visualization
//           </p>
//         </div>
//         <div className="flex space-x-3">
//           <button
//             onClick={() => navigate("/dashboards")}
//             className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center text-sm font-medium"
//           >
//             <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h2a2 2 0 012 2v2H8V5z" />
//             </svg>
//             View Dashboards
//           </button>
//         </div>
//       </div>

//       {/* Main Content Area */}
//       <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
//         {/* Left Panel - Configuration */}
//         <div className="flex flex-col bg-white border-r border-gray-200 overflow-hidden">
//           <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100">
//             <VariableList variables={availableVariables} />
//           </div>
//           <div className="flex-1 flex flex-col px-6 py-4 overflow-hidden">
//             <div className="flex items-center justify-between mb-4 flex-shrink-0">
//               <label className="text-sm font-semibold text-gray-700">
//                 Highcharts JSON Configuration
//               </label>
//               <div className="flex items-center text-xs text-gray-500">
//                 <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//                 </svg>
//                 Live preview updates automatically
//               </div>
//             </div>
            
//             <div className="flex-1 relative">
//               <textarea
//                 className="w-full h-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
//                 placeholder="Enter your Highcharts configuration here..."
//                 value={chartConfig}
//                 onChange={handleChange}
//               />
              
//               {error && (
//                 <div className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-3">
//                   <div className="flex">
//                     <svg className="h-5 w-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//                     </svg>
//                     <div className="ml-3">
//                       <h3 className="text-sm font-medium text-red-800">Configuration Error</h3>
//                       <p className="text-sm text-red-600 mt-1">{error}</p>
//                     </div>
//                   </div>
//                 </div>
//               )}
//             </div>

//             <div className="flex-shrink-0 pt-4 border-t border-gray-100 mt-4">
//               <div className="flex justify-between space-x-3">
//                 <button
//                   onClick={insertSampleTemplate}
//                   className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center font-medium"
//                 >
//                   <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
//                   </svg>
//                   Insert Sample
//                 </button>
//                 <button
//                   onClick={() => navigate("/dashboards")}
//                   className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center text-sm font-medium"
//                 >
//                   <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
//                   </svg>
//                   Save & Go to Dashboards
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Right Panel - Preview */}
//         <div className="flex flex-col bg-gray-50 overflow-hidden">
//           <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200">
//             <div className="flex items-center justify-between">
//               <div>
//                 <h2 className="text-lg font-semibold text-gray-900 flex items-center">
//                   <svg className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
//                   </svg>
//                   Live Preview
//                 </h2>
//                 <p className="text-sm text-gray-600">Chart updates automatically with your changes</p>
//               </div>
              
//               {processedChartConfig && (
//                 <button
//                   onClick={() => setShowProcessedConfig(!showProcessedConfig)}
//                   className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
//                 >
//                   {showProcessedConfig ? 'Hide' : 'Show'} Processed JSON
//                 </button>
//               )}
//             </div>
//           </div>
          
//           <div className="flex-1 p-6 flex flex-col">
//             <div className="flex-1 border border-gray-300 rounded-lg bg-white overflow-hidden shadow-sm">
//               {processedChartConfig ? (
//                 <ResizableChart key={chartKey} options={processedChartConfig} />
//               ) : error ? (
//                 <div className="h-full flex items-center justify-center bg-red-50">
//                   <div className="text-center p-4">
//                     <svg className="h-12 w-12 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//                     </svg>
//                     <h3 className="text-lg font-medium text-red-800 mb-2">Chart Error</h3>
//                     <p className="text-sm text-red-600 max-w-sm">{error}</p>
//                   </div>
//                 </div>
//               ) : (
//                 <div className="h-full flex items-center justify-center bg-gray-50">
//                   <div className="text-center p-4">
//                     <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
//                     </svg>
//                     <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for Configuration</h3>
//                     <p className="text-sm text-gray-600 mb-4">Enter a valid Highcharts configuration to see your chart</p>
//                     <button
//                       onClick={insertSampleTemplate}
//                       className="text-sm text-blue-600 hover:text-blue-800 underline"
//                     >
//                       Insert a sample template to get started
//                     </button>
//                   </div>
//                 </div>
//               )}
//             </div>
            
//             {/* Processed Config Panel */}
//             {showProcessedConfig && processedChartConfig && (
//               <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4 mt-4 rounded-lg shadow-sm">
//                 <h4 className="text-sm font-semibold text-gray-700 mb-2">Processed Configuration</h4>
//                 <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-auto max-h-40 border">
//                   {JSON.stringify(processedChartConfig, null, 2)}
//                 </pre>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }



// import { useState, useEffect } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import { chartConfigState } from "../recoil/ChartConfig";
// import { useRecoilState, useRecoilValue } from "recoil";
// import ResizableChart from "./ResizableChart";
// import { injectRecoilVariables } from "../recoil/utils/InjectRecoilVariables";

// export default function HighChartField() {
//   const { id } = useParams();
//   const [chartConfig, setChartConfig] = useState("");
//   const [chartConfigs, setChartConfigs] = useRecoilState(chartConfigState);
//   const [chartKey, setChartKey] = useState(0);
//   const navigate = useNavigate();

//   useEffect(() => {
//     if (id && chartConfigs[id]) {
//       setChartConfig(JSON.stringify(chartConfigs[id], null, 2));
//     }
//   }, [id, chartConfigs]);

//   const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
//     const value = e.target.value;
//     setChartConfig(value);

//     try {
//       const parsedConfig = JSON.parse(value);

//       const clonedConfig = JSON.parse(JSON.stringify(parsedConfig));

//       setChartConfigs(prev => ({
//         ...prev,
//         [id!]: clonedConfig,
//       }));

//       // Force chart re-render
//       setChartKey(prev => prev + 1);
//     } catch (error) {
//       console.error("Invalid JSON:", error);
//     }
//   };

//   return (
//     <div>
//       <div className="grid grid-cols-12 gap-4 p-4">
//         <div className="col-span-6">
//           <textarea
//             className="w-full h-96 p-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-y"
//             placeholder="Highcharts JSON configuration here..."
//             value={chartConfig}
//             onChange={handleChange}
//           />
//         </div>
//         <div className="col-span-6 h-96">
//           <strong>Live Preview:</strong>
//           {chartConfigs[id!] && (() => {
//             try {
//               return (
//                 <ResizableChart key={chartKey} options={chartConfigs[id!]} />
//               );
//             } catch (e) {
//               console.error("Chart rendering error:", e);
//               return (
//                 <div className="text-red-500 mt-4">
//                   Error rendering chart. Please check your configuration.
//                 </div>
//               );
//             }
//           })()}
//         </div>
//       </div>

//       <div className="flex justify-center mt-8">
//         <button
//           onClick={() => navigate("/dashboards")}
//           className="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600"
//         >
//           Save
//         </button>
//       </div>
//     </div>
//   );
// }
