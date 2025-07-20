/**
 * Unit tests for ClaudeCodeManager WSL integration
 * Tests configuration loading, execution strategy selection, and process spawning
 */

import { EventEmitter } from 'events';
import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import * as os from 'os';
import { ClaudeCodeManager } from '../claudeCodeManager';
import * as claudeExecutionStrategy from '../../utils/claudeExecutionStrategy';
import * as claudeCodeTest from '../../utils/claudeCodeTest';

// Mock all dependencies for CI compatibility
jest.mock('@homebridge/node-pty-prebuilt-multiarch');
jest.mock('os');
jest.mock('../../utils/claudeCodeTest');
jest.mock('../../utils/claudeExecutionStrategy');
jest.mock('../../utils/nodeFinder');
jest.mock('../../utils/shellPath');

const mockPty = pty as jest.Mocked<typeof pty>;
const mockOs = os as jest.Mocked<typeof os>;
const mockClaudeCodeTest = claudeCodeTest as jest.Mocked<typeof claudeCodeTest>;
const mockStrategy = claudeExecutionStrategy as jest.Mocked<typeof claudeExecutionStrategy>;

// Mock PTY process
const mockPtyProcess = {
  write: jest.fn(),
  kill: jest.fn(),
  resize: jest.fn(),
  pid: 1234,
  cols: 80,
  rows: 24,
  process: 'claude',
  handleFlowControl: false,
  onData: jest.fn(),
  onExit: jest.fn()
} as any;

describe('ClaudeCodeManager WSL Integration', () => {
  
  let manager: ClaudeCodeManager;
  let mockSessionManager: any;
  let mockConfigManager: any;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();
    
    // Mock dependencies
    mockPty.spawn.mockReturnValue(mockPtyProcess);
    mockClaudeCodeTest.testClaudeCodeAvailability.mockResolvedValue({ available: true, version: '1.0' });
    
    // Create mock managers
    mockSessionManager = {
      updateSessionStatus: jest.fn(),
      addSessionOutput: jest.fn()
    };
    
    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        claudeExecutionMode: 'auto',
        claudeExecutablePath: undefined,
        verbose: false
      })
    };
    
    mockLogger = {
      verbose: jest.fn(),
      error: jest.fn(),
      info: jest.fn()
    };
    
    manager = new ClaudeCodeManager(mockSessionManager, mockLogger, mockConfigManager);
    
    // Clear console logs
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  describe('Execution strategy integration', () => {
    
    test('should use auto mode by default', async () => {
      mockStrategy.getClaudeExecutionStrategy.mockReturnValue({
        command: 'claude',
        args: ['--prompt', 'test'],
        cwd: '/test/path',
        env: process.env,
        requiresPathTranslation: false
      });
      
      await manager.spawnClaudeCode('test-session', '/test/path', 'test prompt');
      
      expect(mockStrategy.getClaudeExecutionStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'auto',
          worktreePath: '/test/path'
        })
      );
    });

    test('should use configured execution mode', async () => {
      mockConfigManager.getConfig.mockReturnValue({
        claudeExecutionMode: 'wsl',
        claudeExecutablePath: '/custom/claude'
      });
      
      mockStrategy.getClaudeExecutionStrategy.mockReturnValue({
        command: 'wsl',
        args: ['-e', 'bash', '-c', "cd '/mnt/c/test' && claude '--prompt' 'test'"],
        cwd: '/test/path',
        env: process.env,
        requiresPathTranslation: true
      });
      
      await manager.spawnClaudeCode('test-session', 'C:\\test', 'test prompt');
      
      expect(mockStrategy.getClaudeExecutionStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'wsl',
          customPath: '/custom/claude'
        })
      );
    });

    test('should handle WSL execution strategy correctly', async () => {
      mockStrategy.getClaudeExecutionStrategy.mockReturnValue({
        command: 'wsl',
        args: ['-e', 'bash', '-c', "cd '/mnt/c/test' && claude '--prompt' 'test'"],
        cwd: 'C:\\test',
        env: process.env,
        requiresPathTranslation: true
      });
      
      await manager.spawnClaudeCode('test-session', 'C:\\test', 'test prompt');
      
      expect(mockPty.spawn).toHaveBeenCalledWith(
        'wsl',
        ['-e', 'bash', '-c', "cd '/mnt/c/test' && claude '--prompt' 'test'"],
        expect.objectContaining({
          cwd: 'C:\\test'
        })
      );
    });
    
  });

  describe('Configuration handling', () => {
    
    test('should load execution mode from config', async () => {
      const configs = [
        { claudeExecutionMode: 'native', expected: 'native' },
        { claudeExecutionMode: 'wsl', expected: 'wsl' },
        { claudeExecutionMode: 'custom', expected: 'custom' },
        { claudeExecutionMode: undefined, expected: 'auto' } // default
      ];
      
      for (const { claudeExecutionMode, expected } of configs) {
        mockConfigManager.getConfig.mockReturnValue({ claudeExecutionMode });
        mockStrategy.getClaudeExecutionStrategy.mockReturnValue({
          command: 'claude',
          args: [],
          cwd: '/test',
          env: {},
          requiresPathTranslation: false
        });
        
        await manager.spawnClaudeCode('test', '/test', 'test');
        
        expect(mockStrategy.getClaudeExecutionStrategy).toHaveBeenCalledWith(
          expect.objectContaining({ mode: expected })
        );
        
        jest.clearAllMocks();
      }
    });

    test('should pass custom executable path to strategy', async () => {
      const customPath = '/usr/local/bin/claude';
      mockConfigManager.getConfig.mockReturnValue({
        claudeExecutionMode: 'custom',
        claudeExecutablePath: customPath
      });
      
      mockStrategy.getClaudeExecutionStrategy.mockReturnValue({
        command: customPath,
        args: ['--prompt', 'test'],
        cwd: '/test',
        env: {},
        requiresPathTranslation: false
      });
      
      await manager.spawnClaudeCode('test', '/test', 'test');
      
      expect(mockStrategy.getClaudeExecutionStrategy).toHaveBeenCalledWith(
        expect.objectContaining({ customPath })
      );
    });

    test('should handle missing config gracefully', async () => {
      mockConfigManager.getConfig.mockReturnValue({});
      
      mockStrategy.getClaudeExecutionStrategy.mockReturnValue({
        command: 'claude',
        args: [],
        cwd: '/test',
        env: {},
        requiresPathTranslation: false
      });
      
      await manager.spawnClaudeCode('test', '/test', 'test');
      
      // Should default to 'auto' mode
      expect(mockStrategy.getClaudeExecutionStrategy).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'auto' })
      );
    });
    
  });

  describe('Process spawning', () => {
    
    test('should spawn process with strategy command and args', async () => {
      const strategy = {
        command: 'wsl',
        args: ['-e', 'claude', '--help'],
        cwd: '/test',
        env: { TEST: 'true' },
        requiresPathTranslation: true
      };
      
      mockStrategy.getClaudeExecutionStrategy.mockReturnValue(strategy);
      
      await manager.spawnClaudeCode('test', '/test', 'test');
      
      expect(mockPty.spawn).toHaveBeenCalledWith(
        'wsl',
        ['-e', 'claude', '--help'],
        expect.objectContaining({
          cwd: '/test',
          env: expect.objectContaining({ TEST: 'true' })
        })
      );
    });

    test('should handle process spawn errors', async () => {
      mockPty.spawn.mockImplementation(() => {
        throw new Error('Process spawn failed');
      });
      
      const emitSpy = jest.spyOn(manager, 'emit');
      
      await manager.spawnClaudeCode('test', '/test', 'test');
      
      expect(emitSpy).toHaveBeenCalledWith('output', expect.objectContaining({
        sessionId: 'test',
        type: 'json',
        data: expect.objectContaining({
          type: 'session',
          data: expect.objectContaining({
            status: 'error'
          })
        })
      }));
    });

    test('should emit process exit events', async () => {
      let exitCallback: Function | undefined;
      mockPtyProcess.onExit.mockImplementation((callback: Function) => {
        exitCallback = callback;
      });
      
      mockStrategy.getClaudeExecutionStrategy.mockReturnValue({
        command: 'claude',
        args: [],
        cwd: '/test',
        env: {},
        requiresPathTranslation: false
      });
      
      const emitSpy = jest.spyOn(manager, 'emit');
      
      await manager.spawnClaudeCode('test', '/test', 'test');
      
      // Simulate process exit
      if (exitCallback) {
        exitCallback({ exitCode: 0, signal: undefined });
      }
      
      expect(emitSpy).toHaveBeenCalledWith('output', expect.objectContaining({
        sessionId: 'test',
        type: 'json',
        data: expect.objectContaining({
          type: 'session',
          data: expect.objectContaining({
            status: 'completed'
          })
        })
      }));
    });
    
  });

  describe('Claude availability checking', () => {
    
    test('should handle Claude not available error', async () => {
      mockClaudeCodeTest.testClaudeCodeAvailability.mockResolvedValue({
        available: false,
        error: 'Claude not found in PATH'
      });
      
      const emitSpy = jest.spyOn(manager, 'emit');
      
      await manager.spawnClaudeCode('test', '/test', 'test');
      
      expect(emitSpy).toHaveBeenCalledWith('output', expect.objectContaining({
        sessionId: 'test',
        type: 'json',
        data: expect.objectContaining({
          type: 'session',
          data: expect.objectContaining({
            status: 'error',
            message: 'Claude Code not available'
          })
        })
      }));
    });

    test('should cache availability results', async () => {
      mockClaudeCodeTest.testClaudeCodeAvailability.mockResolvedValue({
        available: true,
        version: '1.0'
      });
      
      // First call
      await manager.spawnClaudeCode('test1', '/test', 'test');
      // Second call should use cache
      await manager.spawnClaudeCode('test2', '/test', 'test');
      
      // Should only call availability check once
      expect(mockClaudeCodeTest.testClaudeCodeAvailability).toHaveBeenCalledTimes(1);
    });
    
  });

  describe('Argument handling', () => {
    
    test('should include system prompts in arguments', async () => {
      mockConfigManager.getConfig.mockReturnValue({
        systemPromptAppend: 'Global system prompt'
      });
      
      // Mock project config
      jest.doMock('path', () => ({
        join: jest.fn().mockReturnValue('/test/.crystal/project-config.json'),
        resolve: jest.fn().mockReturnValue('/test')
      }));
      
      jest.doMock('fs', () => ({
        existsSync: jest.fn().mockReturnValue(true),
        readFileSync: jest.fn().mockReturnValue(JSON.stringify({
          systemPromptAppend: 'Project system prompt'
        }))
      }));
      
      mockStrategy.getClaudeExecutionStrategy.mockImplementation((options) => {
        return {
          command: 'claude',
          args: options.claudeArgs,
          cwd: '/test',
          env: {},
          requiresPathTranslation: false
        };
      });
      
      await manager.spawnClaudeCode('test', '/test', 'test prompt');
      
      expect(mockStrategy.getClaudeExecutionStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          claudeArgs: expect.arrayContaining([
            '--prompt', 'test prompt'
          ])
        })
      );
    });

    test('should handle conversation history for resume', async () => {
      const history = ['Previous message 1', 'Previous message 2'];
      
      mockStrategy.getClaudeExecutionStrategy.mockImplementation((options) => {
        return {
          command: 'claude',
          args: options.claudeArgs,
          cwd: '/test',
          env: {},
          requiresPathTranslation: false
        };
      });
      
      await manager.spawnClaudeCode('test', '/test', 'test', history, true);
      
      expect(mockStrategy.getClaudeExecutionStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          claudeArgs: expect.arrayContaining(['--resume'])
        })
      );
    });
    
  });

  describe('Error scenarios', () => {
    
    test('should handle strategy validation failure', async () => {
      mockStrategy.validateExecutionStrategy.mockReturnValue({
        valid: false,
        error: 'WSL not available'
      });
      
      mockStrategy.getClaudeExecutionStrategy.mockReturnValue({
        command: 'wsl',
        args: [],
        cwd: '/test',
        env: {},
        requiresPathTranslation: true
      });
      
      const emitSpy = jest.spyOn(manager, 'emit');
      
      await manager.spawnClaudeCode('test', '/test', 'test');
      
      expect(emitSpy).toHaveBeenCalledWith('output', expect.objectContaining({
        sessionId: 'test',
        type: 'json',
        data: expect.objectContaining({
          type: 'session',
          data: expect.objectContaining({
            status: 'error'
          })
        })
      }));
    });

    test('should handle undefined config manager gracefully', async () => {
      const managerWithoutConfig = new ClaudeCodeManager(mockSessionManager, mockLogger);
      
      mockStrategy.getClaudeExecutionStrategy.mockReturnValue({
        command: 'claude',
        args: [],
        cwd: '/test',
        env: {},
        requiresPathTranslation: false
      });
      
      // Should not throw
      await expect(managerWithoutConfig.spawnClaudeCode('test', '/test', 'test'))
        .resolves.toBeUndefined();
    });
    
  });
  
});