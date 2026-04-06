import { useState, useCallback, useMemo, useEffect } from 'react';
import type { TrackInfo as TrackInfoType } from './types';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useBookmarks } from './hooks/useBookmarks';
import { URLInput } from './components/URLInput';
import { TrackInfo } from './components/TrackInfo';
import { WaveformDisplay } from './components/WaveformDisplay';
import { TransportControls } from './components/TransportControls';
import { SpeedControl } from './components/SpeedControl';
import { PitchControl } from './components/PitchControl';
import { LoopControls } from './components/LoopControls';
import { EQControls } from './components/EQControls';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';

function App() {
  const engine = useAudioEngine();
  const [track, setTrack] = useState<TrackInfoType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  const { bookmarks, saveBookmark, deleteBookmark } = useBookmarks(track?.id ?? null);

  const [isLoading, setIsLoading] = useState(false);

  const handleLoad = useCallback(
    async (videoId: string) => {
      setLoadError(null);
      setIsLoading(true);
      try {
        // Fetch metadata and audio in parallel
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const [trackInfo] = await Promise.all([
          fetch('/api/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          })
            .then(async (res) => {
              if (!res.ok) return null;
              const data = await res.json();
              return {
                id: data.video_id,
                title: data.title,
                duration: data.duration ?? 0,
                thumbnail: data.thumbnail,
              } as TrackInfoType;
            })
            .catch(() => null),
          engine.load(videoId),
        ]);

        setTrack(
          trackInfo ?? {
            id: videoId,
            title: `Track ${videoId}`,
            duration: engine.duration,
            thumbnail: '',
          }
        );

        setAudioBuffer(engine.getBuffer());
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load track';
        setLoadError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [engine]
  );

  // Keyboard shortcut actions
  const shortcutActions = useMemo(
    () => ({
      togglePlayPause: () => engine.togglePlayPause(),
      setLoopStart: () => {
        if (engine.loop) {
          engine.setLoop(engine.currentTime, engine.loop.end);
        } else {
          // Store as pending; will become a loop when B is set
          engine.setLoop(engine.currentTime, engine.duration);
        }
      },
      setLoopEnd: () => {
        const start = engine.loop?.start ?? 0;
        if (engine.currentTime > start) {
          engine.setLoop(start, engine.currentTime);
        }
      },
      clearLoop: () => engine.clearLoop(),
      adjustSpeed: (delta: number) =>
        engine.setSpeed(Math.round((engine.speed + delta) * 100) / 100),
      seekRelative: (delta: number) => engine.seek(engine.currentTime + delta),
      adjustPitch: (delta: number) => engine.setPitch(engine.pitch + delta),
      toggleSpeedRamp: () =>
        engine.setSpeedRamp({ enabled: !engine.speedRamp.enabled }),
    }),
    [engine]
  );

  useKeyboardShortcuts(shortcutActions);

  // Prevent trackpad/mouse scroll from changing range input values
  useEffect(() => {
    const prevent = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('input[type="range"]')) {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      }
    };
    document.addEventListener('wheel', prevent, { passive: false });
    return () => document.removeEventListener('wheel', prevent);
  }, []);

  const handleLoadBookmark = useCallback(
    (bookmark: { start: number; end: number }) => {
      engine.setLoop(bookmark.start, bookmark.end);
    },
    [engine]
  );

  const handleLoopChange = useCallback(
    (start: number, end: number) => {
      engine.setLoop(start, end);
    },
    [engine]
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Header */}
        <header className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Woodshed
          </h1>
          <span className="text-gray-500 text-sm">
            YouTube practice tool for musicians
          </span>
        </header>

        {/* URL Input */}
        <URLInput onLoad={handleLoad} isLoading={isLoading} />

        {loadError && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm">
            {loadError}
          </div>
        )}

        {/* Track Info */}
        <TrackInfo track={track} />

        {/* Waveform */}
        <WaveformDisplay
          audioBuffer={audioBuffer}
          currentTime={engine.currentTime}
          duration={engine.duration}
          loop={engine.loop}
          onSeek={engine.seek}
          onLoopChange={handleLoopChange}
        />

        {/* Transport */}
        <TransportControls
          isPlaying={engine.isPlaying}
          currentTime={engine.currentTime}
          duration={engine.duration}
          onTogglePlay={engine.togglePlayPause}
          onSeek={engine.seek}
        />

        {/* Control Panels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SpeedControl
            speed={engine.speed}
            speedRamp={engine.speedRamp}
            onSpeedChange={engine.setSpeed}
            onSpeedRampChange={engine.setSpeedRamp}
          />

          <PitchControl
            pitch={engine.pitch}
            onPitchChange={engine.setPitch}
          />

          <LoopControls
            currentTime={engine.currentTime}
            loop={engine.loop}
            bookmarks={bookmarks}
            onSetLoop={engine.setLoop}
            onClearLoop={engine.clearLoop}
            onSaveBookmark={saveBookmark}
            onLoadBookmark={handleLoadBookmark}
            onDeleteBookmark={deleteBookmark}
          />

          <EQControls
            lowpass={engine.eq.lowpass}
            highpass={engine.eq.highpass}
            onEQChange={engine.setEQ}
          />
        </div>

        {/* Keyboard Shortcuts */}
        <KeyboardShortcutsHelp />
      </div>
    </div>
  );
}

export default App;
