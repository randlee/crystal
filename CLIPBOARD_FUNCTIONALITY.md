# Crystal Clipboard Functionality

## Overview

Crystal now includes comprehensive cross-platform clipboard support for XTerm.js terminals, enabling seamless copy and paste operations on both Windows (Ctrl+C/Ctrl+V) and macOS (Cmd+C/Cmd+V).

## Features

### Cross-Platform Key Bindings
- **Windows/Linux**: `Ctrl+C` to copy, `Ctrl+V` to paste
- **macOS**: `Cmd+C` to copy, `Cmd+V` to paste
- **Automatic platform detection** based on `navigator.platform`

### Copy Functionality
- **Text Selection**: Select text in any terminal, then press `Ctrl+C` (Windows) or `Cmd+C` (macOS) to copy to clipboard
- **Both Terminal Types**: Works in both Output terminal (read-only) and Interactive terminal (script mode)
- **Visual Feedback**: Console logging confirms successful copy operations
- **Error Handling**: Graceful fallback if clipboard API is unavailable

### Paste Functionality
- **Interactive Terminal Only**: Paste is only enabled in the interactive terminal (script mode) for security
- **Key Binding**: Press `Ctrl+V` (Windows) or `Cmd+V` (macOS) to paste clipboard content
- **Direct PTY Integration**: Pasted text is sent directly to the PTY session
- **Error Handling**: Safe clipboard reading with error recovery

## Implementation Details

### New Files Added

#### `frontend/src/utils/clipboard.ts`
A comprehensive utility module providing:
- Cross-platform modifier key detection
- Safe clipboard read/write operations
- Event handler factories for copy/paste operations
- Consistent error handling and logging

#### Key Functions:
- `getClipboardModifier()` - Returns 'metaKey' for Mac, 'ctrlKey' for Windows/Linux
- `isCopyKeyEvent(e)` - Checks if event is copy operation (Cmd/Ctrl+C)
- `isPasteKeyEvent(e)` - Checks if event is paste operation (Cmd/Ctrl+V)
- `copyToClipboard(text)` - Safely copies text with error handling
- `readFromClipboard()` - Safely reads text with error handling
- `createCopyHandler()` - Factory for copy event handlers
- `createPasteHandler()` - Factory for paste event handlers

### Modified Files

#### `frontend/src/hooks/useSessionView.ts`
Enhanced the `initTerminal` function to:
- Add cross-platform clipboard event handlers to both terminals
- Implement proper cleanup for clipboard event listeners
- Extend Terminal type with custom cleanup function
- Use clipboard utilities for consistent behavior

#### `tests/windows-formatting.spec.ts`
Added new E2E test:
- Verifies clipboard infrastructure is properly initialized
- Tests platform detection logic
- Mocks clipboard API for automated testing
- Validates cross-platform key binding detection

## Usage Instructions

### For Users

1. **Copying Terminal Output**:
   - Select text in any terminal view
   - Press `Ctrl+C` on Windows/Linux or `Cmd+C` on macOS
   - Text is copied to system clipboard

2. **Pasting into Interactive Terminal**:
   - Switch to Terminal view (interactive mode)
   - Press `Ctrl+V` on Windows/Linux or `Cmd+V` on macOS
   - Clipboard content is pasted into the terminal

3. **Browser Permissions**:
   - Modern browsers may request clipboard permissions
   - Grant permissions when prompted for full functionality

### For Developers

#### Adding Clipboard Support to New Components

```typescript
import { createCopyHandler, copyToClipboard } from '../utils/clipboard';

// Simple copy operation
const handleCopy = async () => {
  await copyToClipboard('Text to copy');
};

// Event-driven copy handler
const copyHandler = createCopyHandler((selection) => {
  console.log(`Copied: ${selection}`);
});

element.addEventListener('keydown', (e) => {
  copyHandler(e, () => getSelectedText());
});
```

#### Platform Detection

```typescript
import { getClipboardModifier, isCopyKeyEvent } from '../utils/clipboard';

// Check platform
const modifier = getClipboardModifier(); // 'metaKey' or 'ctrlKey'

// Check for copy event
const handleKeyDown = (e: KeyboardEvent) => {
  if (isCopyKeyEvent(e)) {
    // Handle copy operation
  }
};
```

## Technical Architecture

### Event Flow
1. User presses `Ctrl+C` or `Cmd+C` with text selected
2. Platform detection determines correct modifier key
3. XTerm.js `getSelection()` retrieves selected text
4. `navigator.clipboard.writeText()` copies to system clipboard
5. Console logging confirms operation
6. Event handlers prevent default browser behavior

### Error Handling
- **Clipboard API Unavailable**: Graceful degradation with error logging
- **Permission Denied**: User-friendly error messages
- **Empty Selection**: No-op behavior, no error thrown
- **Network/Security Issues**: Fallback with detailed logging

### Performance Considerations
- Event listeners are added only after DOM is ready
- Cleanup functions prevent memory leaks
- Efficient platform detection (cached result)
- Minimal impact on terminal rendering performance

## Browser Compatibility

### Supported Browsers
- **Chrome/Chromium**: Full support
- **Firefox**: Full support  
- **Safari**: Full support
- **Edge**: Full support

### Requirements
- Modern browser with Clipboard API support
- HTTPS context (required for clipboard access)
- User permission for clipboard operations

## Security Notes

- **Paste Restriction**: Paste only works in interactive terminal to prevent security issues
- **Permission-Based**: Respects browser clipboard permission model
- **Content Sanitization**: Text content only, no rich media or executables
- **User-Initiated**: All operations require explicit user key combinations

## Testing

### Manual Testing
1. Start Crystal application
2. Create a new session with output
3. Select text in Output view and press `Ctrl+C` (Windows) or `Cmd+C` (macOS)
4. Switch to Terminal view
5. Press `Ctrl+V` (Windows) or `Cmd+V` (macOS) to paste
6. Verify text appears in terminal

### Automated Testing
- E2E tests in `tests/windows-formatting.spec.ts`
- Clipboard API mocking for CI environments
- Cross-platform key binding validation
- Permission handling tests

## Troubleshooting

### Common Issues

1. **Clipboard Not Working**:
   - Check browser permissions for clipboard access
   - Ensure you're using HTTPS (required for clipboard API)
   - Verify text is selected before copying

2. **Paste Not Working**:
   - Ensure you're in Terminal view (interactive mode)
   - Check that clipboard contains text content
   - Verify session is not archived

3. **Wrong Key Binding**:
   - Platform detection should be automatic
   - Check browser console for platform detection logs
   - Try both Ctrl and Cmd modifiers if unsure

### Debug Information
- Open browser console to see clipboard operation logs
- Look for `[Clipboard]` prefixed messages
- Check for permission or API errors

## Future Enhancements

Potential improvements for future versions:
- Right-click context menu with copy/paste options
- Clipboard history integration
- Rich text formatting preservation
- Drag-and-drop text operations
- Mobile device clipboard support