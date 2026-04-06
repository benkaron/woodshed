import type { TrackInfo as TrackInfoType } from '../types';

interface TrackInfoProps {
  track: TrackInfoType | null;
}

export function TrackInfo({ track }: TrackInfoProps) {
  if (!track) return null;

  return (
    <div className="flex items-center gap-4 bg-gray-800/50 rounded-lg p-3">
      {track.thumbnail && (
        <img
          src={track.thumbnail}
          alt={track.title}
          className="w-20 h-15 rounded object-cover shrink-0"
        />
      )}
      <div className="min-w-0">
        <h2 className="text-white font-medium text-lg truncate">
          {track.title}
        </h2>
        <p className="text-gray-400 text-sm">
          {formatDuration(track.duration)}
        </p>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
