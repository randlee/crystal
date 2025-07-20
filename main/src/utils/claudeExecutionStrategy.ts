/**
 * Claude Code execution strategy utilities
 * 
 * Handles different ways to execute Claude Code on various platforms:
 * - auto: Try native first, fall back to WSL on Windows if needed
 * - native: Direct execution (future Windows native support)
 * - wsl: Force WSL execution on Windows
 * - custom: User-defined execution method
 */

import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

export type ClaudeExecutionMode = 'auto' | 'native' | 'wsl' | 'custom';

export interface ClaudeExecutionStrategy {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  requiresPathTranslation: boolean;
}

export interface ClaudeExecutionOptions {
  mode?: ClaudeExecutionMode;
  customPath?: string;
  worktreePath: string;
  claudeArgs: string[];
  env?: NodeJS.ProcessEnv;
}

/**
 * Determines the appropriate Claude execution strategy based on platform and configuration
 */
export function getClaudeExecutionStrategy(options: ClaudeExecutionOptions): ClaudeExecutionStrategy {
  const {
    mode = 'auto',
    customPath,
    worktreePath,
    claudeArgs,
    env = process.env
  } = options;

  const platform = os.platform();
  const isWindows = platform === 'win32';

  console.log(`[ClaudeExecution] Determining strategy: mode=${mode}, platform=${platform}, customPath=${customPath}`);

  switch (mode) {
    case 'native':
      return getNativeStrategy(customPath, worktreePath, claudeArgs, env);
      
    case 'wsl':
      if (!isWindows) {
        console.warn(`[ClaudeExecution] WSL mode requested on non-Windows platform (${platform}), falling back to native`);
        return getNativeStrategy(customPath, worktreePath, claudeArgs, env);
      }
      return getWSLStrategy(customPath, worktreePath, claudeArgs, env);
      
    case 'custom':
      if (!customPath) {
        throw new Error('Custom execution mode requires claudeExecutablePath to be set');
      }
      return getCustomStrategy(customPath, worktreePath, claudeArgs, env);
      
    case 'auto':
    default:
      return getAutoStrategy(customPath, worktreePath, claudeArgs, env);
  }
}

/**
 * Native execution strategy - direct Claude execution
 */
function getNativeStrategy(
  customPath: string | undefined,
  worktreePath: string,
  claudeArgs: string[],
  env: NodeJS.ProcessEnv
): ClaudeExecutionStrategy {
  const command = customPath || 'claude';
  
  console.log(`[ClaudeExecution] Using native strategy: command=${command}`);
  
  return {
    command,
    args: claudeArgs,
    cwd: worktreePath,
    env,
    requiresPathTranslation: false
  };
}

/**
 * WSL execution strategy - run Claude through WSL on Windows
 */
function getWSLStrategy(
  customPath: string | undefined,
  worktreePath: string,
  claudeArgs: string[],
  env: NodeJS.ProcessEnv
): ClaudeExecutionStrategy {
  // Determine the Claude command inside WSL
  let wslClaudeCommand = 'claude';
  if (customPath) {
    // If custom path is provided, it might be a Windows path that needs translation
    // or a WSL path already
    if (customPath.includes('\\') || customPath.match(/^[A-Za-z]:/)) {
      // Looks like a Windows path - user probably wants us to figure out the WSL equivalent
      console.log(`[ClaudeExecution] Custom path appears to be Windows format, using default WSL claude command`);
    } else {
      // Assume it's already a WSL path or command
      wslClaudeCommand = customPath;
    }
  }

  // Convert Windows path to WSL path
  const wslPath = convertWindowsPathToWSL(worktreePath);
  
  console.log(`[ClaudeExecution] Using WSL strategy: wsl ${wslClaudeCommand}, cwd=${wslPath}`);
  
  return {
    command: 'wsl',
    args: ['-e', 'bash', '-c', `cd '${wslPath}' && ${wslClaudeCommand} ${claudeArgs.map(arg => `'${arg.replace(/'/g, "'\"'\"'")}'`).join(' ')}`],
    cwd: worktreePath, // Keep original for any local file operations
    env,
    requiresPathTranslation: true
  };
}

/**
 * Custom execution strategy - user-defined command
 */
function getCustomStrategy(
  customPath: string,
  worktreePath: string,
  claudeArgs: string[],
  env: NodeJS.ProcessEnv
): ClaudeExecutionStrategy {
  console.log(`[ClaudeExecution] Using custom strategy: command=${customPath}`);
  
  return {
    command: customPath,
    args: claudeArgs,
    cwd: worktreePath,
    env,
    requiresPathTranslation: false
  };
}

/**
 * Auto execution strategy - try native first, fall back to WSL on Windows if needed
 */
function getAutoStrategy(
  customPath: string | undefined,
  worktreePath: string,
  claudeArgs: string[],
  env: NodeJS.ProcessEnv
): ClaudeExecutionStrategy {
  const platform = os.platform();
  const isWindows = platform === 'win32';

  console.log(`[ClaudeExecution] Using auto strategy on ${platform}`);

  if (!isWindows) {
    // Non-Windows platforms: use native execution
    return getNativeStrategy(customPath, worktreePath, claudeArgs, env);
  }

  // Windows: Check if Claude works natively first
  const claudeCommand = customPath || 'claude';
  
  try {
    // Quick test to see if Claude is available and working natively
    console.log(`[ClaudeExecution] Testing native Claude execution: ${claudeCommand}`);
    execSync(`${claudeCommand} --version`, { 
      timeout: 5000, 
      stdio: 'pipe',
      env 
    });
    
    console.log(`[ClaudeExecution] Native Claude execution works, using native strategy`);
    return getNativeStrategy(customPath, worktreePath, claudeArgs, env);
    
  } catch (error) {
    console.log(`[ClaudeExecution] Native Claude execution failed, trying WSL strategy`);
    console.log(`[ClaudeExecution] Native error: ${error instanceof Error ? error.message : String(error)}`);
    
    try {
      // Test if WSL is available
      execSync('wsl --version', { timeout: 3000, stdio: 'pipe' });
      
      // Test if Claude is available in WSL
      execSync('wsl claude --version', { timeout: 5000, stdio: 'pipe' });
      
      console.log(`[ClaudeExecution] WSL and Claude in WSL are available, using WSL strategy`);
      return getWSLStrategy(customPath, worktreePath, claudeArgs, env);
      
    } catch (wslError) {
      console.error(`[ClaudeExecution] WSL strategy also failed: ${wslError instanceof Error ? wslError.message : String(wslError)}`);
      
      // Fall back to native anyway - let the original error bubble up
      console.log(`[ClaudeExecution] Falling back to native strategy despite test failure`);
      return getNativeStrategy(customPath, worktreePath, claudeArgs, env);
    }
  }
}

/**
 * Convert a Windows path to WSL path format
 * C:\Users\user\project -> /mnt/c/Users/user/project
 */
function convertWindowsPathToWSL(windowsPath: string): string {
  // Handle UNC paths and drive letters
  if (windowsPath.match(/^[A-Za-z]:\\/)) {
    // Standard drive path: C:\path -> /mnt/c/path
    const drive = windowsPath[0].toLowerCase();
    const pathPart = windowsPath.substring(3).replace(/\\/g, '/');
    return `/mnt/${drive}/${pathPart}`;
  }
  
  // If it doesn't look like a Windows path, return as-is
  if (!windowsPath.includes('\\')) {
    return windowsPath;
  }
  
  // Generic Windows path conversion
  return windowsPath.replace(/\\/g, '/');
}

/**
 * Get the recommended execution mode for the current environment
 */
export function getRecommendedExecutionMode(): ClaudeExecutionMode {
  const platform = os.platform();
  
  if (platform === 'win32') {
    // On Windows, auto-detection is usually best
    return 'auto';
  }
  
  // On other platforms, native execution is typically correct
  return 'native';
}

/**
 * Validate that the execution strategy will work
 */
export function validateExecutionStrategy(strategy: ClaudeExecutionStrategy): {
  valid: boolean;
  error?: string;
} {
  // Basic validation - check if command exists
  try {
    if (strategy.command === 'wsl') {
      // For WSL, check if wsl command exists
      execSync('wsl --version', { timeout: 3000, stdio: 'pipe' });
    } else {
      // For other commands, this is harder to validate without actually running
      // We'll skip validation for now and let the actual spawn handle it
    }
    
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}