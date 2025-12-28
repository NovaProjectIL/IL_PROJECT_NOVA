import { Body, Controller, Post, Get, Query } from '@nestjs/common';
import axios from 'axios'; // IMPORT AJOUTÉ
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CreateStateDto } from './dto/create-state.dto';
import { DeleteMemberDto } from './dto/delete-member.dto';
import { EndRoomDto } from './dto/end-room.dto';
import { PlayDirectDto } from './dto/play-direct.dto';
import { VideoEndedDto } from './dto/video-ended.dto';
import { GetPlaybackDto } from './dto/get-playback.dto';
import * as QRCode from 'qrcode';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // Méthode pour parser la durée ISO 8601 de YouTube
  private parseISODuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 180;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    return (hours * 3600) + (minutes * 60) + seconds;
  }
  // Ajoute après parseISODuration()
private async estimateVideoDuration(videoId: string): Promise<number> {
  try {
    const response = await axios.get(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    const html = response.data as string;
    
    // Cherche la durée dans différents patterns
    const patterns = [
      /"approxDurationMs":"(\d+)"/,
      /"lengthSeconds":"(\d+)"/,
      /"duration":"PT(\d+)M(\d+)S"/,
      /"duration":"PT(\d+)H(\d+)M(\d+)S"/,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        if (pattern.toString().includes('DurationMs')) {
          return Math.floor(parseInt(match[1]) / 1000);
        } else if (pattern.toString().includes('lengthSeconds')) {
          return parseInt(match[1]);
        } else if (pattern.toString().includes('PT')) {
          // Format PT1H2M3S
          const hours = match[1] ? parseInt(match[1]) : 0;
          const minutes = match[2] ? parseInt(match[2]) : 0;
          const seconds = match[3] ? parseInt(match[3]) : 0;
          return (hours * 3600) + (minutes * 60) + seconds;
        }
      }
    }
    
    return 180; // Fallback
  } catch {
    return 180; // Fallback
  }
}

  /**
   * POST /rooms
   * Body: { "displayName": "Zineb" }
   *
   * Creates a salon and returns:
   *  - internal room id
   *  - public code
   *  - creator member id and name
   */

@Post()
async createRoom(@Body() body: CreateRoomDto) {
  const { displayName } = body;
  

  const serviceResult = await this.roomsService.createRoom(displayName);
  

  const { room, creator, chatSession, qrCode, inviteLink } = serviceResult;
 
  console.log('🔍 Service result structure:', {
    hasRoom: !!room,
    hasCreator: !!creator,
    hasChatSession: !!chatSession,
    hasQrCode: !!qrCode,
    qrCodeLength: qrCode?.length,
    hasInviteLink: !!inviteLink,
    inviteLinkValue: inviteLink
  });
  
  // ⬇️ Retournez TOUTES les propriétés
  return {
    roomId: room.id,
    code: room.code,
    creatorId: creator.id,
    creatorName: creator.name,
    chatSession: {
      id: chatSession.id,
    },
    // ⬇️⬇️⬇️ INCLUEZ CES PROPRIÉTÉS
    qrCode: qrCode || room.QRcode,       // Utilisez qrCode du service ou de la room
    inviteLink: inviteLink || room.link,  // Utilisez inviteLink du service ou de la room
    // ⬇️ Optionnel: ajoutez aussi inviteCode pour cohérence
    inviteCode: room.code,
  };
}

@Post("join")
async joinRoom(@Body() body: CreateMemberDto) {
  const { displayName, codeRoom } = body;
  
  // ⬇️ Important: utilisez la bonne méthode du service
  const { room, user } = await this.roomsService.joinRoom(displayName, codeRoom.toUpperCase());
  
  // ⬇️ DEBUG
  console.log('🔍 Room in join:', {
    code: room.code,
    hasQRcode: !!room.QRcode,
    hasLink: !!room.link
  });
  
  return {
    roomId: room.id,
    code: room.code,
    creatorId: user.role === 'CREATOR' ? user.id : null,
    creatorName: user.role === 'CREATOR' ? user.name : null,
   
    QRcode: room.QRcode,
    link: room.link,
   
    qrCode: room.QRcode,    
    inviteLink: room.link,  
    inviteCode: room.code,   
  };
}

@Post('seek')
async seek(@Body() body: { codeRoom: string; positionSec: number }) {
  const { codeRoom, positionSec } = body;
  const { room, playback } = await this.roomsService.seek(codeRoom.toUpperCase(), positionSec);

  return {
    roomId: room.id,
    code: room.code,
    playback: {
      status: playback.status,
      positionSec: playback.positionSec,
      playbackRate: playback.playbackRate,
      serverTimeRef: playback.serverTimeRef,
      sourceType: playback.sourceType,
      video: playback.video ? {
        youtubeId: playback.video.youtubeId,
        title: playback.video.title,
        channelTitle: playback.video.channelTitle,
        durationSec: playback.video.durationSec,
        thumbnailUrl: playback.video.thumbnailUrl,
      } : null,
    },
  };
}


  @Post("invite")
  async inviteRoom(@Body() body: CreateInviteDto) {
    const { codeRoom } = body;
    const { room } = await this.roomsService.inviteToRoom(codeRoom.toUpperCase());

    return {
      roomId: room.id,
      code: room.code,
      QRcode: room.QRcode,
      link: room.link,
    };
  }

  @Get('members')
  async getMembers(@Query('codeRoom') codeRoom: string) {
    const users = await this.roomsService.getRoomMembers(codeRoom.toUpperCase());
    return {
      membersCount: users.length,
      members: users.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        joinedAt: u.joinedAt,
      })),
    };
  }

  @Get('state')
  async stateRoom(@Query() dto: CreateStateDto) {
    const codeRoom = dto.codeRoom;
    const {
      room,
      playlist,
      playbackState,
      users,
      entries,
      chatSession,
      messages,
    } = await this.roomsService.stateRoom(codeRoom.toUpperCase());

   return {
    roomId: room.id,
    code: room.code,
    link: room.link,
    QRcode: room.QRcode,
    
    qrCode: room.QRcode,
    inviteLink: room.link,
    inviteCode: room.code,
    createdAt: room.createdAt,
    lastActivityAt: room.lastActivityAt,

      membersCount: users.length,
      members: users.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        joinedAt: m.joinedAt,
      })),

      playlist: playlist
        ? {
            id: playlist.id,
            currentIndex: playlist.currentIndex, // -1 = none
            entries: entries.map((e) => ({
              id: e.id,
              position: e.position,
              addedAt: e.addedAt,
              addedBy: e.addedBy
                ? {
                    id: e.addedBy.id,
                    name: e.addedBy.name,
                  }
                : null,
              video: e.video
                ? {
                    youtubeId: e.video.youtubeId,
                    title: e.video.title,
                    channelTitle: e.video.channelTitle,
                    durationSec: e.video.durationSec,
                    thumbnailUrl: e.video.thumbnailUrl,
                  }
                : null,
            })),
          }
        : null,

      playback: playbackState
        ? {
            status: playbackState.status,
            positionSec: playbackState.positionSec,
            playbackRate: playbackState.playbackRate,
            serverTimeRef: playbackState.serverTimeRef,
            sourceType: playbackState.sourceType,
            video: playbackState.video
              ? {
                  youtubeId: playbackState.video.youtubeId,
                  title: playbackState.video.title,
                  channelTitle: playbackState.video.channelTitle,
                  durationSec: playbackState.video.durationSec,
                  thumbnailUrl: playbackState.video.thumbnailUrl,
                }
              : null,
          }
        : null,

      chatSession: chatSession
        ? {
            id: chatSession.id,
            createdAt: chatSession.createdAt,
            messages: messages.map((msg) => ({
              id: msg.id,
              content: msg.content,
              gifUrl: msg.gifUrl,
              createdAt: msg.createdAt,
              user: msg.user
                ? {
                    id: msg.user.id,
                    name: msg.user.name,
                  }
                : null,
            })),
          }
        : null,
    };
  }

@Post("leave")
async leaveRoom(@Body() body: DeleteMemberDto) {
  const { memberId, codeRoom } = body;
  
  // Cette méthode supprime PHYSIQUEMENT l'utilisateur
  const { roomDeleted, roomId, removedMemberId, removedMemberName } = 
    await this.roomsService.removeUserFromRoom(memberId, codeRoom.toUpperCase());

  return {
    roomDeleted,
    roomId,
    removedMemberId,
    removedMemberName,
  };
}
  @Post("End")
  async endRoom(@Body() body: EndRoomDto) {
    const { memberId, codeRoom } = body;
    const { roomDeleted, roomId } = await this.roomsService.endRoom(memberId, codeRoom.toUpperCase());

    return {
        roomDeleted,
        roomId,
      };
  }

  @Post('play-direct')
  async playDirect(@Body() body: PlayDirectDto) {
    const {
      codeRoom,
      memberId,
      youtubeId,
      youtubeVTitle,
      youtubeVChannel,
      youtubeVDurationSec,
      youtubeVThumbnailUrl,
    } = body;

    const { room, user, video, playback } =
      await this.roomsService.playDirectVideo(
        codeRoom.toUpperCase(),
        memberId,
        youtubeId,
        youtubeVTitle,
        youtubeVChannel,
        youtubeVDurationSec,
        youtubeVThumbnailUrl,
      );

    return {
      roomId: room.id,
      code: room.code,
      member: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      video: {
        youtubeId: video.youtubeId,
        title: video.title,
        channelTitle: video.channelTitle,
        durationSec: video.durationSec,
        thumbnailUrl: video.thumbnailUrl,
      },
      playback: {
        status: playback.status,
        positionSec: playback.positionSec,
        playbackRate: playback.playbackRate,
        serverTimeRef: playback.serverTimeRef,
        sourceType: playback.sourceType,
      },
    };
  }

  @Post('video-ended')
  async videoEnded(@Body() body: VideoEndedDto) {
    const { codeRoom } = body;

    const { room, playlist, playback } =
        await this.roomsService.handleVideoEnded(codeRoom.toUpperCase());

    return {
      roomId: room.id,
      code: room.code,
      playback: {
        status: playback.status,
        sourceType: playback.sourceType,
        positionSec: playback.positionSec,
        video: playback.video ? {
          youtubeId: playback.video.youtubeId,
          title: playback.video.title,
          channelTitle: playback.video.channelTitle,
          durationSec: playback.video.durationSec,
          thumbnailUrl: playback.video.thumbnailUrl,
        } : null
      },
      playlist: playlist ? {
        id: playlist.id,
        currentIndex: playlist.currentIndex
      } : null
    };
  }

  @Get('playback')
  async getPlayback(@Query() dto: GetPlaybackDto) {
    const codeRoom = dto.codeRoom;

    const { room, playlist, playback, currentEntry, totalEntries } =
      await this.roomsService.getPlayback(codeRoom.toUpperCase());

    return {
      roomId: room.id,
      code: room.code,

      playback: playback
        ? {
            status: playback.status,
            positionSec: playback.positionSec,
            playbackRate: playback.playbackRate,
            serverTimeRef: playback.serverTimeRef,
            sourceType: playback.sourceType,
            video: playback.video
              ? {
                  youtubeId: playback.video.youtubeId,
                  title: playback.video.title,
                  channelTitle: playback.video.channelTitle,
                  durationSec: playback.video.durationSec,
                  thumbnailUrl: playback.video.thumbnailUrl,
                }
              : null,
          }
        : null,

      playlist: playlist
        ? {
            id: playlist.id,
            currentIndex: playlist.currentIndex,
            totalEntries,
            currentEntry: currentEntry
              ? {
                  id: currentEntry.id,
                  position: currentEntry.position,
                  addedAt: currentEntry.addedAt,
                  addedBy: currentEntry.addedBy
                    ? {
                        id: currentEntry.addedBy.id,
                        name: currentEntry.addedBy.name,
                      }
                    : null,
                  video: currentEntry.video
                    ? {
                        youtubeId: currentEntry.video.youtubeId,
                        title: currentEntry.video.title,
                        channelTitle: currentEntry.video.channelTitle,
                        durationSec: currentEntry.video.durationSec,
                        thumbnailUrl: currentEntry.video.thumbnailUrl,
                      }
                    : null,
                }
              : null,
          }
        : null,
    };
  }

  @Get('health')
async healthCheck() {
  return {
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'YouTube Watch Party API'
  };
}

  // 🎯 NOUVEL ENDPOINT : Récupération des infos YouTube
@Get('youtube-info')
async getYouTubeInfo(@Query('videoId') videoId: string) {
  console.log('🔄 Récupération infos YouTube pour:', videoId);
  
  if (!videoId || videoId.length !== 11) {
    return {
      success: false,
      title: `Vidéo ${videoId}`,
      author: 'YouTube',
      thumbnail: `https://img.youtube.com/vi/${videoId}/0.jpg`,
      durationSec: 180,
    };
  }

  // 1. ESSAYE YouTube Data API v3 (avec ta clé)
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  
  if (YOUTUBE_API_KEY) {
    try {
      console.log('📡 Tentative YouTube Data API v3...');
      const youtubeResponse = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos`,
        {
          params: {
            part: 'snippet,contentDetails,statistics',
            id: videoId,
            key: YOUTUBE_API_KEY
          },
          timeout: 5000
        }
      );
      
      if (youtubeResponse.data.items?.length > 0) {
        const item = youtubeResponse.data.items[0];
        const title = item.snippet.title;
        const author = item.snippet.channelTitle;
        const thumbnail = item.snippet.thumbnails?.maxres?.url || 
                         item.snippet.thumbnails?.high?.url || 
                         item.snippet.thumbnails?.medium?.url || 
                         `https://img.youtube.com/vi/${videoId}/0.jpg`;
        
        // DURÉE RÉELLE !
        const durationISO = item.contentDetails?.duration || 'PT0M';
        const durationSec = this.parseISODuration(durationISO);
        
        console.log('✅ YouTube Data API réussi!');
        console.log('   Titre:', title);
        console.log('   Durée:', durationSec, 'sec =', Math.floor(durationSec/60), 'min', durationSec%60, 'sec');
        
        return {
          success: true,
          title: title,
          author: author,
          thumbnail: thumbnail,
          durationSec: durationSec,
        };
      }
    } catch (error: any) {
      console.log('❌ YouTube API échoué:', error.message);
    }
  } else {
    console.log('⚠️ Pas de clé YouTube API, utilisation méthodes alternatives');
  }

  // 2. ESSAYE OEmbed
  try {
    console.log('📡 Tentative oEmbed...');
    const oembedResponse = await axios.get(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { timeout: 5000 }
    );
    
    if (oembedResponse.data?.title) {
      console.log('✅ oEmbed réussi');
      const durationSec = await this.estimateVideoDuration(videoId);
      
      return {
        success: true,
        title: oembedResponse.data.title,
        author: oembedResponse.data.author_name || 'YouTube',
        thumbnail: oembedResponse.data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/0.jpg`,
        durationSec: durationSec,
      };
    }
  } catch (oembedError: any) {
    console.log('❌ oEmbed échoué');
  }

  // 3. FALLBACK
  console.log('⚠️ Toutes méthodes échouées, fallback');
  const durationSec = await this.estimateVideoDuration(videoId);
  
  return {
    success: false,
    title: `Vidéo ${videoId}`,
    author: 'YouTube',
    thumbnail: `https://img.youtube.com/vi/${videoId}/0.jpg`,
    durationSec: durationSec,
  };
}
  // 🎯 NOUVEL ENDPOINT : Play (pour WebSocket)
 // 🎯 NOUVEL ENDPOINT : Play (pour WebSocket) - CORRIGÉ
@Post('play')
async play(@Body() body: { codeRoom: string; positionSec?: number }) {
  const { codeRoom, positionSec } = body;
  const { room, playback } = await this.roomsService.play(codeRoom.toUpperCase(), positionSec);

  return {
    roomId: room.id,
    code: room.code,
    playback: {
      status: playback.status,
      positionSec: playback.positionSec,
      playbackRate: playback.playbackRate,
      serverTimeRef: playback.serverTimeRef,
      sourceType: playback.sourceType,
      video: playback.video ? {
        youtubeId: playback.video.youtubeId,
        title: playback.video.title,
        channelTitle: playback.video.channelTitle,
        durationSec: playback.video.durationSec,
        thumbnailUrl: playback.video.thumbnailUrl,
      } : null,
    },
  };
}

  // 🎯 NOUVEL ENDPOINT : Pause (pour WebSocket)
  // 🎯 NOUVEL ENDPOINT : Pause (pour WebSocket) - CORRIGÉ
@Post('pause')
async pause(@Body() body: { codeRoom: string; positionSec?: number }) {
  const { codeRoom, positionSec } = body;
  const { room, playback } = await this.roomsService.pause(codeRoom.toUpperCase(), positionSec);

  return {
    roomId: room.id,
    code: room.code,
    playback: {
      status: playback.status,
      positionSec: playback.positionSec,
      playbackRate: playback.playbackRate,
      serverTimeRef: playback.serverTimeRef,
      sourceType: playback.sourceType,
      video: playback.video ? {
        youtubeId: playback.video.youtubeId,
        title: playback.video.title,
        channelTitle: playback.video.channelTitle,
        durationSec: playback.video.durationSec,
        thumbnailUrl: playback.video.thumbnailUrl,
      } : null,
    },
  };
}
// 🎯 NOUVEL ENDPOINT : Générer QR Code
@Get('qr-code')
async generateQRCode(@Query('codeRoom') codeRoom: string) {
  const room = await this.roomsService.getRoomByCode(codeRoom.toUpperCase());
  
  const baseUrl = process.env.FRONTEND_BASE_URL ?? 'http://localhost:4200';
  const inviteLink = `${baseUrl}/rooms/join/${room.code}`;
  
  // Générer QR code à la volée
  const qrCode = await QRCode.toDataURL(inviteLink);
  
  return {
    codeRoom: room.code,
    inviteLink,
    qrCode,
    generatedAt: new Date().toISOString(),
  };
}

// 🎯 NOUVEL ENDPOINT : Générer QR code avec options
@Get('qr-code/custom')
async generateCustomQRCode(
  @Query('codeRoom') codeRoom: string,
  @Query('size') size: string = '300',
  @Query('color') color: string = '000000',
  @Query('bgColor') bgColor: string = 'ffffff'
) {
  const room = await this.roomsService.getRoomByCode(codeRoom.toUpperCase());

  const baseUrl = process.env.FRONTEND_BASE_URL ?? 'http://localhost:4200';
  const inviteLink = `${baseUrl}/rooms/join/${room.code}`;

  // Options pour le QR code
  const qrCode = await QRCode.toDataURL(inviteLink, {
    width: parseInt(size),
    margin: 2,
    color: {
      dark: `#${color}`,
      light: `#${bgColor}`,
    },
  });

  return {
    codeRoom: room.code,
    inviteLink,
    qrCode,
    size: parseInt(size),
    color: `#${color}`,
    backgroundColor: `#${bgColor}`,
    generatedAt: new Date().toISOString(),
  };
}

// 🎯 NOUVEL ENDPOINT : Mettre à jour le pseudo d'un membre
@Post('update-member-name')
async updateMemberName(@Body() body: { memberId: number; codeRoom: string; newName: string }) {
  const { memberId, codeRoom, newName } = body;

  const result = await this.roomsService.updateMemberName(memberId, codeRoom.toUpperCase(), newName);

  return {
    success: true,
    memberId: result.memberId,
    oldName: result.oldName,
    newName: result.newName,
    roomCode: result.roomCode,
  };
}
}