import { useState } from 'react';

interface URLInputProps {
  onLoad: (videoId: string) => void;
  isLoading: boolean;
  clearOnLoad?: boolean;
  loadedVideoId?: string | null;
}

function extractVideoId(input: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) {
    return input.trim();
  }

  try {
    const url = new URL(input);

    if (
      (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') &&
      url.pathname === '/watch'
    ) {
      return url.searchParams.get('v');
    }

    if (url.hostname === 'youtu.be') {
      return url.pathname.slice(1) || null;
    }

    if (
      (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') &&
      url.pathname.startsWith('/embed/')
    ) {
      return url.pathname.split('/')[2] || null;
    }

    if (url.hostname === 'music.youtube.com' && url.pathname === '/watch') {
      return url.searchParams.get('v');
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

export function URLInput({ onLoad, isLoading, loadedVideoId }: URLInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [lastLoadedId, setLastLoadedId] = useState<string | null>(null);

  // Clear input when a new track finishes loading
  if (loadedVideoId && loadedVideoId !== lastLoadedId) {
    setLastLoadedId(loadedVideoId);
    setUrl('');
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      setError('Please enter a valid YouTube URL or video ID');
      return;
    }

    onLoad(videoId);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        {/* Search/link icon */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>

        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
          }}
          placeholder="Paste a YouTube link..."
          className="w-full pl-12 pr-28 py-3.5 bg-gray-800/60 border border-gray-700/50
                     rounded-2xl text-white placeholder-gray-500
                     focus:outline-none focus:border-blue-500/50 focus:bg-gray-800/80
                     transition-all text-[15px]"
          disabled={isLoading}
        />

        {/* Load button — sits inside the input */}
        {/* Loading spinner — replaces button during load */}
        {isLoading ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        ) : (
          <button
            type="submit"
            className={`absolute right-2 top-1/2 -translate-y-1/2
                       px-5 py-2 rounded-xl text-sm font-medium transition-all
                       text-white ${
                         !url.trim()
                           ? 'opacity-0 pointer-events-none'
                           : 'bg-blue-500 hover:bg-blue-400'
                       }`}
          >
            Load
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-400/80 text-sm mt-2 ml-4">{error}</p>
      )}
    </form>
  );
}
