import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { requireHost } from './requireHost';
import type { Player } from '../types/player.js';

interface MockRequest extends Partial<FastifyRequest> {
  player?: Player | null;
}

describe('requireHost middleware', () => {
  let mockRequest: MockRequest;
  let mockReply: Partial<FastifyReply>;
  let sendMock: ReturnType<typeof vi.fn>;
  let codeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMock = vi.fn();
    codeMock = vi.fn().mockReturnValue({ send: sendMock });

    mockRequest = {};
    mockReply = {
      code: codeMock,
      send: sendMock,
    };
  });

  it('should allow host users to continue', async () => {
    mockRequest.player = {
      id: 1,
      firstName: 'Test',
      lastName: 'Host',
      email: null,
      accessCode: 'ABC123',
      photoFilename: 'default.jpg',
      role: 'host',
      active: true,
      sessionToken: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await requireHost(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(codeMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('should reject non-host users with 403', async () => {
    mockRequest.player = {
      id: 2,
      firstName: 'Test',
      lastName: 'Player',
      email: null,
      accessCode: 'DEF456',
      photoFilename: 'default.jpg',
      role: 'player',
      active: true,
      sessionToken: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await requireHost(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(codeMock).toHaveBeenCalledWith(403);
    expect(sendMock).toHaveBeenCalledWith({ error: 'Host access required' });
  });

  it('should reject audience users with 403', async () => {
    mockRequest.player = {
      id: 3,
      firstName: 'Test',
      lastName: 'Audience',
      email: null,
      accessCode: 'GHI789',
      photoFilename: 'default.jpg',
      role: 'audience',
      active: true,
      sessionToken: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await requireHost(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(codeMock).toHaveBeenCalledWith(403);
    expect(sendMock).toHaveBeenCalledWith({ error: 'Host access required' });
  });

  it('should return 401 if no player attached to request', async () => {
    // No player on request (auth middleware didn't run or failed)
    await requireHost(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(codeMock).toHaveBeenCalledWith(401);
    expect(sendMock).toHaveBeenCalledWith({ error: 'Authentication required' });
  });

  it('should return 401 if player is explicitly null', async () => {
    mockRequest.player = null;

    await requireHost(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(codeMock).toHaveBeenCalledWith(401);
    expect(sendMock).toHaveBeenCalledWith({ error: 'Authentication required' });
  });

  it('should return 401 if player is undefined', async () => {
    mockRequest.player = undefined;

    await requireHost(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(codeMock).toHaveBeenCalledWith(401);
    expect(sendMock).toHaveBeenCalledWith({ error: 'Authentication required' });
  });
});
