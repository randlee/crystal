# Crystal Windows Terminal Formatting Debug Guide

## Issue Summary
Crystal app installs and runs on Windows, connects to Claude Code in WSL, but shows unreadable JSON instead of formatted terminal output. Raw Azure MCP service lists appear instead of clean, user-friendly text.

## Root Cause Analysis
The issue is likely caused by one or more of these factors:

1. **ANSI Escape Codes**: Windows terminals (especially older ones) don't support ANSI color/formatting codes
2. **Unicode Symbols**: Emojis and special characters don't render properly in Windows Command Prompt
3. **Line Endings**: WSL outputs Unix line endings (`\n`) but Windows expects (`\r\n`)
4. **Terminal Capabilities**: Missing `COLORTERM` or `TERM` environment variables

## Solution Implemented

### 1. Windows Compatibility Layer
Created `main/src/utils/windowsTerminalCompat.ts` with:
- Automatic detection of Windows terminal capabilities
- ANSI code stripping/replacement with text alternatives
- Unicode symbol replacement with ASCII equivalents
- Line ending normalization
- Smart fallback formatting

### 2. Integration Points
Updated `main/src/ipc/session.ts` at the `sessions:get-output` handler to:
- Detect Windows formatting issues automatically
- Apply compatibility layer when needed
- Log debug information for troubleshooting

### 3. Fallback Formatting Examples

**Normal Output:**
```
[12:34:56] 🚀 Claude Code Session Started
  Session ID: sess_123
  Available tools: mcp__Azure__azmcp-subscription-list
```

**Windows Compatible:**
```
[12:34:56] [START] Claude Code Session Started
  Session ID: sess_123
  Available tools: mcp__Azure__azmcp-subscription-list
```

## Testing the Fix

### Option 1: Quick Platform Test
```bash
cd crystal
node main/src/utils/__tests__/run-windows-test.js
```

This shows:
- Platform capabilities
- ANSI color test
- Unicode symbol test
- Compatibility recommendations

### Option 2: Full Development Test
```bash
cd crystal
pnpm run build:main
pnpm electron-dev
```

Then:
1. Create a new session
2. Check console for: `[IPC] Windows formatting issues detected, using compatibility layer`
3. Verify terminal output is readable

### Option 3: Unit Tests
```bash
cd crystal/main
npm install
npm test  # Runs Jest tests for formatters
```

## Debug Logging

When the compatibility layer activates, you'll see these console logs:

```
[IPC] Windows formatting issues detected, using compatibility layer
[IPC] Platform: Windows=true, WSL=false
[IPC] Recommended fixes: ["Enable Windows Terminal", "Set COLORTERM environment variable"]
[WindowsCompat] ANSI codes converted to text alternatives
[WindowsCompat] Unicode symbols replaced with ASCII
```

## Manual Override

If you want to force the compatibility layer on/off, edit `main/src/utils/windowsTerminalCompat.ts`:

```typescript
// Force enable compatibility
export function detectWindowsFormattingIssues() {
  return {
    isWindows: true,
    isWSL: false,
    likelyHasIssues: true,  // Force to true
    recommendedFixes: ['Manual override enabled']
  };
}
```

## Files Created/Modified

### New Files:
- `main/src/utils/windowsTerminalCompat.ts` - Main compatibility layer
- `main/src/utils/__tests__/formatters.test.ts` - Unit tests
- `main/src/utils/__tests__/windows-diagnostic.ts` - Diagnostic tool
- `main/src/utils/__tests__/windows-compat-test.ts` - Compatibility tests
- `main/src/utils/__tests__/test-runner.ts` - Test runner
- `main/src/utils/__tests__/run-windows-test.js` - Quick test script
- `main/jest.config.js` - Jest configuration

### Modified Files:
- `main/src/ipc/session.ts` - Added compatibility layer integration
- `main/package.json` - Added Jest dependencies and test scripts

## Verification Steps

1. **Check Logs**: Look for Windows compatibility messages in console
2. **Test Formatting**: Verify Azure MCP responses show readable text
3. **Compare Platforms**: Test the same session on macOS/Linux vs Windows
4. **Terminal Types**: Test with Command Prompt, PowerShell, Windows Terminal

## Next Steps if Issue Persists

1. **Environment Variables**: Set `COLORTERM=truecolor TERM=xterm-256color` in WSL
2. **Terminal Upgrade**: Use Windows Terminal instead of Command Prompt
3. **Debug Mode**: Enable verbose logging in Crystal settings
4. **Raw Output**: Check if the issue is in formatting or Claude Code itself
5. **WSL Integration**: Verify WSL properly communicates with Windows terminal

## Rollback Plan

If the changes cause issues, revert `main/src/ipc/session.ts` to use the original formatter:

```typescript
// Revert to original
const outputText = formatJsonForOutputEnhanced(output.data);
```

## Contact Information

This debug guide was created to resolve Windows terminal formatting issues in Crystal. The changes are designed to be backward compatible and shouldn't affect macOS/Linux functionality.