/**
 * Cross-platform clipboard utilities for Crystal
 * Handles differences between macOS (Cmd+C) and Windows/Linux (Ctrl+C)
 */

/**
 * Detects the current platform and returns the appropriate modifier key
 */
export const getClipboardModifier = (): 'metaKey' | 'ctrlKey' => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return isMac ? 'metaKey' : 'ctrlKey';
};

/**
 * Checks if the current key event is a copy operation (Cmd/Ctrl+C)
 */
export const isCopyKeyEvent = (e: KeyboardEvent): boolean => {
  const modifier = getClipboardModifier();
  return e.key === 'c' && e[modifier] && !e.shiftKey;
};

/**
 * Checks if the current key event is a paste operation (Cmd/Ctrl+V)
 */
export const isPasteKeyEvent = (e: KeyboardEvent): boolean => {
  const modifier = getClipboardModifier();
  return e.key === 'v' && e[modifier] && !e.shiftKey;
};

/**
 * Safely copies text to clipboard with error handling
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    console.log(`[Clipboard] Copied ${text.length} characters to clipboard`);
    return true;
  } catch (error) {
    console.error('[Clipboard] Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * Safely reads text from clipboard with error handling
 */
export const readFromClipboard = async (): Promise<string | null> => {
  try {
    const text = await navigator.clipboard.readText();
    console.log(`[Clipboard] Read ${text.length} characters from clipboard`);
    return text;
  } catch (error) {
    console.error('[Clipboard] Failed to read from clipboard:', error);
    return null;
  }
};

/**
 * Creates a cross-platform keyboard event handler for copy operations
 */
export const createCopyHandler = (onCopy: (selection: string) => void) => {
  return async (e: KeyboardEvent, getSelection: () => string) => {
    if (isCopyKeyEvent(e)) {
      const selection = getSelection();
      if (selection) {
        e.preventDefault();
        e.stopPropagation();
        const success = await copyToClipboard(selection);
        if (success) {
          onCopy(selection);
        }
      }
    }
  };
};

/**
 * Creates a cross-platform keyboard event handler for paste operations
 */
export const createPasteHandler = (onPaste: (text: string) => void) => {
  return async (e: KeyboardEvent) => {
    if (isPasteKeyEvent(e)) {
      e.preventDefault();
      e.stopPropagation();
      const text = await readFromClipboard();
      if (text) {
        onPaste(text);
      }
    }
  };
};