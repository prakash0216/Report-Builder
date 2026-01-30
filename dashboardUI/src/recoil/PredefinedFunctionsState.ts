import { atom, selector } from "recoil";
import axios from "axios";
import {
  shouldBlockSave,
  hasValueChanged,
  updateLastValue,
} from "./initializationState";
import { API_BASE_URL } from '../config/api.config';

const ATOM_KEY = 'predefinedFunctionsState';

/**
 * Parameter definition for a predefined function
 */
export interface FunctionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any';
  description?: string;
  defaultValue?: string;
  required?: boolean;
}

/**
 * Predefined function that can be reused across calculations
 */
export interface PredefinedFunction {
  id: string;
  name: string;                    // Function name (must be valid JS identifier)
  description: string;             // What the function does
  parameters: FunctionParameter[]; // Function parameters
  body: string;                    // Function body (JavaScript code)
  returnType?: string;             // Optional return type hint
  category?: string;               // Category for organization (e.g., "Formatting", "Math", "Data")
  isEnabled: boolean;              // Whether function is active
  example?: string;                // Example usage with input/output
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Categories for organizing predefined functions
 */
export const FUNCTION_CATEGORIES = [
  'Formatting',
  'Math',
  'Data Transformation',
  'String Manipulation',
  'Date/Time',
  'Validation',
  'Custom',
] as const;

/**
 * Built-in utility functions that are always available
 */
export const BUILT_IN_FUNCTIONS: PredefinedFunction[] = [
  {
    id: 'builtin-formatCurrency',
    name: 'formatCurrency',
    description: 'Formats a number as currency with optional symbol and decimals',
    parameters: [
      { name: 'value', type: 'number', description: 'The number to format', required: true },
      { name: 'symbol', type: 'string', description: 'Currency symbol', defaultValue: '$', required: false },
      { name: 'decimals', type: 'number', description: 'Decimal places', defaultValue: '2', required: false },
    ],
    body: `const sym = symbol || '$';
const dec = decimals !== undefined ? decimals : 2;
if (value === null || value === undefined || isNaN(value)) return sym + '0.00';
const num = Number(value);
const formatted = Math.abs(num).toFixed(dec).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
return num < 0 ? '-' + sym + formatted : sym + formatted;`,
    returnType: 'string',
    category: 'Formatting',
    isEnabled: true,
    example: `// Example 1: Basic usage
formatCurrency(1234.56)
// Output: "$1,234.56"

// Example 2: Euro with 0 decimals
formatCurrency(1234.56, '€', 0)
// Output: "€1,235"

// Example 3: Negative number
formatCurrency(-500.75)
// Output: "-$500.75"`,
  },
  {
    id: 'builtin-formatPercentage',
    name: 'formatPercentage',
    description: 'Formats a decimal number as percentage',
    parameters: [
      { name: 'value', type: 'number', description: 'The decimal value (0.15 = 15%)', required: true },
      { name: 'decimals', type: 'number', description: 'Decimal places', defaultValue: '1', required: false },
      { name: 'multiply', type: 'boolean', description: 'Multiply by 100', defaultValue: 'true', required: false },
    ],
    body: `const dec = decimals !== undefined ? decimals : 1;
const mult = multiply !== false;
if (value === null || value === undefined || isNaN(value)) return '0%';
const num = mult ? Number(value) * 100 : Number(value);
return num.toFixed(dec) + '%';`,
    returnType: 'string',
    category: 'Formatting',
    isEnabled: true,
    example: `// Example 1: Decimal to percentage
formatPercentage(0.156)
// Output: "15.6%"

// Example 2: With 2 decimals
formatPercentage(0.15678, 2)
// Output: "15.68%"

// Example 3: Already a percentage (no multiply)
formatPercentage(75.5, 1, false)
// Output: "75.5%"`,
  },
  {
    id: 'builtin-formatNumber',
    name: 'formatNumber',
    description: 'Formats a number with thousand separators and decimals',
    parameters: [
      { name: 'value', type: 'number', description: 'The number to format', required: true },
      { name: 'decimals', type: 'number', description: 'Decimal places', defaultValue: '0', required: false },
    ],
    body: `const dec = decimals !== undefined ? decimals : 0;
if (value === null || value === undefined || isNaN(value)) return '0';
const num = Number(value);
return num.toFixed(dec).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');`,
    returnType: 'string',
    category: 'Formatting',
    isEnabled: true,
    example: `// Example 1: Large number with commas
formatNumber(1234567)
// Output: "1,234,567"

// Example 2: With 2 decimal places
formatNumber(1234567.891, 2)
// Output: "1,234,567.89"

// Example 3: Small number
formatNumber(42.5, 1)
// Output: "42.5"`,
  },
  {
    id: 'builtin-calculateGrowth',
    name: 'calculateGrowth',
    description: 'Calculates percentage growth between two values',
    parameters: [
      { name: 'current', type: 'number', description: 'Current value', required: true },
      { name: 'previous', type: 'number', description: 'Previous value', required: true },
    ],
    body: `if (previous === 0 || previous === null || previous === undefined) return 0;
if (current === null || current === undefined) return 0;
return ((current - previous) / Math.abs(previous)) * 100;`,
    returnType: 'number',
    category: 'Math',
    isEnabled: true,
    example: `// Example 1: Positive growth
calculateGrowth(150, 100)
// Output: 50 (50% growth)

// Example 2: Negative growth (decline)
calculateGrowth(80, 100)
// Output: -20 (-20% decline)

// Example 3: Use with formatPercentage
formatPercentage(calculateGrowth(150, 100) / 100)
// Output: "50.0%"`,
  },
  {
    id: 'builtin-safeNumber',
    name: 'safeNumber',
    description: 'Safely converts a value to number, returning default if invalid',
    parameters: [
      { name: 'value', type: 'any', description: 'Value to convert', required: true },
      { name: 'defaultValue', type: 'number', description: 'Default if invalid', defaultValue: '0', required: false },
    ],
    body: `const def = defaultValue !== undefined ? defaultValue : 0;
if (value === null || value === undefined || value === '') return def;
const num = Number(value);
return isNaN(num) ? def : num;`,
    returnType: 'number',
    category: 'Data Transformation',
    isEnabled: true,
    example: `// Example 1: Convert string to number
safeNumber("123.45")
// Output: 123.45

// Example 2: Handle null with default
safeNumber(null, 100)
// Output: 100

// Example 3: Handle invalid string
safeNumber("not a number", -1)
// Output: -1`,
  },
  {
    id: 'builtin-sumArray',
    name: 'sumArray',
    description: 'Sums all numeric values in an array',
    parameters: [
      { name: 'arr', type: 'array', description: 'Array of numbers', required: true },
      { name: 'key', type: 'string', description: 'Key to sum if array of objects', required: false },
    ],
    body: `if (!Array.isArray(arr)) return 0;
if (key) {
  return arr.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}
return arr.reduce((sum, val) => sum + (Number(val) || 0), 0);`,
    returnType: 'number',
    category: 'Math',
    isEnabled: true,
    example: `// Example 1: Sum array of numbers
sumArray([10, 20, 30, 40])
// Output: 100

// Example 2: Sum by key in array of objects
const sales = [
  { product: "A", amount: 100 },
  { product: "B", amount: 200 },
  { product: "C", amount: 150 }
];
sumArray(sales, "amount")
// Output: 450`,
  },
  {
    id: 'builtin-avgArray',
    name: 'avgArray',
    description: 'Calculates average of numeric values in an array',
    parameters: [
      { name: 'arr', type: 'array', description: 'Array of numbers', required: true },
      { name: 'key', type: 'string', description: 'Key to average if array of objects', required: false },
    ],
    body: `if (!Array.isArray(arr) || arr.length === 0) return 0;
const sum = key 
  ? arr.reduce((s, item) => s + (Number(item[key]) || 0), 0)
  : arr.reduce((s, val) => s + (Number(val) || 0), 0);
return sum / arr.length;`,
    returnType: 'number',
    category: 'Math',
    isEnabled: true,
    example: `// Example 1: Average of numbers
avgArray([10, 20, 30, 40])
// Output: 25

// Example 2: Average by key
const scores = [
  { name: "Alice", score: 85 },
  { name: "Bob", score: 92 },
  { name: "Carol", score: 78 }
];
avgArray(scores, "score")
// Output: 85`,
  },
  {
    id: 'builtin-filterArray',
    name: 'filterArray',
    description: 'Filters an array of objects by a key-value condition',
    parameters: [
      { name: 'arr', type: 'array', description: 'Array to filter', required: true },
      { name: 'key', type: 'string', description: 'Key to check', required: true },
      { name: 'value', type: 'any', description: 'Value to match', required: true },
    ],
    body: `if (!Array.isArray(arr)) return [];
return arr.filter(item => item[key] === value);`,
    returnType: 'array',
    category: 'Data Transformation',
    isEnabled: true,
    example: `// Example: Filter users by status
const users = [
  { name: "Alice", status: "active" },
  { name: "Bob", status: "inactive" },
  { name: "Carol", status: "active" }
];
filterArray(users, "status", "active")
// Output: [
//   { name: "Alice", status: "active" },
//   { name: "Carol", status: "active" }
// ]`,
  },
  {
    id: 'builtin-groupBy',
    name: 'groupBy',
    description: 'Groups an array of objects by a key',
    parameters: [
      { name: 'arr', type: 'array', description: 'Array to group', required: true },
      { name: 'key', type: 'string', description: 'Key to group by', required: true },
    ],
    body: `if (!Array.isArray(arr)) return {};
return arr.reduce((groups, item) => {
  const groupKey = item[key];
  if (!groups[groupKey]) groups[groupKey] = [];
  groups[groupKey].push(item);
  return groups;
}, {});`,
    returnType: 'object',
    category: 'Data Transformation',
    isEnabled: true,
    example: `// Example: Group products by category
const products = [
  { name: "Apple", category: "Fruit" },
  { name: "Carrot", category: "Vegetable" },
  { name: "Banana", category: "Fruit" }
];
groupBy(products, "category")
// Output: {
//   "Fruit": [{ name: "Apple"... }, { name: "Banana"... }],
//   "Vegetable": [{ name: "Carrot"... }]
// }`,
  },
  {
    id: 'builtin-truncateText',
    name: 'truncateText',
    description: 'Truncates text to a maximum length with ellipsis',
    parameters: [
      { name: 'text', type: 'string', description: 'Text to truncate', required: true },
      { name: 'maxLength', type: 'number', description: 'Maximum length', defaultValue: '50', required: false },
      { name: 'suffix', type: 'string', description: 'Suffix to add', defaultValue: '...', required: false },
    ],
    body: `const max = maxLength || 50;
const suf = suffix !== undefined ? suffix : '...';
if (!text || typeof text !== 'string') return '';
if (text.length <= max) return text;
return text.substring(0, max - suf.length) + suf;`,
    returnType: 'string',
    category: 'String Manipulation',
    isEnabled: true,
    example: `// Example 1: Basic truncation
truncateText("This is a very long text", 15)
// Output: "This is a ve..."

// Example 2: Custom suffix
truncateText("Hello World", 8, " →")
// Output: "Hello  →"

// Example 3: Text shorter than max
truncateText("Hi", 50)
// Output: "Hi"`,
  },
  {
    id: 'builtin-formatDate',
    name: 'formatDate',
    description: 'Formats a date string or timestamp',
    parameters: [
      { name: 'dateValue', type: 'any', description: 'Date string, timestamp, or Date object', required: true },
      { name: 'format', type: 'string', description: 'Format: "short", "long", "iso", or custom', defaultValue: 'short', required: false },
    ],
    body: `if (!dateValue) return '';
const date = new Date(dateValue);
if (isNaN(date.getTime())) return '';
const fmt = format || 'short';
if (fmt === 'iso') return date.toISOString().split('T')[0];
if (fmt === 'long') return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
if (fmt === 'short') return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
return date.toLocaleDateString();`,
    returnType: 'string',
    category: 'Date/Time',
    isEnabled: true,
    example: `// Example 1: Short format (default)
formatDate("2024-03-15")
// Output: "Mar 15, 2024"

// Example 2: Long format
formatDate("2024-03-15", "long")
// Output: "March 15, 2024"

// Example 3: ISO format
formatDate(new Date(), "iso")
// Output: "2024-03-15"`,
  },
  {
    id: 'builtin-isValidValue',
    name: 'isValidValue',
    description: 'Checks if a value is not null, undefined, or empty',
    parameters: [
      { name: 'value', type: 'any', description: 'Value to check', required: true },
    ],
    body: `if (value === null || value === undefined) return false;
if (typeof value === 'string' && value.trim() === '') return false;
if (Array.isArray(value) && value.length === 0) return false;
return true;`,
    returnType: 'boolean',
    category: 'Validation',
    isEnabled: true,
    example: `// Example 1: Check null
isValidValue(null)
// Output: false

// Example 2: Check empty string
isValidValue("   ")
// Output: false

// Example 3: Check valid value
isValidValue("Hello")
// Output: true

// Example 4: Conditional display
isValidValue(data.price) ? formatCurrency(data.price) : "N/A"`,
  },
];

/**
 * Default empty function template
 */
export const createDefaultFunction = (): PredefinedFunction => ({
  id: `func-${Date.now()}`,
  name: '',
  description: '',
  parameters: [],
  body: '// Write your function logic here\nreturn null;',
  returnType: 'any',
  category: 'Custom',
  isEnabled: true,
  createdAt: new Date().toISOString(),
});

/**
 * Recoil atom for storing user-defined predefined functions (GLOBAL - shared across all dashboards)
 */
export const predefinedFunctionsState = atom<PredefinedFunction[]>({
  key: ATOM_KEY,
  default: [],
  effects: [
    // 🔥 SAVE EFFECT: Save functions to backend when they change (GLOBAL)
    // NOTE: Predefined functions are GLOBAL (not dashboard-scoped), so we DON'T block saves
    // based on DataInitializer status. They can be edited from any page.
    ({ onSet }) => {
      let timeoutId: NodeJS.Timeout;
      let isFirstSet = true; // Track if this is the first set (from loading)
      
      onSet((newValue, oldValue, isReset) => {
        console.log(`📝 [PredefinedFunctions] onSet triggered - ${newValue.length} functions, isReset=${isReset}, isFirstSet=${isFirstSet}`);
        
        // Skip saving on reset
        if (isReset) {
          console.log(`⏭️ [PredefinedFunctions] Skipped save (reset)`);
          isFirstSet = true;
          return;
        }
        
        // Skip the first set (initial load from backend or default)
        if (isFirstSet) {
          console.log(`⏭️ [PredefinedFunctions] Skipped save (initial load)`);
          updateLastValue(ATOM_KEY, newValue);
          isFirstSet = false;
          return;
        }

        if (!hasValueChanged(ATOM_KEY, newValue)) {
          console.log(`⏭️ [PredefinedFunctions] Skipped save (no changes detected)`);
          return;
        }

        console.log(`💾 [PredefinedFunctions] Scheduling save for ${newValue.length} functions...`);
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          try {
            console.log(`🚀 [PredefinedFunctions] Sending to backend:`, newValue.map(f => f.name));
            const response = await axios.post(`${API_BASE_URL}/api/predefined-functions/bulk`, {
              functions: newValue,
              global: true, // 🔥 Mark as global functions
            });
            console.log(`✅ PredefinedFunctions: Saved ${newValue.length} global functions`, response.data);
          } catch (error) {
            console.error('❌ PredefinedFunctions: Failed to save:', error);
          }
        }, 500);
      });
    },
  ],
});

/**
 * Selector that combines built-in and user-defined functions
 */
export const allFunctionsSelector = selector<PredefinedFunction[]>({
  key: 'allFunctionsSelector',
  get: ({ get }) => {
    const userFunctions = get(predefinedFunctionsState);
    // Built-in functions first, then user functions
    return [...BUILT_IN_FUNCTIONS, ...userFunctions];
  },
});

/**
 * Selector that returns only enabled functions
 */
export const enabledFunctionsSelector = selector<PredefinedFunction[]>({
  key: 'enabledFunctionsSelector',
  get: ({ get }) => {
    const allFunctions = get(allFunctionsSelector);
    return allFunctions.filter(fn => fn.isEnabled);
  },
});

/**
 * Selector that generates JavaScript function definitions string
 * This can be prepended to any calculation code to make functions available
 */
export const functionDefinitionsSelector = selector<string>({
  key: 'functionDefinitionsSelector',
  get: ({ get }) => {
    const enabledFunctions = get(enabledFunctionsSelector);
    
    return enabledFunctions.map(fn => {
      const params = fn.parameters.map(p => p.name).join(', ');
      return `function ${fn.name}(${params}) {\n${fn.body}\n}`;
    }).join('\n\n');
  },
});

/**
 * Helper function to validate a function name
 */
export const isValidFunctionName = (name: string): boolean => {
  // Must be a valid JavaScript identifier
  const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  if (!validIdentifier.test(name)) return false;
  
  // Cannot be a reserved word
  const reserved = ['break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete',
    'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof', 'new', 'return',
    'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'class',
    'const', 'enum', 'export', 'extends', 'import', 'super', 'implements', 'interface',
    'let', 'package', 'private', 'protected', 'public', 'static', 'yield', 'await', 'async'];
  
  return !reserved.includes(name);
};

/**
 * Helper function to test a function with sample inputs
 */
export const testFunction = (fn: PredefinedFunction, testInputs: Record<string, any>): { success: boolean; result?: any; error?: string } => {
  try {
    const params = fn.parameters.map(p => p.name).join(', ');
    const funcCode = `(function(${params}) {\n${fn.body}\n})`;
    
    // eslint-disable-next-line no-eval
    const func = eval(funcCode);
    
    const args = fn.parameters.map(p => testInputs[p.name]);
    const result = func(...args);
    
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

