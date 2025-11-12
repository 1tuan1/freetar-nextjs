import JSZip from 'jszip';
import { Setlist, SetlistCollection, SearchResult, SongDetail, SetlistSong } from '@/types';

const SETLIST_STORAGE_KEY = 'freetar_setlists';

/**
 * Load all setlists from localStorage
 */
export function loadSetlists(): SetlistCollection {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(SETLIST_STORAGE_KEY);
    if (!stored) return {};

    const setlists = JSON.parse(stored);

    // Ensure all setlists have an order field (backward compatibility)
    let needsSave = false;
    for (const id in setlists) {
      if (setlists[id].order === undefined) {
        setlists[id].order = new Date(setlists[id].created).getTime();
        needsSave = true;
      }
    }

    // Save back if we added order fields
    if (needsSave) {
      localStorage.setItem(SETLIST_STORAGE_KEY, JSON.stringify(setlists));
    }

    return setlists;
  } catch (error) {
    console.error('Failed to load setlists:', error);
    return {};
  }
}

/**
 * Save setlists to localStorage
 */
export function saveSetlists(setlists: SetlistCollection): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SETLIST_STORAGE_KEY, JSON.stringify(setlists));
  } catch (error) {
    console.error('Failed to save setlists:', error);
  }
}

/**
 * Create a new setlist
 */
export function createSetlist(name: string, order?: number): Setlist {
  const id = `setlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    name,
    created: new Date().toISOString(),
    order: order ?? Date.now(),
    songs: [],
  };
}

/**
 * Add a new setlist to the collection
 */
export function addSetlist(name: string): Setlist {
  const setlists = loadSetlists();
  const newSetlist = createSetlist(name);
  setlists[newSetlist.id] = newSetlist;
  saveSetlists(setlists);
  return newSetlist;
}

/**
 * Delete a setlist
 */
export function deleteSetlist(setlistId: string): void {
  const setlists = loadSetlists();
  delete setlists[setlistId];
  saveSetlists(setlists);
}

/**
 * Add a song to a setlist (with optional full tab data)
 */
export function addSongToSetlist(
  setlistId: string,
  song: SearchResult | SetlistSong,
  tabData?: SongDetail
): void {
  const setlists = loadSetlists();
  const setlist = setlists[setlistId];

  if (!setlist) {
    throw new Error(`Setlist ${setlistId} not found`);
  }

  // Check if song already exists in setlist
  const exists = setlist.songs.some(s => s.tab_url === song.tab_url);
  if (!exists) {
    const setlistSong: SetlistSong = {
      tab_url: song.tab_url,
      artist_name: song.artist_name,
      song_name: song.song_name || (song as any).song,
      type: song.type,
      rating: song.rating,
      tabData: tabData || (song as SetlistSong).tabData,
    };
    setlist.songs.push(setlistSong);
    saveSetlists(setlists);
  }
}

/**
 * Remove a song from a setlist
 */
export function removeSongFromSetlist(setlistId: string, tabUrl: string): void {
  const setlists = loadSetlists();
  const setlist = setlists[setlistId];

  if (!setlist) {
    throw new Error(`Setlist ${setlistId} not found`);
  }

  setlist.songs = setlist.songs.filter(s => s.tab_url !== tabUrl);
  saveSetlists(setlists);
}

/**
 * Rename a setlist
 */
export function renameSetlist(setlistId: string, newName: string): void {
  const setlists = loadSetlists();
  const setlist = setlists[setlistId];

  if (!setlist) {
    throw new Error(`Setlist ${setlistId} not found`);
  }

  setlist.name = newName;
  saveSetlists(setlists);
}

/**
 * Export a setlist as a .setlist file (ZIP format)
 */
export async function exportSetlist(setlistId: string): Promise<void> {
  const setlists = loadSetlists();
  const setlist = setlists[setlistId];

  if (!setlist) {
    throw new Error(`Setlist ${setlistId} not found`);
  }

  // Create a new ZIP file
  const zip = new JSZip();

  // Add setlist metadata
  const metadata = {
    id: setlist.id,
    name: setlist.name,
    created: setlist.created,
    exported: new Date().toISOString(),
    version: '1.0',
    songCount: setlist.songs.length,
  };
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  // Create songs folder in ZIP
  const songsFolder = zip.folder('songs');
  if (!songsFolder) {
    throw new Error('Failed to create songs folder in ZIP');
  }

  // Add each song as a separate JSON file (including cached tabData)
  setlist.songs.forEach((song, index) => {
    const songFilename = `song-${index + 1}.json`;
    songsFolder.file(songFilename, JSON.stringify(song, null, 2));
  });

  // Generate the ZIP file
  const blob = await zip.generateAsync({ type: 'blob' });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(setlist.name)}.setlist`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import a setlist from a .setlist file
 */
export async function importSetlist(file: File): Promise<Setlist> {
  if (!file.name.endsWith('.setlist')) {
    throw new Error('Invalid file format. Please select a .setlist file.');
  }

  try {
    // Read the ZIP file
    const zip = await JSZip.loadAsync(file);

    // Extract metadata
    const metadataFile = zip.file('metadata.json');
    if (!metadataFile) {
      throw new Error('Invalid setlist file: metadata.json not found');
    }
    const metadataContent = await metadataFile.async('string');
    const metadata = JSON.parse(metadataContent);

    // Extract songs from individual files in songs folder
    const songs: SetlistSong[] = [];
    const songsFolder = zip.folder('songs');

    if (songsFolder) {
      // Get all files in the songs folder
      const songFiles: JSZip.JSZipObject[] = [];
      songsFolder.forEach((relativePath, file) => {
        if (!file.dir && relativePath.endsWith('.json')) {
          songFiles.push(file);
        }
      });

      // Sort by filename to maintain order (song-1.json, song-2.json, etc.)
      songFiles.sort((a, b) => a.name.localeCompare(b.name));

      // Read each song file
      for (const songFile of songFiles) {
        const songContent = await songFile.async('string');
        const song = JSON.parse(songContent);
        songs.push(song);
      }
    } else {
      // Fallback: try to read from old format (songs.json)
      const songsFile = zip.file('songs.json');
      if (songsFile) {
        const songsContent = await songsFile.async('string');
        songs.push(...JSON.parse(songsContent));
      } else {
        throw new Error('Invalid setlist file: no songs found');
      }
    }

    // Create a new setlist with imported data
    const setlists = loadSetlists();
    const newSetlist: Setlist = {
      id: `setlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: metadata.name,
      created: new Date().toISOString(),
      order: Date.now(),
      songs: songs,
    };

    setlists[newSetlist.id] = newSetlist;
    saveSetlists(setlists);

    return newSetlist;
  } catch (error) {
    console.error('Failed to import setlist:', error);
    throw new Error('Failed to import setlist. Please ensure the file is a valid .setlist file.');
  }
}

/**
 * Sanitize filename for safe download
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
}

/**
 * Get all setlists as an array
 */
export function getSetlistsArray(): Setlist[] {
  const setlists = loadSetlists();
  return Object.values(setlists).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Reorder a song within a setlist
 */
export function reorderSong(setlistId: string, fromIndex: number, toIndex: number): void {
  const setlists = loadSetlists();
  const setlist = setlists[setlistId];

  if (!setlist) {
    throw new Error(`Setlist ${setlistId} not found`);
  }

  if (fromIndex < 0 || fromIndex >= setlist.songs.length || toIndex < 0 || toIndex >= setlist.songs.length) {
    return; // Invalid indices
  }

  // Remove the song from the old position and insert it at the new position
  const [song] = setlist.songs.splice(fromIndex, 1);
  setlist.songs.splice(toIndex, 0, song);

  saveSetlists(setlists);
}

/**
 * Move a song up in the setlist
 */
export function moveSongUp(setlistId: string, songIndex: number): void {
  if (songIndex > 0) {
    reorderSong(setlistId, songIndex, songIndex - 1);
  }
}

/**
 * Move a song down in the setlist
 */
export function moveSongDown(setlistId: string, songIndex: number): void {
  const setlists = loadSetlists();
  const setlist = setlists[setlistId];
  if (setlist && songIndex < setlist.songs.length - 1) {
    reorderSong(setlistId, songIndex, songIndex + 1);
  }
}

/**
 * Move a setlist up in the order
 */
export function moveSetlistUp(setlistId: string): void {
  const setlistsArray = getSetlistsArray();
  const currentIndex = setlistsArray.findIndex(s => s.id === setlistId);

  if (currentIndex > 0) {
    // Swap order values with the previous setlist
    const temp = setlistsArray[currentIndex].order;
    setlistsArray[currentIndex].order = setlistsArray[currentIndex - 1].order;
    setlistsArray[currentIndex - 1].order = temp;

    // Save back to storage
    const setlists = loadSetlists();
    setlists[setlistsArray[currentIndex].id] = setlistsArray[currentIndex];
    setlists[setlistsArray[currentIndex - 1].id] = setlistsArray[currentIndex - 1];
    saveSetlists(setlists);
  }
}

/**
 * Move a setlist down in the order
 */
export function moveSetlistDown(setlistId: string): void {
  const setlistsArray = getSetlistsArray();
  const currentIndex = setlistsArray.findIndex(s => s.id === setlistId);

  if (currentIndex >= 0 && currentIndex < setlistsArray.length - 1) {
    // Swap order values with the next setlist
    const temp = setlistsArray[currentIndex].order;
    setlistsArray[currentIndex].order = setlistsArray[currentIndex + 1].order;
    setlistsArray[currentIndex + 1].order = temp;

    // Save back to storage
    const setlists = loadSetlists();
    setlists[setlistsArray[currentIndex].id] = setlistsArray[currentIndex];
    setlists[setlistsArray[currentIndex + 1].id] = setlistsArray[currentIndex + 1];
    saveSetlists(setlists);
  }
}
