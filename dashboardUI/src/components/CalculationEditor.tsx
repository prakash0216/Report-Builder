// dashboardUI/src/components/CalculationEditor.tsx
import React, { useRef, useEffect } from 'react';
import Editor, { OnMount, BeforeMount, Monaco } from '@monaco-editor/react';
import { useRecoilValue } from 'recoil';
import { filterNamesState } from '../recoil/FiltersFamily';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { variableNamesState } from '../recoil/Variabletracker';
import type { editor, IDisposable, languages } from 'monaco-editor';

interface CalculationEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string | number;
  label?: string;
  helperText?: string;
}

export function CalculationEditor({
  value,
  onChange,
  height = 280,
  label,
  helperText
}: CalculationEditorProps) {
  const filterNames = useRecoilValue(filterNamesState);
  const parameterNames = useRecoilValue(parameterNamesState);
  const variableNames = useRecoilValue(variableNamesState);
  
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const disposablesRef = useRef<IDisposable[]>([]);

  // Categorize filters by prefix
  const paramFilters = filterNames.filter(name => name.startsWith('param_'));
  const dataSourceFilters = filterNames.filter(name => name.startsWith('data_source_'));
  const hookFilters = filterNames.filter(name => 
    name.startsWith('hook_') || 
    (!name.startsWith('param_') && !name.startsWith('data_source_'))
  );

  const handleEditorWillMount: BeforeMount = (monaco) => {
    // Define custom theme
    monaco.editor.defineTheme('calculationTheme', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7C3AED', fontStyle: 'bold' },
        { token: 'string', foreground: '059669' },
        { token: 'number', foreground: 'D97706' },
        { token: 'variable', foreground: '2563EB' },
      ],
      colors: {
        'editor.background': '#FAFAFF',
        'editor.foreground': '#1E293B',
        'editor.lineHighlightBackground': '#F1F5F9',
        'editor.selectionBackground': '#C7D2FE',
        'editorCursor.foreground': '#6366F1',
        'editorLineNumber.foreground': '#94A3B8',
        'editorLineNumber.activeForeground': '#6366F1',
        'editor.selectionHighlightBackground': '#E0E7FF',
        'editorSuggestWidget.background': '#FFFFFF',
        'editorSuggestWidget.foreground': '#1E293B',
        'editorSuggestWidget.border': '#E2E8F0',
        'editorSuggestWidget.selectedBackground': '#EEF2FF',
        'editorSuggestWidget.selectedForeground': '#1E293B',
        'editorSuggestWidget.highlightForeground': '#6366F1',
        'editorSuggestWidget.focusHighlightForeground': '#6366F1',
        'editorSuggestWidgetDescription.foreground': '#64748B',
      }
    });
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: '"Fira Code", "JetBrains Mono", "Consolas", monospace',
      fontLigatures: true,
      lineHeight: 22,
      padding: { top: 12, bottom: 12 },
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderLineHighlight: 'line',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      suggestOnTriggerCharacters: true,
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true
      },
      acceptSuggestionOnEnter: 'on',
      tabSize: 2,
      automaticLayout: true,
      bracketPairColorization: { enabled: true },
    });

    // Register completion provider
    registerCompletionProvider(monaco);
  };

  const registerCompletionProvider = (monaco: Monaco) => {
    // Dispose old providers
    disposablesRef.current.forEach(d => d.dispose());
    disposablesRef.current = [];

    // Register @ trigger completion provider
    const provider = monaco.languages.registerCompletionItemProvider('javascript', {
      triggerCharacters: ['@', '.'],
      provideCompletionItems: (model, position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        // Check if we're after @
        const atMatch = textUntilPosition.match(/@(\w*)$/);
        if (atMatch) {
          const searchTerm = atMatch[1].toLowerCase();
          const suggestions: languages.CompletionItem[] = [];
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - atMatch[0].length,
            endColumn: position.column
          };

          // Add Calculation Variables
          Array.from(variableNames).forEach((name, index) => {
            if (name.toLowerCase().includes(searchTerm)) {
              suggestions.push({
                label: `calc: ${name}`,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: name,
                detail: '📊 Calculation Variable',
                documentation: {
                  value: `**Calculation Variable**\n\nAccess the calculated value directly:\n\`\`\`javascript\n${name}\n\`\`\``,
                  isTrusted: true
                },
                range,
                sortText: `0_${name}`,
                filterText: `@${name}`,
              });
            }
          });

          // Add Parameters (with [0].value access pattern)
          parameterNames.forEach((name, index) => {
            if (name.toLowerCase().includes(searchTerm)) {
              suggestions.push({
                label: `param: ${name}`,
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: `param_${name}[0].value`,
                detail: '⚙️ Parameter',
                documentation: {
                  value: `**Parameter**\n\nAccess the parameter value:\n\`\`\`javascript\nparam_${name}[0].value\n\`\`\`\n\nOr access the full array:\n\`\`\`javascript\nparam_${name}\n\`\`\``,
                  isTrusted: true
                },
                range,
                sortText: `1_${name}`,
                filterText: `@${name} @param_${name}`,
              });
            }
          });

          // Add param_ filters
          paramFilters.forEach((name, index) => {
            const shortName = name.replace('param_', '');
            if (name.toLowerCase().includes(searchTerm) || shortName.toLowerCase().includes(searchTerm)) {
              suggestions.push({
                label: `filter: ${name}`,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: `${name}[0].value`,
                detail: '🔽 Param Filter',
                documentation: {
                  value: `**Param Filter**\n\nAccess the selected filter value:\n\`\`\`javascript\n${name}[0].value\n\`\`\`\n\nOr check all selected values:\n\`\`\`javascript\n${name}.map(f => f.value)\n\`\`\``,
                  isTrusted: true
                },
                range,
                sortText: `2_${name}`,
                filterText: `@${name} @${shortName}`,
              });
            }
          });

          // Add data_source_ filters
          dataSourceFilters.forEach((name, index) => {
            const shortName = name.replace('data_source_', '');
            if (name.toLowerCase().includes(searchTerm) || shortName.toLowerCase().includes(searchTerm)) {
              suggestions.push({
                label: `filter: ${name}`,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: `${name}`,
                detail: '📁 Data Source Filter',
                documentation: {
                  value: `**Data Source Filter**\n\nThis filter is used in dsConnect queries:\n\`\`\`javascript\ndsConnect("dataSource", {\n  filters: {\n    COLUMN_NAME: ${name}\n  }\n})\n\`\`\`\n\nIt contains the selected values array.`,
                  isTrusted: true
                },
                range,
                sortText: `3_${name}`,
                filterText: `@${name} @${shortName}`,
              });
            }
          });

          // Add hook_ filters
          hookFilters.forEach((name, index) => {
            const shortName = name.startsWith('hook_') ? name.replace('hook_', '') : name;
            if (name.toLowerCase().includes(searchTerm) || shortName.toLowerCase().includes(searchTerm)) {
              suggestions.push({
                label: `filter: ${name}`,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: `${name}[0].value`,
                detail: '🪝 Hook Filter',
                documentation: {
                  value: `**Hook Filter**\n\nAccess the selected filter value:\n\`\`\`javascript\n${name}[0].value\n\`\`\`\n\nOr check all selected values:\n\`\`\`javascript\n${name}.map(f => f.value)\n\`\`\``,
                  isTrusted: true
                },
                range,
                sortText: `4_${name}`,
                filterText: `@${name} @${shortName}`,
              });
            }
          });

          return { suggestions };
        }

        // Default JavaScript completions
        return { suggestions: [] };
      }
    });

    disposablesRef.current.push(provider);

    // Add dsConnect helper completion
    const dsConnectProvider = monaco.languages.registerCompletionItemProvider('javascript', {
      triggerCharacters: ['d'],
      provideCompletionItems: (model, position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: Math.max(1, position.column - 10),
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        if (textUntilPosition.match(/ds[Cc]?$/)) {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };

          return {
            suggestions: [{
              label: 'dsConnect',
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: [
                'await dsConnect("${1:dataSourceName}", {',
                '  columns: [${2}],',
                '  filters: {',
                '    ${3:COLUMN_NAME}: ${4:filterVariable}',
                '  },',
                '  groupBy: [${5}],',
                '  orderBy: [${6}],',
                '  limit: ${7:10}',
                '})'
              ].join('\n'),
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: '🔌 Query Data Source',
              documentation: {
                value: `**dsConnect - Query Data Source**\n\nExecute a query against a registered data source.\n\n**Parameters:**\n- \`dataSourceName\`: Name of the data source\n- \`options\`: Query configuration\n  - \`columns\`: Columns to select\n  - \`filters\`: Filter conditions\n  - \`groupBy\`: Group by columns\n  - \`orderBy\`: Order by columns\n  - \`limit\`: Maximum rows to return`,
                isTrusted: true
              },
              range
            }]
          };
        }

        return { suggestions: [] };
      }
    });

    disposablesRef.current.push(dsConnectProvider);

    // Add JavaScript standard library completions
    const jsLibraryProvider = monaco.languages.registerCompletionItemProvider('javascript', {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: Math.max(1, position.column - 50),
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        // Array methods
        const arrayMethods = [
          { name: 'map', snippet: 'map(${1:item => ${2:item}})', doc: 'Creates a new array with the results of calling a function for every array element' },
          { name: 'filter', snippet: 'filter(${1:item => ${2:item}})', doc: 'Creates a new array with all elements that pass the test' },
          { name: 'reduce', snippet: 'reduce((${1:acc}, ${2:item}) => ${3:acc + item}, ${4:0})', doc: 'Reduces the array to a single value' },
          { name: 'forEach', snippet: 'forEach(${1:item => ${2:console.log(item)}})', doc: 'Executes a provided function once for each array element' },
          { name: 'find', snippet: 'find(${1:item => ${2:item.id === 1}})', doc: 'Returns the first element that satisfies the condition' },
          { name: 'findIndex', snippet: 'findIndex(${1:item => ${2:item.id === 1}})', doc: 'Returns the index of the first element that satisfies the condition' },
          { name: 'some', snippet: 'some(${1:item => ${2:item > 0}})', doc: 'Tests whether at least one element passes the test' },
          { name: 'every', snippet: 'every(${1:item => ${2:item > 0}})', doc: 'Tests whether all elements pass the test' },
          { name: 'includes', snippet: 'includes(${1:value})', doc: 'Determines whether an array includes a certain value' },
          { name: 'indexOf', snippet: 'indexOf(${1:value})', doc: 'Returns the first index at which a given element can be found' },
          { name: 'slice', snippet: 'slice(${1:start}, ${2:end})', doc: 'Returns a shallow copy of a portion of an array' },
          { name: 'splice', snippet: 'splice(${1:start}, ${2:deleteCount}, ${3:...items})', doc: 'Changes the contents of an array by removing or replacing elements' },
          { name: 'concat', snippet: 'concat(${1:...arrays})', doc: 'Merges two or more arrays' },
          { name: 'join', snippet: 'join(${1:", "})', doc: 'Joins all elements of an array into a string' },
          { name: 'push', snippet: 'push(${1:...items})', doc: 'Adds one or more elements to the end of an array' },
          { name: 'pop', snippet: 'pop()', doc: 'Removes the last element from an array' },
          { name: 'shift', snippet: 'shift()', doc: 'Removes the first element from an array' },
          { name: 'unshift', snippet: 'unshift(${1:...items})', doc: 'Adds one or more elements to the beginning of an array' },
          { name: 'sort', snippet: 'sort((${1:a}, ${2:b}) => ${3:a - b})', doc: 'Sorts the elements of an array' },
          { name: 'reverse', snippet: 'reverse()', doc: 'Reverses the order of the elements in an array' },
          { name: 'length', snippet: 'length', doc: 'Returns the number of elements in an array', isProperty: true },
        ];

        // Object methods
        const objectMethods = [
          { name: 'keys', snippet: 'Object.keys(${1:obj})', doc: 'Returns an array of a given object\'s own enumerable property names', isStatic: true },
          { name: 'values', snippet: 'Object.values(${1:obj})', doc: 'Returns an array of a given object\'s own enumerable property values', isStatic: true },
          { name: 'entries', snippet: 'Object.entries(${1:obj})', doc: 'Returns an array of a given object\'s own enumerable [key, value] pairs', isStatic: true },
          { name: 'assign', snippet: 'Object.assign(${1:target}, ${2:...sources})', doc: 'Copies all enumerable own properties from source objects to a target object', isStatic: true },
          { name: 'hasOwnProperty', snippet: 'hasOwnProperty(${1:"property"})', doc: 'Returns a boolean indicating whether the object has the specified property' },
        ];

        // String methods
        const stringMethods = [
          { name: 'toLowerCase', snippet: 'toLowerCase()', doc: 'Returns the string converted to lowercase' },
          { name: 'toUpperCase', snippet: 'toUpperCase()', doc: 'Returns the string converted to uppercase' },
          { name: 'trim', snippet: 'trim()', doc: 'Removes whitespace from both ends of a string' },
          { name: 'split', snippet: 'split(${1:", "})', doc: 'Splits a string into an array of substrings' },
          { name: 'replace', snippet: 'replace(${1:/pattern/}, ${2:"replacement"})', doc: 'Returns a new string with some or all matches replaced' },
          { name: 'substring', snippet: 'substring(${1:start}, ${2:end})', doc: 'Returns a subset of a string between two indices' },
          { name: 'slice', snippet: 'slice(${1:start}, ${2:end})', doc: 'Extracts a section of a string and returns it as a new string' },
          { name: 'includes', snippet: 'includes(${1:"searchString"})', doc: 'Determines whether a string contains the specified substring' },
          { name: 'indexOf', snippet: 'indexOf(${1:"searchString"})', doc: 'Returns the index of the first occurrence of a substring' },
          { name: 'startsWith', snippet: 'startsWith(${1:"searchString"})', doc: 'Determines whether a string begins with the specified substring' },
          { name: 'endsWith', snippet: 'endsWith(${1:"searchString"})', doc: 'Determines whether a string ends with the specified substring' },
          { name: 'length', snippet: 'length', doc: 'Returns the length of a string', isProperty: true },
        ];

        // Math methods
        const mathMethods = [
          { name: 'Math.round', snippet: 'Math.round(${1:x})', doc: 'Returns the value of a number rounded to the nearest integer', isStatic: true },
          { name: 'Math.floor', snippet: 'Math.floor(${1:x})', doc: 'Returns the largest integer less than or equal to a number', isStatic: true },
          { name: 'Math.ceil', snippet: 'Math.ceil(${1:x})', doc: 'Returns the smallest integer greater than or equal to a number', isStatic: true },
          { name: 'Math.max', snippet: 'Math.max(${1:...values})', doc: 'Returns the largest of zero or more numbers', isStatic: true },
          { name: 'Math.min', snippet: 'Math.min(${1:...values})', doc: 'Returns the smallest of zero or more numbers', isStatic: true },
          { name: 'Math.abs', snippet: 'Math.abs(${1:x})', doc: 'Returns the absolute value of a number', isStatic: true },
          { name: 'Math.random', snippet: 'Math.random()', doc: 'Returns a random number between 0 and 1', isStatic: true },
          { name: 'Math.sqrt', snippet: 'Math.sqrt(${1:x})', doc: 'Returns the square root of a number', isStatic: true },
          { name: 'Math.pow', snippet: 'Math.pow(${1:base}, ${2:exponent})', doc: 'Returns the base to the exponent power', isStatic: true },
        ];

        // Number methods
        const numberMethods = [
          { name: 'toFixed', snippet: 'toFixed(${1:2})', doc: 'Formats a number using fixed-point notation' },
          { name: 'parseInt', snippet: 'parseInt(${1:"123"})', doc: 'Parses a string and returns an integer', isGlobal: true },
          { name: 'parseFloat', snippet: 'parseFloat(${1:"123.45"})', doc: 'Parses a string and returns a floating point number', isGlobal: true },
          { name: 'isNaN', snippet: 'isNaN(${1:value})', doc: 'Determines whether a value is NaN', isGlobal: true },
          { name: 'Number.isNaN', snippet: 'Number.isNaN(${1:value})', doc: 'Determines whether the passed value is NaN', isStatic: true },
        ];

        // JSON methods
        const jsonMethods = [
          { name: 'JSON.stringify', snippet: 'JSON.stringify(${1:obj})', doc: 'Converts a JavaScript object or value to a JSON string', isStatic: true },
          { name: 'JSON.parse', snippet: 'JSON.parse(${1:"{}"})', doc: 'Parses a JSON string and returns a JavaScript object', isStatic: true },
        ];

        // Check if we're after a dot (for method completions)
        const dotMatch = textUntilPosition.match(/(\w+)\.(\w*)$/);
        if (dotMatch) {
          const objectName = dotMatch[1];
          const methodPrefix = dotMatch[2].toLowerCase();
          const suggestions: languages.CompletionItem[] = [];
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - methodPrefix.length,
            endColumn: position.column
          };

          // Always show array methods (they're commonly used)
          arrayMethods.forEach(method => {
            if (method.name.toLowerCase().startsWith(methodPrefix)) {
              suggestions.push({
                label: method.name,
                kind: method.isProperty 
                  ? monaco.languages.CompletionItemKind.Property
                  : monaco.languages.CompletionItemKind.Method,
                insertText: method.snippet,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: '📋 Array Method',
                documentation: { value: method.doc, isTrusted: true },
                range,
                sortText: `0_${method.name}`,
              });
            }
          });

          // Always show string methods (they're commonly used)
          stringMethods.forEach(method => {
            if (method.name.toLowerCase().startsWith(methodPrefix)) {
              suggestions.push({
                label: method.name,
                kind: method.isProperty
                  ? monaco.languages.CompletionItemKind.Property
                  : monaco.languages.CompletionItemKind.Method,
                insertText: method.snippet,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: '📝 String Method',
                documentation: { value: method.doc, isTrusted: true },
                range,
                sortText: `1_${method.name}`,
              });
            }
          });

          // Number methods
          numberMethods.forEach(method => {
            if (!method.isGlobal && method.name.toLowerCase().startsWith(methodPrefix)) {
              suggestions.push({
                label: method.name,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: method.snippet,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: '🔢 Number Method',
                documentation: { value: method.doc, isTrusted: true },
                range,
                sortText: `2_${method.name}`,
              });
            }
          });

          // Object methods
          objectMethods.forEach(method => {
            if (method.name.toLowerCase().startsWith(methodPrefix)) {
              const insertText = method.isStatic 
                ? method.snippet 
                : method.snippet.replace('Object.', '');
              suggestions.push({
                label: method.name,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: insertText,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: method.isStatic ? '🔧 Object Static Method' : '🔧 Object Method',
                documentation: { value: method.doc, isTrusted: true },
                range,
                sortText: `3_${method.name}`,
              });
            }
          });

          // Math methods
          if (objectName === 'Math') {
            mathMethods.forEach(method => {
              if (method.name.replace('Math.', '').toLowerCase().startsWith(methodPrefix)) {
                suggestions.push({
                  label: method.name.replace('Math.', ''),
                  kind: monaco.languages.CompletionItemKind.Method,
                  insertText: method.snippet,
                  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                  detail: '🔢 Math Method',
                  documentation: { value: method.doc, isTrusted: true },
                  range,
                  sortText: `4_${method.name}`,
                });
              }
            });
          }

          // JSON methods
          if (objectName === 'JSON') {
            jsonMethods.forEach(method => {
              if (method.name.replace('JSON.', '').toLowerCase().startsWith(methodPrefix)) {
                suggestions.push({
                  label: method.name.replace('JSON.', ''),
                  kind: monaco.languages.CompletionItemKind.Method,
                  insertText: method.snippet,
                  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                  detail: '📄 JSON Method',
                  documentation: { value: method.doc, isTrusted: true },
                  range,
                  sortText: `5_${method.name}`,
                });
              }
            });
          }

          if (suggestions.length > 0) {
            return { suggestions };
          }
        }

        // Global function completions (when typing at start of line or after operators)
        const globalMatch = textUntilPosition.match(/(?:^|[^a-zA-Z0-9_])(parseInt|parseFloat|isNaN|JSON|Math)(\w*)$/);
        if (globalMatch) {
          const prefix = globalMatch[1];
          const methodPrefix = globalMatch[2].toLowerCase();
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - methodPrefix.length,
            endColumn: position.column
          };
          const suggestions: languages.CompletionItem[] = [];

          if (prefix === 'Math' && methodPrefix === '') {
            mathMethods.forEach(method => {
              suggestions.push({
                label: method.name,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: method.snippet,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: '🔢 Math Method',
                documentation: { value: method.doc, isTrusted: true },
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: word.startColumn,
                  endColumn: word.endColumn
                },
              });
            });
          }

          if (prefix === 'JSON' && methodPrefix === '') {
            jsonMethods.forEach(method => {
              suggestions.push({
                label: method.name,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: method.snippet,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: '📄 JSON Method',
                documentation: { value: method.doc, isTrusted: true },
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: word.startColumn,
                  endColumn: word.endColumn
                },
              });
            });
          }

          if (suggestions.length > 0) {
            return { suggestions };
          }
        }

        return { suggestions: [] };
      }
    });

    disposablesRef.current.push(jsLibraryProvider);
  };

  // Re-register providers when data changes
  useEffect(() => {
    if (monacoRef.current) {
      registerCompletionProvider(monacoRef.current);
    }
  }, [filterNames, parameterNames, variableNames, paramFilters, dataSourceFilters, hookFilters]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disposablesRef.current.forEach(d => d.dispose());
    };
  }, []);

  return (
    <div style={{ width: '100%' }}>
      <style>{`
        .monaco-editor .suggest-widget {
          background: #FFFFFF !important;
          border: 1px solid #E2E8F0 !important;
        }
        .monaco-editor .suggest-widget .monaco-list .monaco-list-row {
          color: #1E293B !important;
        }
        .monaco-editor .suggest-widget .monaco-list .monaco-list-row.selected {
          background-color: #EEF2FF !important;
          color: #1E293B !important;
        }
        .monaco-editor .suggest-widget .monaco-list .monaco-list-row .monaco-icon-label {
          color: #1E293B !important;
        }
        .monaco-editor .suggest-widget .monaco-list .monaco-list-row .monaco-icon-label .monaco-icon-label-description-container {
          color: #64748B !important;
        }
        .monaco-editor .suggest-widget .details {
          background: #F8FAFC !important;
          border-top: 1px solid #E2E8F0 !important;
          color: #1E293B !important;
        }
        .monaco-editor .suggest-widget .details .monaco-scrollable-element {
          color: #1E293B !important;
        }
      `}</style>
      {label && (
        <label style={{ 
          display: 'block', 
          marginBottom: 8, 
          fontSize: 14, 
          fontWeight: 600,
          color: '#374151',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          {label}
        </label>
      )}
      <div 
        style={{ 
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid rgba(102, 126, 234, 0.3)',
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.1)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#667eea';
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(102, 126, 234, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.1)';
        }}
      >
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'white', fontWeight: 500 }}>
              💡 Type <code style={{ 
                background: 'rgba(255,255,255,0.2)', 
                padding: '2px 6px', 
                borderRadius: 4,
                fontFamily: 'monospace'
              }}>@</code> for autocomplete
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ 
              fontSize: 10, 
              color: 'rgba(255,255,255,0.9)', 
              background: 'rgba(255,255,255,0.2)',
              padding: '2px 8px',
              borderRadius: 10,
            }}>
              📊 Calculations: {variableNames.size}
            </span>
            <span style={{ 
              fontSize: 10, 
              color: 'rgba(255,255,255,0.9)', 
              background: 'rgba(255,255,255,0.2)',
              padding: '2px 8px',
              borderRadius: 10,
            }}>
              ⚙️ Params: {parameterNames.length}
            </span>
            <span style={{ 
              fontSize: 10, 
              color: 'rgba(255,255,255,0.9)', 
              background: 'rgba(255,255,255,0.2)',
              padding: '2px 8px',
              borderRadius: 10,
            }}>
              🔽 Filters: {filterNames.length}
            </span>
          </div>
        </div>
        <Editor
          height={height}
          defaultLanguage="javascript"
          theme="calculationTheme"
          value={value}
          onChange={(val) => onChange(val || '')}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
          }}
        />
      </div>
      {helperText && (
        <p style={{ 
          marginTop: 8, 
          fontSize: 12, 
          color: '#6b7280',
          marginBottom: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '2px 8px',
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 500,
          }}>
            TIP
          </span>
          {helperText}
        </p>
      )}
    </div>
  );
}

export default CalculationEditor;

