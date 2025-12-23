// dashboardUI/src/components/JsonEditor.tsx
import React, { useRef, useEffect, useCallback, useState } from 'react';
import Editor, { OnMount, BeforeMount, Monaco } from '@monaco-editor/react';
import type { editor, IDisposable } from 'monaco-editor';
import { 
  Box, Button, Typography, Stack, Popover, TextField, List, 
  ListItemButton, ListItemText, InputAdornment, Chip
} from '@mui/material';
import { 
  FormatAlignLeft as FormatIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  DataObject as VariableIcon,
  Search as SearchIcon
} from '@mui/icons-material';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string | number;
  label?: string;
  placeholder?: string;
  error?: string;
  availableVariables?: Record<string, any>;
}

export function JsonEditor({
  value,
  onChange,
  height = 300,
  label,
  placeholder,
  error,
  availableVariables = {}
}: JsonEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const disposablesRef = useRef<IDisposable[]>([]);
  const [copied, setCopied] = useState(false);
  
  // Variable picker popover state
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const variableNames = Object.keys(availableVariables);
  const filteredVariables = variableNames.filter(name => 
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const registerVariableCompletions = useCallback((monaco: Monaco) => {
    // Dispose old providers
    disposablesRef.current.forEach(d => d.dispose());
    disposablesRef.current = [];

    // Variable completion provider
    const varProvider = monaco.languages.registerCompletionItemProvider('json', {
      triggerCharacters: ['$', '{'],
      provideCompletionItems: (model, position) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const textBefore = lineContent.substring(0, position.column - 1);
        const textAfter = lineContent.substring(position.column - 1);

        const suggestions: any[] = [];

        // Match: $ or ${ or ${partialName
        const match = textBefore.match(/\$(\{(\w*))?$/);
        
        if (match) {
          const partialName = match[2] || ''; // The partial variable name if any
          const hasClosingBrace = textAfter.startsWith('}');
          
          // Calculate what to replace: from $ to current position (and } if present)
          const dollarPos = textBefore.lastIndexOf('$');
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: dollarPos + 1,
            endColumn: hasClosingBrace ? position.column + 1 : position.column
          };

          // Filter variables if partial name typed
          const filteredVars = partialName
            ? variableNames.filter(name => 
                name.toLowerCase().startsWith(partialName.toLowerCase())
              )
            : variableNames;

          filteredVars.forEach(name => {
            suggestions.push({
              label: `\${${name}}`,
              kind: monaco.languages.CompletionItemKind.Variable,
              detail: `Variable: ${name}`,
              documentation: `Insert variable reference: \${${name}}`,
              insertText: `\${${name}}`,
              range
            });
          });
        }

        return { suggestions };
      }
    });
    disposablesRef.current.push(varProvider);
  }, [variableNames]);

  const handleEditorWillMount: BeforeMount = (monaco) => {
    // Define custom JSON theme with variable highlighting
    monaco.editor.defineTheme('jsonTheme', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'string.key.json', foreground: '7C3AED', fontStyle: 'bold' },
        { token: 'string.value.json', foreground: '059669' },
        { token: 'number.json', foreground: 'D97706' },
        { token: 'keyword.json', foreground: '2563EB' },
        { token: 'delimiter.bracket.json', foreground: '64748B' },
        { token: 'delimiter.colon.json', foreground: '64748B' },
        { token: 'delimiter.comma.json', foreground: '64748B' },
        // Variable highlighting
        { token: 'variable', foreground: 'E91E63', fontStyle: 'bold' },
        { token: 'variable.bracket', foreground: 'AD1457' },
      ],
      colors: {
        'editor.background': '#FAFBFC',
        'editor.foreground': '#1E293B',
        'editor.lineHighlightBackground': '#F1F5F9',
        'editor.selectionBackground': '#E0E7FF',
        'editorCursor.foreground': '#667EEA',
        'editorLineNumber.foreground': '#94A3B8',
        'editorLineNumber.activeForeground': '#667EEA',
        'editor.inactiveSelectionBackground': '#E2E8F0',
        'editorIndentGuide.background': '#E2E8F0',
        'editorIndentGuide.activeBackground': '#CBD5E1',
        'editorBracketMatch.background': '#E0E7FF',
        'editorBracketMatch.border': '#667EEA',
        'editorError.foreground': '#EF4444',
        'editorWarning.foreground': '#F59E0B',
      }
    });

    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: false
    });
  };

  // Function to highlight ${variableName} patterns
  const updateVariableDecorations = useCallback((editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    const model = editor.getModel();
    if (!model) return;

    const content = model.getValue();
    const decorations: editor.IModelDeltaDecoration[] = [];
    
    // Find all ${...} patterns
    const regex = /\$\{[^}]+\}/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const startPos = model.getPositionAt(match.index);
      const endPos = model.getPositionAt(match.index + match[0].length);
      
      decorations.push({
        range: new monaco.Range(
          startPos.lineNumber,
          startPos.column,
          endPos.lineNumber,
          endPos.column
        ),
        options: {
          inlineClassName: 'variable-highlight',
          hoverMessage: { value: `**Variable:** ${match[0]}` }
        }
      });
    }

    // Apply decorations
    editor.deltaDecorations([], decorations);
  }, []);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.updateOptions({
      formatOnPaste: true,
      formatOnType: true,
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      matchBrackets: 'always',
      renderValidationDecorations: 'on'
    });

    // Register variable completions
    registerVariableCompletions(monaco);

    // Initial variable highlighting
    updateVariableDecorations(editor, monaco);

    // Update decorations on content change
    editor.onDidChangeModelContent(() => {
      updateVariableDecorations(editor, monaco);
    });

    // Add format shortcut
    editor.addAction({
      id: 'format-json',
      label: 'Format JSON',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: () => formatJson()
    });

    // Add insert variable shortcut (Ctrl+Space)
    editor.addAction({
      id: 'trigger-suggest',
      label: 'Insert Variable',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space],
      run: () => {
        editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
      }
    });
  };

  // Re-register completions when variables change
  useEffect(() => {
    if (monacoRef.current) {
      registerVariableCompletions(monacoRef.current);
    }
  }, [registerVariableCompletions]);

  // Cleanup
  useEffect(() => {
    return () => {
      disposablesRef.current.forEach(d => d.dispose());
    };
  }, []);

  const formatJson = useCallback(() => {
    if (!editorRef.current) return;
    try {
      const currentValue = editorRef.current.getValue();
      const parsed = JSON.parse(currentValue);
      const formatted = JSON.stringify(parsed, null, 2);
      editorRef.current.setValue(formatted);
      onChange(formatted);
    } catch (e) {
      console.warn('Cannot format invalid JSON');
    }
  }, [onChange]);

  const copyToClipboard = useCallback(() => {
    if (!editorRef.current) return;
    navigator.clipboard.writeText(editorRef.current.getValue());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const insertVariable = useCallback((varName: string) => {
    if (!editorRef.current) return;
    
    const selection = editorRef.current.getSelection();
    if (selection) {
      editorRef.current.executeEdits('insert-variable', [{
        range: selection,
        text: `"\${${varName}}"`,
        forceMoveMarkers: true
      }]);
      editorRef.current.focus();
    }
    setAnchorEl(null);
    setSearchTerm('');
  }, []);

  const handleOpenVariablePicker = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {/* Variable highlight styles */}
      <style>{`
        .variable-highlight {
          color: #E91E63 !important;
          font-weight: 600 !important;
          background-color: rgba(233, 30, 99, 0.1);
          border-radius: 3px;
          padding: 0 2px;
        }
      `}</style>
      {/* Header with actions */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        px: 0.5
      }}>
        {label && (
          <Typography 
            variant="caption" 
            fontWeight={700}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {label}
          </Typography>
        )}
        
        <Stack direction="row" spacing={0.5}>
          {/* Variable Picker Button */}
          {variableNames.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<VariableIcon sx={{ fontSize: 14 }} />}
              onClick={handleOpenVariablePicker}
              sx={{ 
                textTransform: 'none', 
                fontSize: '0.7rem',
                py: 0.25,
                px: 1,
                borderRadius: 1,
                borderColor: 'rgba(102, 126, 234, 0.3)',
                color: '#667eea',
                '&:hover': {
                  borderColor: '#667eea',
                  bgcolor: 'rgba(102, 126, 234, 0.05)',
                }
              }}
            >
              Variables
              <Chip 
                label={variableNames.length} 
                size="small" 
                sx={{ 
                  ml: 0.5, 
                  height: 16, 
                  fontSize: '0.6rem',
                  bgcolor: 'rgba(102, 126, 234, 0.1)',
                  color: '#667eea'
                }} 
              />
            </Button>
          )}
          
          <Button
            size="small"
            variant="outlined"
            startIcon={<FormatIcon sx={{ fontSize: 14 }} />}
            onClick={formatJson}
            sx={{ 
              textTransform: 'none', 
              fontSize: '0.7rem',
              py: 0.25,
              px: 1,
              borderRadius: 1,
              borderColor: 'rgba(102, 126, 234, 0.3)',
              color: '#667eea',
              '&:hover': {
                borderColor: '#667eea',
                bgcolor: 'rgba(102, 126, 234, 0.05)',
              }
            }}
          >
            Format
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <CopyIcon sx={{ fontSize: 14 }} />}
            onClick={copyToClipboard}
            sx={{ 
              textTransform: 'none', 
              fontSize: '0.7rem',
              py: 0.25,
              px: 1,
              borderRadius: 1,
              borderColor: copied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(102, 126, 234, 0.3)',
              color: copied ? '#10b981' : '#667eea',
              '&:hover': {
                borderColor: copied ? '#10b981' : '#667eea',
                bgcolor: copied ? 'rgba(16, 185, 129, 0.05)' : 'rgba(102, 126, 234, 0.05)',
              }
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </Stack>
      </Box>

      {/* Variable Picker Popover */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => { setAnchorEl(null); setSearchTerm(''); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            width: 320,
            maxHeight: 400,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)',
            border: '1px solid rgba(102, 126, 234, 0.2)',
          }
        }}
      >
        <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(102, 126, 234, 0.1)' }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search variables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                </InputAdornment>
              ),
              sx: { 
                fontSize: '0.85rem',
                borderRadius: 1.5,
                bgcolor: 'rgba(102, 126, 234, 0.03)',
              }
            }}
          />
        </Box>
        <List dense sx={{ maxHeight: 300, overflow: 'auto', py: 0.5 }}>
          {filteredVariables.length === 0 ? (
            <Typography variant="caption" sx={{ p: 2, display: 'block', color: '#94a3b8', textAlign: 'center' }}>
              No variables found
            </Typography>
          ) : (
            filteredVariables.map(name => (
              <ListItemButton 
                key={name} 
                onClick={() => insertVariable(name)}
                sx={{ 
                  py: 0.75, 
                  px: 1.5,
                  '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.08)' }
                }}
              >
                <ListItemText 
                  primary={
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontFamily: 'monospace', 
                        color: '#667eea',
                        fontWeight: 600,
                        fontSize: '0.8rem'
                      }}
                    >
                      ${`{${name}}`}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                      {typeof availableVariables[name] === 'object' 
                        ? `${Array.isArray(availableVariables[name]) ? 'Array' : 'Object'} (${JSON.stringify(availableVariables[name]).substring(0, 30)}...)`
                        : String(availableVariables[name]).substring(0, 40)}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))
          )}
        </List>
      </Popover>

      {/* Monaco Editor */}
      <Box sx={{ 
        border: error ? '1px solid #EF4444' : '1px solid rgba(102, 126, 234, 0.2)',
        borderRadius: 1.5,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
        '&:focus-within': {
          borderColor: error ? '#EF4444' : '#667eea',
          boxShadow: error 
            ? '0 0 0 2px rgba(239, 68, 68, 0.1)' 
            : '0 0 0 2px rgba(102, 126, 234, 0.1)',
        }
      }}>
        <Editor
          height={height}
          language="json"
          value={value}
          onChange={(newValue) => onChange(newValue || '')}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          theme="jsonTheme"
          options={{
            fontSize: 12,
            fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
            fontLigatures: true,
            lineNumbers: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            wrappingIndent: 'indent',
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'mouseover',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            padding: { top: 8, bottom: 8 },
            renderWhitespace: 'selection',
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            // Use normal overflow widgets so positioning follows the caret
            fixedOverflowWidgets: false,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </Box>

      {/* Helper text */}
      <Typography variant="caption" sx={{ px: 0.5, color: '#94a3b8', fontSize: '0.65rem' }}>
        {placeholder || 'Type $ for variables • Ctrl+Shift+F to format'}
      </Typography>
    </Box>
  );
}

export default JsonEditor;
