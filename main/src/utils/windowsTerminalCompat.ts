/**
 * Windows Terminal Compatibility Layer
 * 
 * This module provides compatibility utilities for Windows terminal output,
 * specifically addressing issues with ANSI escape codes and line endings
 * when Crystal runs on Windows and connects to Claude Code via WSL.
 */

import * as os from 'os';

export interface TerminalCompatOptions {
  /** Force Windows line endings even on non-Windows platforms */
  forceWindowsLineEndings?: boolean;
  /** Disable ANSI codes if terminal doesn't support them */
  disableAnsiCodes?: boolean;
  /** Use alternative symbols for unsupported Unicode characters */
  useAsciiSymbols?: boolean;
}

/**
 * Detects the current platform's terminal capabilities
 */
export function detectTerminalCapabilities(): {
  supportsAnsi: boolean;
  supportsUnicode: boolean;
  platform: string;
  isWSL: boolean;
} {
  const platform = os.platform();
  const isWSL = process.env.WSL_DISTRO_NAME !== undefined || 
                process.env.WSLENV !== undefined ||
                os.release().toLowerCase().includes('microsoft');
  
  // Windows CMD and older PowerShell don't support ANSI by default
  // WSL terminals usually do support ANSI
  const supportsAnsi = platform !== 'win32' || 
                       isWSL ||
                       process.env.COLORTERM !== undefined ||
                       process.env.TERM !== undefined;
  
  // Most modern terminals support Unicode
  const supportsUnicode = true;
  
  return {
    supportsAnsi,
    supportsUnicode,
    platform,
    isWSL
  };
}

/**
 * Converts ANSI escape codes to plain text fallbacks for unsupported terminals
 */
export function stripOrReplaceAnsiCodes(text: string, useAlternatives: boolean = false): string {
  if (useAlternatives) {
    // Replace with text alternatives
    return text
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[36m(.*?)\x1b\[0m/g, '[$1]')     // Cyan -> [text]
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[1m(.*?)\x1b\[0m/g, '$1')        // Bold -> text
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[90m(.*?)\x1b\[0m/g, '($1)')     // Gray -> (text)
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[31m(.*?)\x1b\[0m/g, 'ERROR: $1') // Red -> ERROR: text
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[33m(.*?)\x1b\[0m/g, 'WARN: $1')  // Yellow -> WARN: text
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[32m(.*?)\x1b\[0m/g, 'OK: $1')    // Green -> OK: text
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[[0-9;]*m/g, ''); // Remove remaining codes
  } else {
    // Simply strip all ANSI codes
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }
}

/**
 * Replaces Unicode symbols with ASCII alternatives for better compatibility
 */
export function replaceUnicodeSymbols(text: string): string {
  return text
    .replace(/🚀/g, '[START]')
    .replace(/🤖/g, '[AI]')
    .replace(/👤/g, '[USER]')
    .replace(/🔧/g, '[TOOL]')
    .replace(/📊/g, '[STATS]')
    .replace(/❌/g, '[ERROR]')
    .replace(/✅/g, '[OK]')
    .replace(/⚠️/g, '[WARN]')
    .replace(/🧠/g, '[THINK]')
    .replace(/📝/g, '[NOTE]')
    .replace(/⏳/g, '[WAIT]')
    .replace(/✓/g, 'OK')
    .replace(/✗/g, 'FAIL')
    .replace(/→/g, '->')
    .replace(/○/g, 'o')
    .replace(/┌─/g, '+-')
    .replace(/├─/g, '+-')
    .replace(/└─/g, '+-')
    .replace(/│/g, '|')
    .replace(/─/g, '-');
}

/**
 * Normalizes line endings for the target platform
 */
export function normalizeLineEndings(text: string, options: TerminalCompatOptions = {}): string {
  const { forceWindowsLineEndings = false } = options;
  const platform = os.platform();
  
  if (forceWindowsLineEndings || platform === 'win32') {
    // Convert all line endings to Windows format
    return text.replace(/\r?\n/g, '\r\n');
  } else {
    // Convert to Unix line endings
    return text.replace(/\r\n/g, '\n');
  }
}

/**
 * Applies Windows terminal compatibility transformations to text
 */
export function makeWindowsCompatible(text: string, options: TerminalCompatOptions = {}): string {
  const capabilities = detectTerminalCapabilities();
  let result = text;
  
  console.log(`[WindowsCompat] Platform: ${capabilities.platform}, WSL: ${capabilities.isWSL}, ANSI: ${capabilities.supportsAnsi}`);
  
  // Handle ANSI codes
  if (!capabilities.supportsAnsi || options.disableAnsiCodes) {
    result = stripOrReplaceAnsiCodes(result, true);
    console.log('[WindowsCompat] ANSI codes converted to text alternatives');
  }
  
  // Handle Unicode symbols
  if (!capabilities.supportsUnicode || options.useAsciiSymbols) {
    result = replaceUnicodeSymbols(result);
    console.log('[WindowsCompat] Unicode symbols replaced with ASCII');
  }
  
  // Handle line endings
  result = normalizeLineEndings(result, options);
  
  return result;
}

/**
 * Windows-compatible version of formatJsonForOutput
 */
export function formatJsonForOutputWindows(jsonMessage: unknown, options: TerminalCompatOptions = {}): string {
  // Import formatters dynamically to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { formatJsonForOutput } = require('./formatters');
  
  const originalOutput = formatJsonForOutput(jsonMessage);
  return makeWindowsCompatible(originalOutput, options);
}

/**
 * Windows-compatible version of formatJsonForOutputEnhanced
 */
export function formatJsonForOutputEnhancedWindows(jsonMessage: unknown, gitRepoPath?: string, options: TerminalCompatOptions = {}): string {
  // Import formatters dynamically to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { formatJsonForOutputEnhanced } = require('./formatters');
  
  const originalOutput = formatJsonForOutputEnhanced(jsonMessage, gitRepoPath);
  return makeWindowsCompatible(originalOutput, options);
}

/**
 * Detects if we're likely experiencing Windows terminal formatting issues
 */
export function detectWindowsFormattingIssues(): {
  isWindows: boolean;
  isWSL: boolean;
  likelyHasIssues: boolean;
  recommendedFixes: string[];
} {
  const capabilities = detectTerminalCapabilities();
  const recommendedFixes: string[] = [];
  
  let likelyHasIssues = false;
  
  // Windows without ANSI support
  if (capabilities.platform === 'win32' && !capabilities.supportsAnsi) {
    likelyHasIssues = true;
    recommendedFixes.push('Enable Windows Terminal or use a terminal that supports ANSI codes');
  }
  
  // WSL without proper terminal setup
  if (capabilities.isWSL && !process.env.COLORTERM) {
    likelyHasIssues = true;
    recommendedFixes.push('Set COLORTERM environment variable in WSL');
  }
  
  // Missing TERM variable
  if (!process.env.TERM) {
    likelyHasIssues = true;
    recommendedFixes.push('Set TERM environment variable (e.g., TERM=xterm-256color)');
  }
  
  return {
    isWindows: capabilities.platform === 'win32',
    isWSL: capabilities.isWSL,
    likelyHasIssues,
    recommendedFixes
  };
}

/**
 * Creates a simple test message to validate terminal formatting
 */
export function createTerminalTest(): string {
  const testMessage = {
    type: 'system',
    subtype: 'init',
    session_id: 'test_session',
    tools: ['Bash', 'Read', 'mcp__Azure__azmcp-subscription-list'],
    timestamp: new Date().toISOString()
  };
  
  return formatJsonForOutputWindows(testMessage);
}