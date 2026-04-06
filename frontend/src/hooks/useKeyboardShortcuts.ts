import { useEffect, useCallback } from 'react';

interface KeyboardShortcutActions {
  togglePlayPause: () => void;
  setLoopStart: () => void;
  setLoopEnd: () => void;
  clearLoop: () => void;
  adjustSpeed: (delta: number) => void;
  seekRelative: (delta: number) => void;
  adjustPitch: (delta: number) => void;
  toggleSpeedRamp: () => void;
}

export function useKeyboardShortcuts(actions: KeyboardShortcutActions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't capture shortcuts when typing in text inputs
      const target = event.target as HTMLElement;
      const isTextInput =
        (target.tagName === 'INPUT' &&
          (target as HTMLInputElement).type !== 'range') ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isTextInput) {
        return;
      }

      switch (event.key) {
        case ' ':
          event.preventDefault();
          actions.togglePlayPause();
          break;
        case '[':
          event.preventDefault();
          actions.setLoopStart();
          break;
        case ']':
          event.preventDefault();
          actions.setLoopEnd();
          break;
        case 'Backspace':
        case 'Delete':
          event.preventDefault();
          actions.clearLoop();
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (event.shiftKey) {
            actions.adjustPitch(1);
          } else {
            actions.adjustSpeed(0.05);
          }
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (event.shiftKey) {
            actions.adjustPitch(-1);
          } else {
            actions.adjustSpeed(-0.05);
          }
          break;
        case 'ArrowLeft':
          event.preventDefault();
          actions.seekRelative(-1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          actions.seekRelative(1);
          break;
        case 'r':
        case 'R':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            actions.toggleSpeedRamp();
          }
          break;
      }
    },
    [actions]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
