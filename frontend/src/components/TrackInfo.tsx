import type { TrackInfo as TrackInfoType } from '../types';

interface TrackInfoProps {
  track: TrackInfoType | null;
}

export function TrackInfo({ track }: TrackInfoProps) {
  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-600">
        <svg className="w-16 h-16 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <p className="text-sm">Paste a YouTube link to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {track.thumbnail && (
        <img
          src={track.thumbnail}
          alt={track.title}
          className="w-64 h-64 rounded-xl object-cover shadow-2xl shadow-black/50"
        />
      )}
      <a
        href={`https://www.youtube.com/watch?v=${track.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-white font-semibold text-xl text-center max-w-lg leading-snug
                   hover:text-blue-400 transition-colors"
      >
        {track.title}
      </a>
    </div>
  );
}
