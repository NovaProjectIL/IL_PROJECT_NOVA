
'use client';

import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Film, Play, Trash2, Music, Scroll, Lightbulb, ArrowUpDown } from 'lucide-react';

interface PlaylistEntry {
  id: number;
  video: {
    youtubeId: string;
    title: string;
    durationSec?: number;
    thumbnailUrl?: string;
  };
  position: number;
}

interface Playlist {
  entries: PlaylistEntry[];
  currentIndex: number;
}

interface PlaylistComponentProps {
  playlist: Playlist | null;
  code: string;
  memberId: number;
  onPlayVideo: (index: number) => void;
  onDeleteVideo: (entryId: number) => void;
  onReorder: (entryId: number, oldPosition: number, newPosition: number) => Promise<void>;
  isLoading?: boolean;
}

function SortablePlaylistItem({
  entry,
  index,
  playlist,
  onPlayVideo,
  onDeleteVideo,
  isDragging
}: {
  entry: PlaylistEntry;
  index: number;
  playlist: Playlist;
  onPlayVideo: (index: number) => void;
  onDeleteVideo: (entryId: number) => void;
  isDragging: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return '??:??';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`playlist-item ${index === playlist.currentIndex ? 'current' : ''}`}
      onClick={() => onPlayVideo(index)}
    >
      <div className="drag-handle" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
        <span className="handle-icon">
          <GripVertical size={20} />
        </span>
      </div>
      
      <div className="item-position">
        <span className="position-number">{index + 1}</span>
      </div>
      
      <div className="item-thumbnail">
        {entry.video?.thumbnailUrl ? (
          <img 
            src={entry.video.thumbnailUrl} 
            alt={entry.video.title}
            className="thumbnail-image"
            loading="lazy"
          />
        ) : (
          <div className="thumbnail-placeholder">
            <Film size={24} />
          </div>
        )}
        <div className="thumbnail-overlay">
          <span className="duration">{formatTime(entry.video?.durationSec)}</span>
        </div>
      </div>
      
      <div className="item-info">
        <h4 className="video-title" title={entry.video?.title || 'Sans titre'}>
          {entry.video?.title || 'Sans titre'}
        </h4>
        <p className="video-channel">
          {entry.video?.youtubeId?.substring(0, 8)}...
        </p>
        <div className="item-meta">
          <span className="added-by">
            Durée: {formatTime(entry.video?.durationSec)}
          </span>
        </div>
      </div>
      
      <div className="item-actions">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayVideo(index);
          }}
          className="action-button play-button"
          title="Lire cette vidéo"
        >
          <span className="action-icon">
            <Play size={18} />
          </span>
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('Supprimer cette vidéo de la playlist ?')) {
              onDeleteVideo(entry.id);
            }
          }}
          className="action-button delete-button"
          title="Supprimer de la playlist"
        >
          <span className="action-icon">
            <Trash2 size={18} />
          </span>
        </button>
      </div>
    </div>
  );
}

export default function PlaylistComponent({
  playlist,
  code,
  memberId,
  onPlayVideo,
  onDeleteVideo,
  onReorder,
  isLoading = false
}: PlaylistComponentProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
    setIsReordering(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsReordering(false);
    
    if (over && active.id !== over.id && playlist) {
      const oldIndex = playlist.entries.findIndex(item => item.id === active.id);
      const newIndex = playlist.entries.findIndex(item => item.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const entryId = active.id as number;
        const oldPosition = playlist.entries[oldIndex].position;
        const newPosition = playlist.entries[newIndex].position;
        
        try {
          await onReorder(entryId, oldPosition, newPosition);
        } catch (error) {
          console.error('Erreur réorganisation:', error);
        }
      }
    }
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return '??:??';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (isLoading) {
    return (
      <div className="playlist-panel empty">
        <div className="panel-header">
          <h3>
            <Scroll size={20} style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
            Playlist
          </h3>
          <span className="count-badge">0</span>
        </div>
        <div className="empty-playlist">
          <div className="loading-spinner"></div>
          <h4>Chargement de la playlist...</h4>
        </div>
      </div>
    );
  }

  if (!playlist || !playlist.entries || playlist.entries.length === 0) {
    return (
      <div className="playlist-panel empty">
        <div className="panel-header">
          <h3>
            <Scroll size={20} style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
            Playlist
          </h3>
          <span className="count-badge">0</span>
        </div>
        <div className="empty-playlist">
          <div className="empty-icon">
            <Music size={64} strokeWidth={1.5} />
          </div>
          <h4>Playlist vide</h4>
          <p className="empty-description">
            Ajoutez des vidéos depuis la barre de recherche
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="playlist-panel">
      <div className="panel-header">
        <div className="header-left">
          <h3>
            <span className="header-icon">
              <Scroll size={20} />
            </span>
            Playlist
          </h3>
          <span className="count-badge">{playlist.entries.length}</span>
        </div>
        
        <div className="header-actions">
          {isReordering ? (
            <span className="reordering">
              <span className="spinner-small"></span>
              Réorganisation...
            </span>
          ) : (
            <span className="reorder-hint">
              <span className="hint-icon">
                <ArrowUpDown size={16} />
              </span>
              Glisser-déposer pour réorganiser
            </span>
          )}
        </div>
      </div>
      
      <div className="playlist-stats">
        <div className="stat-item">
          <span className="stat-label">Vidéos:</span>
          <span className="stat-value">{playlist.entries.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Actuellement:</span>
          <span className="stat-value current-track">
            {playlist.currentIndex >= 0 ? playlist.currentIndex + 1 : '-'}
            /{playlist.entries.length}
          </span>
        </div>
      </div>
      
      <div className="playlist-scrollable">
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={playlist.entries.map(entry => entry.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="playlist-items">
              {playlist.entries.map((entry, index) => (
                <SortablePlaylistItem
                  key={entry.id}
                  entry={entry}
                  index={index}
                  playlist={playlist}
                  onPlayVideo={onPlayVideo}
                  onDeleteVideo={onDeleteVideo}
                  isDragging={activeId === entry.id}
                />
              ))}
            </div>
          </SortableContext>
          
          <DragOverlay>
            {activeId ? (
              <div className="playlist-item dragging-overlay">
                {(() => {
                  const activeEntry = playlist.entries.find(e => e.id === activeId);
                  if (!activeEntry) {
                    return <div className="video-title">Déplacement...</div>;
                  }
                  return (
                    <div className="drag-overlay-content">
                      <div className="drag-overlay-thumb">
                        {activeEntry.video?.thumbnailUrl ? (
                          <img
                            src={activeEntry.video.thumbnailUrl}
                            alt={activeEntry.video.title}
                            className="drag-overlay-image"
                          />
                        ) : (
                          <div className="drag-overlay-placeholder">
                            <Film size={20} />
                          </div>
                        )}
                        <span className="drag-overlay-duration">
                          {formatTime(activeEntry.video?.durationSec)}
                        </span>
                      </div>
                      <div className="drag-overlay-info">
                        <div className="drag-overlay-title">
                          {activeEntry.video?.title || "Sans titre"}
                        </div>
                        <div className="drag-overlay-channel">
                          {activeEntry.video?.youtubeId?.substring(0, 8)}...
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      
      <div className="playlist-footer">
        <div className="footer-info">
          <span className="footer-text">
            <span className="info-icon">
              <Lightbulb size={16} />
            </span>
            Cliquez sur une vidéo pour la lire
          </span>
        </div>
      </div>
    </div>
  );
}
