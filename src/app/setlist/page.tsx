'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Setlist, SetlistSong, SongDetail } from '@/types';
import { loadSetlists } from '@/lib/setlist';
import TabDisplay from '@/components/TabDisplay';
import Link from 'next/link';
import { FaChevronLeft, FaChevronRight, FaList, FaHouse } from 'react-icons/fa6';

function SetlistViewerContent() {
  const searchParams = useSearchParams();
  const setlistId = searchParams.get('id');
  const songIndexParam = searchParams.get('song');

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [showSongList, setShowSongList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!setlistId) {
      setError('No setlist ID provided');
      setLoading(false);
      return;
    }

    const setlists = loadSetlists();
    const foundSetlist = setlists[setlistId];

    if (!foundSetlist) {
      setError('Setlist not found');
      setLoading(false);
      return;
    }

    if (foundSetlist.songs.length === 0) {
      setError('This setlist is empty');
      setLoading(false);
      return;
    }

    setSetlist(foundSetlist);

    // Set initial song index from URL param or default to 0
    if (songIndexParam) {
      const index = parseInt(songIndexParam);
      if (!isNaN(index) && index >= 0 && index < foundSetlist.songs.length) {
        setCurrentSongIndex(index);
      }
    }

    setLoading(false);
  }, [setlistId, songIndexParam]);

  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts if not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'h') {
        e.preventDefault();
        goToPreviousSong();
      } else if (e.key === 'ArrowRight' || e.key === 'l') {
        e.preventDefault();
        goToNextSong();
      } else if (e.key === 's') {
        e.preventDefault();
        setShowSongList(!showSongList);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentSongIndex, setlist, showSongList]);

  const goToPreviousSong = () => {
    if (currentSongIndex > 0) {
      setCurrentSongIndex(currentSongIndex - 1);
      updateUrl(currentSongIndex - 1);
    }
  };

  const goToNextSong = () => {
    if (setlist && currentSongIndex < setlist.songs.length - 1) {
      setCurrentSongIndex(currentSongIndex + 1);
      updateUrl(currentSongIndex + 1);
    }
  };

  const goToSong = (index: number) => {
    setCurrentSongIndex(index);
    setShowSongList(false);
    updateUrl(index);
  };

  const updateUrl = (index: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set('song', index.toString());
    window.history.pushState({}, '', url.toString());
  };

  if (loading) {
    return (
      <div className="w-full flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error || !setlist) {
    return (
      <div className="w-full">
        <div className="alert alert-error">
          <span>{error || 'Failed to load setlist'}</span>
        </div>
        <Link href="/" className="btn btn-primary mt-4">
          <FaHouse /> Go Home
        </Link>
      </div>
    );
  }

  const currentSong = setlist.songs[currentSongIndex];

  if (!currentSong.tabData) {
    return (
      <div className="w-full">
        <div className="alert alert-warning">
          <span>This song doesn't have cached data. Please add it again from the tab page.</span>
        </div>
        <Link href="/" className="btn btn-primary mt-4">
          <FaHouse /> Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Setlist Navigation Header */}
      <div className="card bg-base-200 shadow-xl mb-6 no-print">
        <div className="card-body p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Link href="/" className="btn btn-ghost btn-sm">
                <FaHouse />
              </Link>
              <h1 className="text-xl font-bold">{setlist.name}</h1>
              <span className="badge badge-primary">
                {currentSongIndex + 1} / {setlist.songs.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="btn btn-sm btn-outline"
                onClick={() => setShowSongList(!showSongList)}
              >
                <FaList />
                {showSongList ? 'Hide' : 'Show'} Songs
              </button>

              <div className="join">
                <button
                  className="join-item btn btn-sm"
                  onClick={goToPreviousSong}
                  disabled={currentSongIndex === 0}
                >
                  <FaChevronLeft /> Previous
                </button>
                <button
                  className="join-item btn btn-sm"
                  onClick={goToNextSong}
                  disabled={currentSongIndex === setlist.songs.length - 1}
                >
                  Next <FaChevronRight />
                </button>
              </div>
            </div>
          </div>

          {/* Current Song Info */}
          <div className="mt-2">
            <h2 className="text-lg font-semibold">{currentSong.song_name}</h2>
            <p className="text-sm opacity-70">{currentSong.artist_name}</p>
            <p className="text-xs opacity-50 mt-1">
              Shortcuts: ← / H (Previous) • → / L (Next) • S (Song List)
            </p>
          </div>

          {/* Song List Dropdown */}
          {showSongList && (
            <div className="mt-4 max-h-64 overflow-y-auto">
              <div className="menu bg-base-100 rounded-box">
                {setlist.songs.map((song, index) => (
                  <li key={index}>
                    <a
                      className={index === currentSongIndex ? 'active' : ''}
                      onClick={() => goToSong(index)}
                    >
                      <span className="badge badge-sm">{index + 1}</span>
                      <div className="flex-1">
                        <div className="font-semibold">{song.song_name}</div>
                        <div className="text-xs opacity-70">{song.artist_name}</div>
                      </div>
                    </a>
                  </li>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Display */}
      <TabDisplay tab={currentSong.tabData} />
    </div>
  );
}

export default function SetlistViewerPage() {
  return (
    <Suspense fallback={
      <div className="w-full flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    }>
      <SetlistViewerContent />
    </Suspense>
  );
}
