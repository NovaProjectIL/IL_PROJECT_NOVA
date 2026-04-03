// markers.events.ts
// Centralise tous les noms des événements WebSocket émis après chaque action markers.
// À importer dans markers.service.ts ET côté frontend (Nadjib/Fatma).

/**
 * marker:created
 * Émis après : POST /rooms/:roomId/markers
 * Payload :
 * {
 *   roomId: number,
 *   marker: {
 *     id: number,
 *     timeSec: number,
 *     label: string,
 *     content: string | null,
 *     category: 'ERROR' | 'COMMENT' | 'HIGHLIGHT' | 'QUESTION',
 *     version: number,
 *     createdBy: { id, name, role },
 *     video: { youtubeId, title, durationSec },
 *     createdAt: Date,
 *     updatedAt: Date,
 *   }
 * }
 *
 * marker:updated
 * Émis après : PATCH /rooms/:roomId/markers/:markerId
 * Payload :
 * {
 *   roomId: number,
 *   marker: {
 *     id: number,
 *     timeSec: number,
 *     label: string,
 *     content: string | null,
 *     category: 'ERROR' | 'COMMENT' | 'HIGHLIGHT' | 'QUESTION',
 *     version: number,
 *     updatedAt: Date,
 *   }
 * }
 *
 * marker:deleted
 * Émis après : DELETE /rooms/:roomId/markers/:markerId
 * Payload :
 * {
 *   roomId: number,
 *   markerId: number,
 * }
 */

export const MARKER_EVENTS = {
  CREATED: 'marker:created',
  UPDATED: 'marker:updated',
  DELETED: 'marker:deleted',
} as const;