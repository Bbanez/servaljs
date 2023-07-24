import * as crypto from 'crypto';
import * as WebSocket from '@fastify/websocket';
import { defaultHttpErrorHandler, Logger, Module } from 'servaljs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IncomingMessage } from 'http';

export interface ServalSocketConnection {
  id: string;
  channels: string[];
  metadata?: unknown;
  stream: WebSocket.SocketStream;
  emit(eventName: string, eventData: unknown): void;
}

export class ServalSocketManager {
  static conns: {
    [id: string]: ServalSocketConnection;
  } = {};

  static channelEmit(
    channels: string[],
    eventName: string,
    eventData: unknown,
  ): void {
    Object.keys(ServalSocketManager.conns).forEach((id) => {
      const conn = ServalSocketManager.conns[id];
      let found = false;
      for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        if (conn.channels.includes(channel)) {
          found = true;
          break;
        }
      }
      if (found) {
        conn.emit(eventName, eventData);
      }
    });
  }
}

export interface ServalSocketEvent {
  id: string;
  eventName: string;
  eventData: unknown;
}

export interface ServalSocketEventHandler<Data = unknown> {
  (data: Data, connection: ServalSocketConnection): Promise<void> | void;
}

export interface ServalSocketConfig {
  path: string;
  maxPayload?: number;
  eventHandlers?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [eventName: string]: ServalSocketEventHandler<any>;
  };
  errorHandler?(
    err: unknown,
    connection: WebSocket.SocketStream,
    req: FastifyRequest,
    replay: FastifyReply,
  ): Promise<void> | void;
  validateConnection?(
    info: {
      origin: string;
      secure: boolean;
      req: IncomingMessage;
    },
    next: (ok: boolean) => void,
  ): Promise<void> | void;
  onConnection?(
    connection: ServalSocketConnection,
    request: FastifyRequest,
  ): Promise<void> | void;
  onDisconnect?(connection: ServalSocketConnection): Promise<void> | void;
  onMessage?(message: Buffer): Promise<void> | void;
}

export function createServalSocket(config: ServalSocketConfig): Module {
  return {
    name: 'Socket',
    initialize({ next, fastify, name }) {
      const logger = new Logger(name);
      async function init() {
        if (!config.errorHandler) {
          config.errorHandler = (err, _conn, req, replay) => {
            defaultHttpErrorHandler(err, req, replay, logger);
          };
        }
        await fastify.register(WebSocket, {
          errorHandler: config.errorHandler,
          options: {
            maxPayload: config.maxPayload,
            verifyClient: config.validateConnection,
          },
        });
        await fastify.register(async () => {
          fastify.get(
            config.path,
            { websocket: true },
            async (connection, req) => {
              const id = crypto
                .createHash('sha1')
                .update(Date.now() + crypto.randomBytes(8).toString('base64'))
                .digest('hex');
              ServalSocketManager.conns[id] = {
                id,
                channels: [],
                stream: connection,
                emit(eventName, eventData) {
                  connection.socket.send(
                    JSON.stringify({ en: eventName, ed: eventData }),
                  );
                },
              };
              logger.info('', `New socket connection "${id}"`);
              if (config.onConnection) {
                await config.onConnection(ServalSocketManager.conns[id], req);
              }
              connection.socket.on('message', async (message: Buffer) => {
                const msg = message.toString();
                try {
                  const data = JSON.parse(msg);
                  if (
                    data.en &&
                    data.ed &&
                    config.eventHandlers &&
                    config.eventHandlers[data.en]
                  ) {
                    await config.eventHandlers[data.en](
                      data.ed,
                      ServalSocketManager.conns[id],
                    );
                  }
                } catch (error) {
                  logger.warn(id, error);
                }
              });
              connection.socket.on('close', async () => {
                if (config.onDisconnect) {
                  await config.onDisconnect(ServalSocketManager.conns[id]);
                }
                logger.info('', `Socket disconnected "${id}"`);
                delete ServalSocketManager.conns[id];
              });
            },
          );
        });
      }
      init()
        .then(() => next())
        .catch((err) => next(err));
    },
  };
}
