'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { FaPencil, FaFloppyDisk, FaTrash, FaArrowUp, FaArrowDown, FaPlay } from 'react-icons/fa6';
import { Setlist } from '@/types';
import {
  getSetlistsArray,
  addSetlist,
  deleteSetlist,
  renameSetlist,
  removeSongFromSetlist,
  exportSetlist,
  importSetlist,
  moveSongUp,
  moveSongDown,
  moveSetlistUp,
  moveSetlistDown,
} from '@/lib/setlist';

export default function SetlistManager() {
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [newSetlistName, setNewSetlistName] = useState('');
  const [editingSetlistId, setEditingSetlistId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [expandedSetlistId, setExpandedSetlistId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSetlists();
  }, []);

  const loadSetlists = () => {
    setSetlists(getSetlistsArray());
  };

  const handleCreateSetlist = () => {
    if (!newSetlistName.trim()) return;

    addSetlist(newSetlistName.trim());
    setNewSetlistName('');
    loadSetlists();
  };

  const handleDeleteSetlist = (setlistId: string) => {
    if (confirm('Are you sure you want to delete this setlist?')) {
      deleteSetlist(setlistId);
      loadSetlists();
    }
  };

  const handleStartRename = (setlist: Setlist) => {
    setEditingSetlistId(setlist.id);
    setEditingName(setlist.name);
  };

  const handleSaveRename = () => {
    if (!editingSetlistId || !editingName.trim()) return;

    renameSetlist(editingSetlistId, editingName.trim());
    setEditingSetlistId(null);
    setEditingName('');
    loadSetlists();
  };

  const handleCancelRename = () => {
    setEditingSetlistId(null);
    setEditingName('');
  };

  const handleRemoveSong = (setlistId: string, tabUrl: string) => {
    removeSongFromSetlist(setlistId, tabUrl);
    loadSetlists();
  };

  const handleMoveSongUp = (setlistId: string, songIndex: number) => {
    moveSongUp(setlistId, songIndex);
    loadSetlists();
  };

  const handleMoveSongDown = (setlistId: string, songIndex: number) => {
    moveSongDown(setlistId, songIndex);
    loadSetlists();
  };

  const handleMoveSetlistUp = (setlistId: string) => {
    moveSetlistUp(setlistId);
    loadSetlists();
  };

  const handleMoveSetlistDown = (setlistId: string) => {
    moveSetlistDown(setlistId);
    loadSetlists();
  };

  const handleExportSetlist = async (setlistId: string) => {
    try {
      await exportSetlist(setlistId);
    } catch (error) {
      alert('Failed to export setlist: ' + (error as Error).message);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportSetlist = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await importSetlist(file);
      loadSetlists();
      alert('Setlist imported successfully!');
    } catch (error) {
      alert('Failed to import setlist: ' + (error as Error).message);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleExpand = (setlistId: string) => {
    setExpandedSetlistId(expandedSetlistId === setlistId ? null : setlistId);
  };

  if (setlists.length === 0 && !newSetlistName) {
    return (
      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title">Setlists</h2>
          <p className="text-sm opacity-70">
            Create setlists to organize your favorite songs for performances or practice sessions.
          </p>
          <div className="flex gap-2 mt-4">
            <input
              type="text"
              placeholder="Enter setlist name..."
              className="input input-bordered flex-1"
              value={newSetlistName}
              onChange={(e) => setNewSetlistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSetlist()}
            />
            <button className="btn btn-primary" onClick={handleCreateSetlist}>
              Create Setlist
            </button>
            <button className="btn btn-outline" onClick={handleImportClick}>
              Import
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".setlist"
            className="hidden"
            onChange={handleImportSetlist}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-200">
      <div className="card-body">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title">Setlists ({setlists.length})</h2>
          <button className="btn btn-sm btn-outline" onClick={handleImportClick}>
            Import Setlist
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".setlist"
            className="hidden"
            onChange={handleImportSetlist}
          />
        </div>

        {/* Create new setlist */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="New setlist name..."
            className="input input-bordered input-sm flex-1"
            value={newSetlistName}
            onChange={(e) => setNewSetlistName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSetlist()}
          />
          <button className="btn btn-sm btn-primary" onClick={handleCreateSetlist}>
            Create
          </button>
        </div>

        {/* Setlists list */}
        <div className="space-y-4">
          {setlists.map((setlist, index) => (
            <div key={setlist.id} className="card bg-base-100 shadow-md">
              <div className="card-body p-4">
                {/* Setlist header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    {editingSetlistId === setlist.id ? (
                      <>
                        <input
                          type="text"
                          className="input input-bordered input-sm flex-1"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename();
                            if (e.key === 'Escape') handleCancelRename();
                          }}
                          autoFocus
                        />
                        <button className="btn btn-sm btn-success" onClick={handleSaveRename}>
                          Save
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={handleCancelRename}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => toggleExpand(setlist.id)}
                          >
                            <span className="text-sm">
                              {expandedSetlistId === setlist.id ? '▼' : '▶'}
                            </span>
                          </button>
                          {setlist.songs.length > 0 ? (
                            <Link
                              href={`/setlist?id=${setlist.id}`}
                              className="font-semibold text-lg hover:text-primary"
                            >
                              {setlist.name}
                            </Link>
                          ) : (
                            <span className="font-semibold text-lg opacity-50">
                              {setlist.name}
                            </span>
                          )}
                        </div>
                        <span className="badge badge-sm">{setlist.songs.length} songs</span>
                      </>
                    )}
                  </div>

                  {editingSetlistId !== setlist.id && (
                    <div className="flex gap-2">
                      {setlist.songs.length > 0 && (
                        <Link
                          href={`/setlist?id=${setlist.id}`}
                          className="btn btn-sm btn-primary"
                          title="View Setlist"
                        >
                          <FaPlay />
                        </Link>
                      )}
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleMoveSetlistUp(setlist.id)}
                        disabled={index === 0}
                        title="Move up"
                      >
                        <FaArrowUp />
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleMoveSetlistDown(setlist.id)}
                        disabled={index === setlists.length - 1}
                        title="Move down"
                      >
                        <FaArrowDown />
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleStartRename(setlist)}
                        title="Rename"
                      >
                        <FaPencil />
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleExportSetlist(setlist.id)}
                        title="Export"
                      >
                        <FaFloppyDisk />
                      </button>
                      <button
                        className="btn btn-sm btn-ghost text-error"
                        onClick={() => handleDeleteSetlist(setlist.id)}
                        title="Delete"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  )}
                </div>

                {/* Setlist songs (expanded) */}
                {expandedSetlistId === setlist.id && (
                  <div className="mt-4">
                    {setlist.songs.length === 0 ? (
                      <p className="text-sm opacity-70">
                        No songs yet. Add songs from search results or tab pages.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Song</th>
                              <th>Artist</th>
                              <th>Type</th>
                              <th>Rating</th>
                              <th>Order</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {setlist.songs.map((song, index) => (
                              <tr key={song.tab_url}>
                                <td>{index + 1}</td>
                                <td>
                                  {song.tabData ? (
                                    <Link
                                      href={`/setlist?id=${setlist.id}&song=${index}`}
                                      className="link link-hover"
                                    >
                                      {song.song_name}
                                    </Link>
                                  ) : (
                                    <span className="opacity-50" title="No cached data">
                                      {song.song_name}
                                    </span>
                                  )}
                                </td>
                                <td>{song.artist_name}</td>
                                <td>
                                  <span className="badge badge-sm">{song.type}</span>
                                </td>
                                <td>
                                  <span className="text-sm">⭐ {song.rating.toFixed(2)}</span>
                                </td>
                                <td>
                                  <div className="flex gap-1">
                                    <button
                                      className="btn btn-xs btn-ghost"
                                      onClick={() => handleMoveSongUp(setlist.id, index)}
                                      disabled={index === 0}
                                      title="Move up"
                                    >
                                      <FaArrowUp />
                                    </button>
                                    <button
                                      className="btn btn-xs btn-ghost"
                                      onClick={() => handleMoveSongDown(setlist.id, index)}
                                      disabled={index === setlist.songs.length - 1}
                                      title="Move down"
                                    >
                                      <FaArrowDown />
                                    </button>
                                  </div>
                                </td>
                                <td>
                                  <button
                                    className="btn btn-xs btn-ghost text-error"
                                    onClick={() => handleRemoveSong(setlist.id, song.tab_url)}
                                    title="Remove from setlist"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
