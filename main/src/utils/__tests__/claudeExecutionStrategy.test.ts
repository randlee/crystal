/**
 * Unit tests for Claude execution strategy utilities
 * Tests WSL execution, path translation, and execution mode selection
 */

import * as os from 'os';
import { execSync } from 'child_process';
import {
  getClaudeExecutionStrategy,
  getRecommendedExecutionMode,
  validateExecutionStrategy,
  ClaudeExecutionMode,
  ClaudeExecutionOptions,
  ClaudeExecutionStrategy
} from '../claudeExecutionStrategy';

// Mock dependencies for CI compatibility
jest.mock('os');
jest.mock('child_process');

const mockOs = os as jest.Mocked<typeof os>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('Claude Execution Strategy', () => {
  
  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();
    
    // Clear console logs for clean test output
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  describe('getClaudeExecutionStrategy', () => {
    
    const baseOptions: ClaudeExecutionOptions = {
      worktreePath: '/test/path',
      claudeArgs: ['--verbose'],
      env: { TEST: 'true' }
    };

    describe('Native execution mode', () => {
      
      test('should use native strategy with default command', () => {
        const options = { ...baseOptions, mode: 'native' as ClaudeExecutionMode };
        
        const strategy = getClaudeExecutionStrategy(options);
        
        expect(strategy).toEqual({
          command: 'claude',
          args: ['--verbose'],
          cwd: '/test/path',
          env: { TEST: 'true' },
          requiresPathTranslation: false
        });
      });

      test('should use custom path when provided', () => {
        const options = { 
          ...baseOptions, 
          mode: 'native' as ClaudeExecutionMode,
          customPath: '/custom/claude'
        };
        
        const strategy = getClaudeExecutionStrategy(options);
        
        expect(strategy.command).toBe('/custom/claude');
      });
      
    });

    describe('WSL execution mode', () => {
      
      test('should create WSL strategy on Windows', () => {
        mockOs.platform.mockReturnValue('win32');
        
        const options = { ...baseOptions, mode: 'wsl' as ClaudeExecutionMode };
        const strategy = getClaudeExecutionStrategy(options);
        
        expect(strategy.command).toBe('wsl');
        expect(strategy.args[0]).toBe('-e');
        expect(strategy.requiresPathTranslation).toBe(true);
      });

      test('should fall back to native on non-Windows platforms', () => {
        mockOs.platform.mockReturnValue('linux');
        
        const options = { ...baseOptions, mode: 'wsl' as ClaudeExecutionMode };
        const strategy = getClaudeExecutionStrategy(options);
        
        // Should fall back to native
        expect(strategy.command).toBe('claude');
        expect(strategy.requiresPathTranslation).toBe(false);
      });
      
    });

    describe('Custom execution mode', () => {
      
      test('should use custom path', () => {
        const options = { 
          ...baseOptions, 
          mode: 'custom' as ClaudeExecutionMode,
          customPath: '/usr/local/bin/claude'
        };
        
        const strategy = getClaudeExecutionStrategy(options);
        
        expect(strategy.command).toBe('/usr/local/bin/claude');
        expect(strategy.requiresPathTranslation).toBe(false);
      });

      test('should throw error when custom path missing', () => {
        const options = { ...baseOptions, mode: 'custom' as ClaudeExecutionMode };
        
        expect(() => getClaudeExecutionStrategy(options))
          .toThrow('Custom execution mode requires claudeExecutablePath to be set');
      });
      
    });

    describe('Auto execution mode', () => {
      
      test('should use native on non-Windows platforms', () => {
        mockOs.platform.mockReturnValue('darwin');
        
        const options = { ...baseOptions, mode: 'auto' as ClaudeExecutionMode };
        const strategy = getClaudeExecutionStrategy(options);
        
        expect(strategy.command).toBe('claude');
        expect(strategy.requiresPathTranslation).toBe(false);
      });

      test('should try native first on Windows when available', () => {
        mockOs.platform.mockReturnValue('win32');
        // Mock successful native Claude execution
        mockExecSync.mockReturnValue(Buffer.from('claude version 1.0'));
        
        const options = { ...baseOptions, mode: 'auto' as ClaudeExecutionMode };
        const strategy = getClaudeExecutionStrategy(options);
        
        expect(strategy.command).toBe('claude');
        expect(mockExecSync).toHaveBeenCalledWith('claude --version', expect.any(Object));
      });

      test('should fall back to WSL when native fails on Windows', () => {
        mockOs.platform.mockReturnValue('win32');
        // Mock native failure, WSL success
        mockExecSync
          .mockImplementationOnce(() => { throw new Error('claude not found'); })
          .mockReturnValueOnce(Buffer.from('WSL 2'))
          .mockReturnValueOnce(Buffer.from('claude version 1.0'));
        
        const options = { ...baseOptions, mode: 'auto' as ClaudeExecutionMode };
        const strategy = getClaudeExecutionStrategy(options);
        
        expect(strategy.command).toBe('wsl');
        expect(strategy.requiresPathTranslation).toBe(true);
      });

      test('should fall back to native when both native and WSL fail', () => {
        mockOs.platform.mockReturnValue('win32');
        // Mock all execSync calls to fail
        mockExecSync.mockImplementation(() => { throw new Error('Command failed'); });
        
        const options = { ...baseOptions, mode: 'auto' as ClaudeExecutionMode };
        const strategy = getClaudeExecutionStrategy(options);
        
        // Should still return native strategy despite failures
        expect(strategy.command).toBe('claude');
        expect(strategy.requiresPathTranslation).toBe(false);
      });
      
    });
    
  });

  describe('Path translation (Windows to WSL)', () => {
    
    test('should convert C: drive path correctly', () => {
      mockOs.platform.mockReturnValue('win32');
      
      const options: ClaudeExecutionOptions = {
        mode: 'wsl',
        worktreePath: 'C:\\Users\\test\\project',
        claudeArgs: ['--help']
      };
      
      const strategy = getClaudeExecutionStrategy(options);
      
      // Extract the cd path from WSL command
      const wslCommand = strategy.args.join(' ');
      expect(wslCommand).toContain('/mnt/c/Users/test/project');
    });

    test('should handle different drive letters', () => {
      mockOs.platform.mockReturnValue('win32');
      
      const options: ClaudeExecutionOptions = {
        mode: 'wsl',
        worktreePath: 'D:\\workspace\\myapp',
        claudeArgs: ['--version']
      };
      
      const strategy = getClaudeExecutionStrategy(options);
      
      const wslCommand = strategy.args.join(' ');
      expect(wslCommand).toContain('/mnt/d/workspace/myapp');
    });

    test('should handle paths without drive letters', () => {
      mockOs.platform.mockReturnValue('win32');
      
      const options: ClaudeExecutionOptions = {
        mode: 'wsl',
        worktreePath: 'relative\\path\\test',
        claudeArgs: ['--help']
      };
      
      const strategy = getClaudeExecutionStrategy(options);
      
      const wslCommand = strategy.args.join(' ');
      expect(wslCommand).toContain('relative/path/test');
    });

    test('should escape quotes in Claude arguments', () => {
      mockOs.platform.mockReturnValue('win32');
      
      const options: ClaudeExecutionOptions = {
        mode: 'wsl',
        worktreePath: 'C:\\test',
        claudeArgs: ['--prompt', "Hello 'world'"]
      };
      
      const strategy = getClaudeExecutionStrategy(options);
      
      const wslCommand = strategy.args.join(' ');
      // Should properly escape single quotes
      expect(wslCommand).toContain("'Hello '\"'\"'world'\"'\"''");
    });
    
  });

  describe('getRecommendedExecutionMode', () => {
    
    test('should recommend auto for Windows', () => {
      mockOs.platform.mockReturnValue('win32');
      
      const mode = getRecommendedExecutionMode();
      
      expect(mode).toBe('auto');
    });

    test('should recommend native for macOS', () => {
      mockOs.platform.mockReturnValue('darwin');
      
      const mode = getRecommendedExecutionMode();
      
      expect(mode).toBe('native');
    });

    test('should recommend native for Linux', () => {
      mockOs.platform.mockReturnValue('linux');
      
      const mode = getRecommendedExecutionMode();
      
      expect(mode).toBe('native');
    });
    
  });

  describe('validateExecutionStrategy', () => {
    
    test('should validate WSL strategy by checking WSL command', () => {
      mockExecSync.mockReturnValue(Buffer.from('WSL version info'));
      
      const strategy: ClaudeExecutionStrategy = {
        command: 'wsl',
        args: ['-e', 'claude', '--help'],
        cwd: '/test',
        env: {},
        requiresPathTranslation: true
      };
      
      const result = validateExecutionStrategy(strategy);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockExecSync).toHaveBeenCalledWith('wsl --version', expect.any(Object));
    });

    test('should return invalid when WSL is not available', () => {
      mockExecSync.mockImplementation(() => { throw new Error('WSL not found'); });
      
      const strategy: ClaudeExecutionStrategy = {
        command: 'wsl',
        args: ['-e', 'claude'],
        cwd: '/test',
        env: {},
        requiresPathTranslation: true
      };
      
      const result = validateExecutionStrategy(strategy);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('WSL not found');
    });

    test('should skip validation for non-WSL commands', () => {
      const strategy: ClaudeExecutionStrategy = {
        command: 'claude',
        args: ['--help'],
        cwd: '/test',
        env: {},
        requiresPathTranslation: false
      };
      
      const result = validateExecutionStrategy(strategy);
      
      expect(result.valid).toBe(true);
      expect(mockExecSync).not.toHaveBeenCalled();
    });
    
  });

  describe('Error handling and edge cases', () => {
    
    test('should handle undefined custom path gracefully', () => {
      const options: ClaudeExecutionOptions = {
        mode: 'native',
        worktreePath: '/test',
        claudeArgs: [],
        customPath: undefined
      };
      
      const strategy = getClaudeExecutionStrategy(options);
      
      expect(strategy.command).toBe('claude');
    });

    test('should handle empty environment variables', () => {
      const options: ClaudeExecutionOptions = {
        mode: 'native',
        worktreePath: '/test',
        claudeArgs: [],
        env: undefined
      };
      
      const strategy = getClaudeExecutionStrategy(options);
      
      expect(strategy.env).toBe(process.env);
    });

    test('should handle Windows path with custom WSL executable', () => {
      mockOs.platform.mockReturnValue('win32');
      
      const options: ClaudeExecutionOptions = {
        mode: 'wsl',
        worktreePath: 'C:\\test',
        claudeArgs: [],
        customPath: '/usr/local/bin/claude-custom'
      };
      
      const strategy = getClaudeExecutionStrategy(options);
      
      const wslCommand = strategy.args.join(' ');
      expect(wslCommand).toContain('/usr/local/bin/claude-custom');
    });

    test('should ignore Windows-style custom path in WSL mode', () => {
      mockOs.platform.mockReturnValue('win32');
      
      const options: ClaudeExecutionOptions = {
        mode: 'wsl',
        worktreePath: 'C:\\test',
        claudeArgs: [],
        customPath: 'C:\\Program Files\\Claude\\claude.exe'
      };
      
      const strategy = getClaudeExecutionStrategy(options);
      
      const wslCommand = strategy.args.join(' ');
      // Should use default 'claude' command, not the Windows path
      expect(wslCommand).toContain('claude');
      expect(wslCommand).not.toContain('Program Files');
    });
    
  });
  
});