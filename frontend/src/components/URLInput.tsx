import { useState } from 'react';

interface URLInputProps {
  onLoad: (videoId: string) => void;
  isLoading: boolean;
}

function extractVideoId(input: string): string | null {
  // Handle plain video IDs (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) {
    return input.trim();
  }

  try {
    const url = new URL(input);

    // youtube.com/watch?v=VIDEO_ID
    if (
      (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') &&
      url.pathname === '/watch'
    ) {
      return url.searchParams.get('v');
    }

    // youtu.be/VIDEO_ID
    if (url.hostname === 'youtu.be') {
      return url.pathname.slice(1) || null;
    }

    // youtube.com/embed/VIDEO_ID
    if (
      (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') &&
      url.pathname.startsWith('/embed/')
    ) {
      return url.pathname.split('/')[2] || null;
    }

    // music.youtube.com
    if (url.hostname === 'music.youtube.com' && url.pathname === '/watch') {
      return url.searchParams.get('v');
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

export function URLInput({ onLoad, isLoading }: URLInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

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
    <form onSubmit={handleSubmit} className="flex gap-3 items-start">
      <div className="flex-1">
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
          }}
          placeholder="Paste YouTube URL or video ID..."
          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg
                     text-white placeholder-gray-400 focus:outline-none focus:border-blue-500
                     focus:ring-1 focus:ring-blue-500 transition-colors"
          disabled={isLoading}
        />
        {error && (
          <p className="text-red-400 text-sm mt-1.5 ml-1">{error}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={isLoading || !url.trim()}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
                   disabled:text-gray-500 text-white font-medium rounded-lg transition-colors
                   flex items-center gap-2 shrink-0"
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading...
          </>
        ) : (
          'Load'
        )}
      </button>
    </form>
  );
}
