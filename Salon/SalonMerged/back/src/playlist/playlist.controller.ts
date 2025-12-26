import { Body, Controller, Post, Get, Query } from '@nestjs/common';
import { PlaylistService } from './playlist.service';
import { GetPlaylistDto } from './dto/get-playlist.dto';
import { AddPlaylistDto } from './dto/add-playlist.dto';
import { DeletePlaylistDto } from './dto/delete-playlist.dto';
import { ChangeIndexDto } from './dto/change-index.dto';
import { ReorderPlaylistDto } from './dto/reorder-playlist.dto';
import { NextPlaylistDto } from './dto/next-playlist.dto';
import { PreviousPlaylistDto } from './dto/previous-playlist.dto';

@Controller('playlist')
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Get()
  async getPlaylist(@Query() dto : GetPlaylistDto){
    const codeRoom = dto.codeRoom;
    const { room, playlist, entries } = 
    await this.playlistService.getPlaylist(codeRoom.toUpperCase());

    return {
        roomId: room.id,
        code: room.code,
        link: room.link,
        QRcode: room.QRcode,

        playlist: playlist
            ? {
                id: playlist.id,
                currentIndex: playlist.currentIndex,
                entries: entries.map(e => ({
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
    };
  }

  @Post("add")
  async addPlaylist(@Body() body: AddPlaylistDto) {
        const { memberId, codeRoom, youtubeId, youtubeVTitle, youtubeVChannel, youtubeVDurationSec, youtubeVThumbnailUrl} = body;
        const { room, playlist, entries } = await this.playlistService.addPlaylist(codeRoom.toUpperCase(), memberId, youtubeId, youtubeVTitle, youtubeVChannel, youtubeVDurationSec, youtubeVThumbnailUrl);

        return {
            roomId: room.id,
            code: room.code,
            playlistId: playlist.id,
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
        };
    }

  @Post("delete")
  async deletePlaylist(@Body() body: DeletePlaylistDto) {
        const { memberId, codeRoom, entryId} = body;
        const { room, playlist, entries } = await this.playlistService.deletePlaylist(codeRoom.toUpperCase(), memberId, entryId);

        return {
            roomId: room.id,
            code: room.code,
            playlistId: playlist.id,
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
        };
    }

    @Post("change-index")
    async changeIndex(@Body() body: ChangeIndexDto) {
    const { memberId, codeRoom, newIndex } = body;

    const { room, playlist, entries } =
        await this.playlistService.changeCurrentIndex(
        codeRoom.toUpperCase(),
        memberId,
        newIndex,
        );

    return {
        roomId: room.id,
        code: room.code,
        playlistId: playlist.id,
        currentIndex: playlist.currentIndex,
        entries: entries.map(e => ({
            id: e.id,
            position: e.position,
            addedAt: e.addedAt,
            addedBy: e.addedBy
                ? { id: e.addedBy.id, name: e.addedBy.name }
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
    };
    }
    
  @Post('reorder')
  async reorder(@Body() body: ReorderPlaylistDto) {
    const { memberId, codeRoom, entryId, oldPosition, newPosition } = body;

    const { room, playlist, entries } =
      await this.playlistService.reorderEntry(
        codeRoom.toUpperCase(),
        memberId,
        entryId,
        oldPosition,
        newPosition,
      );

    return {
      roomId: room.id,
      code: room.code,
      playlistId: playlist.id,
      currentIndex: playlist.currentIndex,
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
    };
  }

    @Post('next')
    async next(@Body() body: NextPlaylistDto) {
    const { codeRoom } = body;

    const { room, playlist, entries } =
        await this.playlistService.goToNextEntry(codeRoom.toUpperCase());

    return {
        roomId: room.id,
        code: room.code,
        playlistId: playlist.id,
        currentIndex: playlist.currentIndex,
        entries: entries.map((e) => ({
        id: e.id,
        position: e.position,
        addedAt: e.addedAt,
        addedBy: e.addedBy
            ? { id: e.addedBy.id, name: e.addedBy.name }
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
    };
    }

    @Post('previous')
    async previous(@Body() body: PreviousPlaylistDto) {
    const { codeRoom } = body;

    const { room, playlist, entries } =
        await this.playlistService.goToPreviousEntry(codeRoom.toUpperCase());

    return {
        roomId: room.id,
        code: room.code,
        playlistId: playlist.id,
        currentIndex: playlist.currentIndex,
        entries: entries.map((e) => ({
        id: e.id,
        position: e.position,
        addedAt: e.addedAt,
        addedBy: e.addedBy
            ? { id: e.addedBy.id, name: e.addedBy.name }
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
    };
    }

}


