/**
 * Integration tests for WSL execution strategy
 * Tests end-to-end functionality with mocked external dependencies
 */

import * as os from 'os';
import { execSync } from 'child_process';
import { getClaudeExecutionStrategy } from '../utils/claudeExecutionStrategy';
import { ClaudeCodeManager } from '../services/claudeCodeManager';

// Mock external dependencies for CI
jest.mock('os');
jest.mock('child_process');
jest.mock('@homebridge/node-pty-prebuilt-multiarch');
jest.mock('../utils/claudeCodeTest');

const mockOs = os as jest.Mocked<typeof os>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('WSL Integration Tests', () => {
  
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  describe('Full execution flow', () => {
    
    test('should handle Windows auto-detection flow correctly', () => {
      mockOs.platform.mockReturnValue('win32');
      
      // Test scenario: Native fails, WSL succeeds
      mockExecSync
        .mockImplementationOnce(() => { throw new Error('claude not found'); })
        .mockReturnValueOnce(Buffer.from('WSL version 2.0'))
        .mockReturnValueOnce(Buffer.from('claude version 1.0'));
      
      const strategy = getClaudeExecutionStrategy({
        mode: 'auto',
        worktreePath: 'C:\\Users\\test\\project',
        claudeArgs: ['--prompt', 'Hello world']
      });
      
      expect(strategy.command).toBe('wsl');
      expect(strategy.requiresPathTranslation).toBe(true);
      expect(strategy.args.join(' ')).toContain('/mnt/c/Users/test/project');
    });

    test('should handle macOS/Linux native execution', () => {
      mockOs.platform.mockReturnValue('darwin');
      
      const strategy = getClaudeExecutionStrategy({
        mode: 'auto',
        worktreePath: '/Users/test/project',
        claudeArgs: ['--help']
      });
      
      expect(strategy.command).toBe('claude');
      expect(strategy.requiresPathTranslation).toBe(false);
      expect(strategy.cwd).toBe('/Users/test/project');
    });

    test('should handle custom executable paths correctly', () => {
      const customPaths = [
        { platform: 'win32', path: 'C:\\Program Files\\Claude\\claude.exe', mode: 'custom' },
        { platform: 'darwin', path: '/usr/local/bin/claude', mode: 'custom' },
        { platform: 'linux', path: '/opt/claude/bin/claude', mode: 'custom' }
      ];
      
      customPaths.forEach(({ platform, path, mode }) => {
        mockOs.platform.mockReturnValue(platform as NodeJS.Platform);
        
        const strategy = getClaudeExecutionStrategy({
          mode: mode as 'custom',
          customPath: path,
          worktreePath: '/test',
          claudeArgs: ['--version']
        });
        
        expect(strategy.command).toBe(path);
      });
    });
    
  });

  describe('Error handling scenarios', () => {
    
    test('should gracefully handle WSL not available on Windows', () => {
      mockOs.platform.mockReturnValue('win32');
      
      // Mock all commands failing
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });
      
      const strategy = getClaudeExecutionStrategy({
        mode: 'auto',
        worktreePath: 'C:\\test',
        claudeArgs: ['--help']
      });
      
      // Should fall back to native even though it will fail
      expect(strategy.command).toBe('claude');
      expect(strategy.requiresPathTranslation).toBe(false);
    });

    test('should handle permission errors during detection', () => {
      mockOs.platform.mockReturnValue('win32');
      
      mockExecSync.mockImplementation(() => {
        const error = new Error('Access denied') as any;
        error.status = 1;
        throw error;
      });
      
      // Should not crash, just fall back to native
      expect(() => getClaudeExecutionStrategy({
        mode: 'auto',
        worktreePath: 'C:\\test',
        claudeArgs: []
      })).not.toThrow();
    });
    
  });

  describe('Path translation edge cases', () => {
    
    test('should handle various Windows path formats', () => {
      mockOs.platform.mockReturnValue('win32');
      
      const testCases = [
        { input: 'C:\\Users\\Test User\\project', expected: '/mnt/c/Users/Test User/project' },
        { input: 'D:\\workspace\\app-name', expected: '/mnt/d/workspace/app-name' },
        { input: 'E:\\', expected: '/mnt/e/' },
        { input: 'relative\\path', expected: 'relative/path' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const strategy = getClaudeExecutionStrategy({
          mode: 'wsl',
          worktreePath: input,
          claudeArgs: ['--help']
        });
        
        const wslCommand = strategy.args.join(' ');
        expect(wslCommand).toContain(expected);
      });
    });

    test('should properly escape shell arguments', () => {
      mockOs.platform.mockReturnValue('win32');
      
      const strategy = getClaudeExecutionStrategy({
        mode: 'wsl',
        worktreePath: 'C:\\test',
        claudeArgs: ['--prompt', "Let's test 'quotes' and \"double quotes\""]
      });
      
      const wslCommand = strategy.args.join(' ');
      // Should properly escape quotes - verify escaped quotes are present
      expect(wslCommand).toContain("'\"'\"'");
      // Command should be formed without syntax errors
      expect(wslCommand).toContain("cd '/mnt/c/test'");
      expect(wslCommand).toContain("claude");
    });
    
  });

  describe('Performance considerations', () => {
    
    test('should timeout command detection appropriately', () => {
      mockOs.platform.mockReturnValue('win32');
      
      let callCount = 0;
      mockExecSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Simulate timeout on first call
          throw new Error('Command timed out');
        }
        return Buffer.from('success');
      });
      
      const strategy = getClaudeExecutionStrategy({
        mode: 'auto',
        worktreePath: 'C:\\test',
        claudeArgs: []
      });
      
      // Verify that execSync was called with timeout options
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: expect.any(Number) })
      );
    });

    test('should not block on slow command detection', () => {
      mockOs.platform.mockReturnValue('win32');
      
      const start = Date.now();
      
      // Mock slow response
      mockExecSync.mockImplementation(() => {
        throw new Error('Timeout');
      });
      
      getClaudeExecutionStrategy({
        mode: 'auto',
        worktreePath: 'C:\\test',
        claudeArgs: []
      });
      
      const duration = Date.now() - start;
      // Should complete quickly even with timeouts
      expect(duration).toBeLessThan(100);
    });
    
  });

  describe('CI/CD compatibility', () => {
    
    test('should work without actual WSL installed', () => {
      mockOs.platform.mockReturnValue('win32');
      mockExecSync.mockImplementation(() => { throw new Error('WSL not found'); });
      
      // Should not throw, just return a strategy
      expect(() => getClaudeExecutionStrategy({
        mode: 'wsl',
        worktreePath: 'C:\\test',
        claudeArgs: []
      })).not.toThrow();
    });

    test('should work without Claude installed', () => {
      mockExecSync.mockImplementation(() => { throw new Error('claude not found'); });
      
      // Should still return valid strategies
      ['auto', 'native', 'wsl'].forEach(mode => {
        expect(() => getClaudeExecutionStrategy({
          mode: mode as any,
          worktreePath: '/test',
          claudeArgs: []
        })).not.toThrow();
      });
    });

    test('should handle environment variables correctly', () => {
      const customEnv = { PATH: '/custom/path', TEST: 'value' };
      
      const strategy = getClaudeExecutionStrategy({
        mode: 'native',
        worktreePath: '/test',
        claudeArgs: [],
        env: customEnv
      });
      
      expect(strategy.env).toEqual(customEnv);
    });
    
  });
  
});