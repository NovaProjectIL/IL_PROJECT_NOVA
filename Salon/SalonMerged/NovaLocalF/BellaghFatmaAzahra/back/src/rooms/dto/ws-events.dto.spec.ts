import { validate } from 'class-validator';
import { SeekDto, PlaybackControlDto } from '../dto/ws-events.dto';

describe('WS DTOs Validation', () => {
  it('SeekDto should fail with negative position', async () => {
    const dto = new SeekDto();
    dto.codeRoom = 'ROOM1';
    dto.positionSec = -5;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('SeekDto should fail with empty codeRoom', async () => {
    const dto = new SeekDto();
    dto.codeRoom = '';
    dto.positionSec = 10;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('PlaybackControlDto should pass with valid data', async () => {
    const dto = new PlaybackControlDto();
    dto.codeRoom = 'ROOM1';
    dto.positionSec = 15.5;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
