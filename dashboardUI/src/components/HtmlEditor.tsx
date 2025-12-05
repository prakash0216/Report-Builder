// dashboardUI/src/components/HtmlEditor.tsx
import React, { useRef, useCallback, useEffect, useState } from 'react';
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

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string | number;
  label?: string;
  placeholder?: string;
  availableVariables?: Record<string, any>;
}

export function HtmlEditor({
  value,
  onChange,
  height = 300,
  label,
  placeholder,
  availableVariables = {}
}: HtmlEditorProps) {
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

  const handleEditorWillMount: BeforeMount = (monaco) => {
    // Define custom HTML theme matching the app's purple/indigo palette
    monaco.editor.defineTheme('htmlTheme', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'tag', foreground: '7C3AED', fontStyle: 'bold' },
        { token: 'tag.html', foreground: '7C3AED', fontStyle: 'bold' },
        { token: 'attribute.name', foreground: '667EEA' },
        { token: 'attribute.name.html', foreground: '667EEA' },
        { token: 'attribute.value', foreground: '059669' },
        { token: 'attribute.value.html', foreground: '059669' },
        { token: 'delimiter.html', foreground: '94A3B8' },
        { token: 'comment.html', foreground: '6B7280', fontStyle: 'italic' },
        { token: 'string.html', foreground: '059669' },
        { token: 'metatag.html', foreground: '7C3AED' },
        { token: 'metatag.content.html', foreground: '667EEA' },
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
      }
    });
  };

  const registerHtmlCompletions = useCallback((monaco: Monaco) => {
    disposablesRef.current.forEach(d => d.dispose());
    disposablesRef.current = [];

    // HTML tag completion
    const tagProvider = monaco.languages.registerCompletionItemProvider('html', {
      triggerCharacters: ['<', ' '],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const textBefore = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        const suggestions: any[] = [];

        if (textBefore.endsWith('<') || textBefore.match(/<\w*$/)) {
          const htmlTags = [
            { tag: 'div', desc: 'Container element' },
            { tag: 'span', desc: 'Inline element' },
            { tag: 'p', desc: 'Paragraph' },
            { tag: 'h1', desc: 'Heading 1' },
            { tag: 'h2', desc: 'Heading 2' },
            { tag: 'h3', desc: 'Heading 3' },
            { tag: 'h4', desc: 'Heading 4' },
            { tag: 'a', desc: 'Link' },
            { tag: 'strong', desc: 'Bold' },
            { tag: 'em', desc: 'Italic' },
            { tag: 'ul', desc: 'Unordered list' },
            { tag: 'ol', desc: 'Ordered list' },
            { tag: 'li', desc: 'List item' },
            { tag: 'table', desc: 'Table' },
            { tag: 'tr', desc: 'Table row' },
            { tag: 'td', desc: 'Table cell' },
            { tag: 'th', desc: 'Table header' },
            { tag: 'img', desc: 'Image' },
            { tag: 'br', desc: 'Line break' },
            { tag: 'hr', desc: 'Horizontal rule' },
          ];

          htmlTags.forEach(({ tag, desc }) => {
            const selfClosing = ['br', 'hr', 'img', 'input'].includes(tag);
            suggestions.push({
              label: tag,
              kind: monaco.languages.CompletionItemKind.Keyword,
              detail: desc,
              insertText: selfClosing ? `${tag} />` : `${tag}>$0</${tag}>`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range
            });
          });
        }

        return { suggestions };
      }
    });
    disposablesRef.current.push(tagProvider);

    // Variable completion provider
    const varProvider = monaco.languages.registerCompletionItemProvider('html', {
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
              insertText: `\${${name}}`,
              range
            });
          });
        }

        return { suggestions };
      }
    });
    disposablesRef.current.push(varProvider);

    // HTML snippets
    const snippetProvider = monaco.languages.registerCompletionItemProvider('html', {
      triggerCharacters: ['!'],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const snippets = [
          {
            label: '!kpi',
            detail: 'KPI Card',
            insertText: `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; color: white; text-align: center;">
  <h2 style="font-size: 48px; font-weight: bold; margin: 0;">\${1:Value}</h2>
  <p style="font-size: 18px; margin: 8px 0 0 0; opacity: 0.9;">\${2:Label}</p>
</div>`,
          },
          {
            label: '!card',
            detail: 'Basic Card',
            insertText: `<div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
  <h3 style="margin: 0 0 16px 0; font-weight: bold; color: #1e293b;">\${1:Title}</h3>
  <p style="margin: 0; color: #64748b;">\${2:Content}</p>
</div>`,
          },
          {
            label: '!grid2',
            detail: '2-Column Grid',
            insertText: `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
  <div style="background: #667eea; border-radius: 8px; padding: 16px; color: white;">
    <p style="margin: 0; font-size: 12px; opacity: 0.9;">\${1:Label}</p>
    <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold;">\${2:Value}</p>
  </div>
  <div style="background: #10b981; border-radius: 8px; padding: 16px; color: white;">
    <p style="margin: 0; font-size: 12px; opacity: 0.9;">\${3:Label}</p>
    <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold;">\${4:Value}</p>
  </div>
</div>`,
          },
          {
            label: '!flex',
            detail: 'Flex Center',
            insertText: `<div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
  \${1:Content}
</div>`,
          },
        ];

        return {
          suggestions: snippets.map(s => ({
            ...s,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range
          }))
        };
      }
    });
    disposablesRef.current.push(snippetProvider);
  }, [variableNames]);

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
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      matchBrackets: 'always',
      linkedEditing: true,
    });

    registerHtmlCompletions(monaco);

    // Initial variable highlighting
    updateVariableDecorations(editor, monaco);

    // Update decorations on content change
    editor.onDidChangeModelContent(() => {
      updateVariableDecorations(editor, monaco);
    });

    // Shortcuts
    editor.addAction({
      id: 'format-html',
      label: 'Format HTML',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: () => formatHtml()
    });

    editor.addAction({
      id: 'wrap-in-tag',
      label: 'Wrap in Tag',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyW],
      run: (ed) => {
        const selection = ed.getSelection();
        if (selection) {
          const selectedText = ed.getModel()?.getValueInRange(selection) || '';
          ed.executeEdits('wrap-tag', [{
            range: selection,
            text: `<div>${selectedText}</div>`,
            forceMoveMarkers: true
          }]);
        }
      }
    });
  };

  useEffect(() => {
    if (monacoRef.current) {
      registerHtmlCompletions(monacoRef.current);
    }
  }, [registerHtmlCompletions]);

  useEffect(() => {
    return () => {
      disposablesRef.current.forEach(d => d.dispose());
    };
  }, []);

  const formatHtml = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.getAction('editor.action.formatDocument')?.run();
  }, []);

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
        text: `\${${varName}}`,
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
            onClick={formatHtml}
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
                        ? `${Array.isArray(availableVariables[name]) ? 'Array' : 'Object'}`
                        : String(availableVariables[name]).substring(0, 40)}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))
          )}
        </List>
      </Popover>

      {/* Snippets hint */}
      <Typography variant="caption" sx={{ px: 0.5, color: '#94a3b8', fontSize: '0.65rem' }}>
        Snippets: !kpi • !card • !grid2 • !flex | Wrap: Ctrl+Shift+W
      </Typography>

      {/* Monaco Editor */}
      <Box sx={{ 
        border: '1px solid rgba(102, 126, 234, 0.2)',
        borderRadius: 1.5,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
        '&:focus-within': {
          borderColor: '#667eea',
          boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)',
        }
      }}>
        <Editor
          height={height}
          language="html"
          value={value}
          onChange={(newValue) => onChange(newValue || '')}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          theme="htmlTheme"
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
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            suggest: {
              showKeywords: true,
              showSnippets: true,
            },
          }}
        />
      </Box>

      {/* Helper text */}
      <Typography variant="caption" sx={{ px: 0.5, color: '#94a3b8', fontSize: '0.65rem' }}>
        {placeholder || 'Type $ for variables • < for tags'}
      </Typography>
    </Box>
  );
}

export default HtmlEditor;
