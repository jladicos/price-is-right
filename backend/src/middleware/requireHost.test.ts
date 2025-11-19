import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { requireHost } from './requireHost';

describe('requireHost middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
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
    (mockRequest as any).player = {
      id: 1,
      name: 'Test Host',
      role: 'host',
      active: true,
    };

    await requireHost(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(codeMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('should reject non-host users with 403', async () => {
    (mockRequest as any).player = {
      id: 2,
      name: 'Test Player',
      role: 'player',
      active: true,
    };

    await requireHost(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(codeMock).toHaveBeenCalledWith(403);
    expect(sendMock).toHaveBeenCalledWith({ error: 'Host access required' });
  });

  it('should reject audience users with 403', async () => {
    (mockRequest as any).player = {
      id: 3,
      name: 'Test Audience',
      role: 'audience',
      active: true,
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
    (mockRequest as any).player = null;

    await requireHost(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(codeMock).toHaveBeenCalledWith(401);
    expect(sendMock).toHaveBeenCalledWith({ error: 'Authentication required' });
  });

  it('should return 401 if player is undefined', async () => {
    (mockRequest as any).player = undefined;

    await requireHost(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(codeMock).toHaveBeenCalledWith(401);
    expect(sendMock).toHaveBeenCalledWith({ error: 'Authentication required' });
  });
});
