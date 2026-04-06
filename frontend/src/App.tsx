import { useState, useCallback, useMemo, useEffect } from 'react';
import type { TrackInfo as TrackInfoType } from './types';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useBookmarks } from './hooks/useBookmarks';
import { URLInput } from './components/URLInput';
import { TrackInfo } from './components/TrackInfo';
import { TransportControls } from './components/TransportControls';
import { extractPeaks } from './lib/peaks';
import { SpeedControl } from './components/SpeedControl';
import { PitchControl } from './components/PitchControl';
import { LoopControls } from './components/LoopControls';
import { EQControls } from './components/EQControls';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';

function App() {
  const engine = useAudioEngine();
  const [track, setTrack] = useState<TrackInfoType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [seekStep, setSeekStep] = useState(2);

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

        const buf = engine.getBuffer();
        if (buf) setPeaks(extractPeaks(buf, 80));
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
      seekRelative: (delta: number) => engine.seek(engine.currentTime + delta * seekStep),
      adjustPitch: (delta: number) => engine.setPitch(engine.pitch + delta),
      toggleSpeedRamp: () =>
        engine.setSpeedRamp({ enabled: !engine.speedRamp.enabled }),
    }),
    [engine, seekStep]
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

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Header + URL Input */}
        <header className="flex flex-col gap-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-semibold text-white tracking-tight">
              Woodshed
            </h1>
            <span className="text-gray-600 text-xs tracking-wide">
              practice tool
            </span>
          </div>
          <URLInput onLoad={handleLoad} isLoading={isLoading} loadedVideoId={track?.id ?? null} />
        </header>

        {loadError && (
          <div className="bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {loadError}
          </div>
        )}

        {/* Track hero + transport */}
        <TrackInfo track={track} />

        <TransportControls
          isPlaying={engine.isPlaying}
          currentTime={engine.currentTime}
          duration={engine.duration}
          loop={engine.loop}
          peaks={peaks}
          seekStep={seekStep}
          onTogglePlay={engine.togglePlayPause}
          onSeek={engine.seek}
          onSeekStepChange={setSeekStep}
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
