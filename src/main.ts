import * as Fastify from 'fastify';
import * as FastifyMiddie from '@fastify/middie';
import type { Server } from 'http';
import {
  ConsoleColors,
  Logger,
  createLogger,
  type LoggerConfig,
} from './logger';
import { type HttpException, HttpStatus } from './http-error';
import type { Controller, ControllerData, Middleware } from './rest';
import type { Module } from './module';

export interface ServalServer
  extends Omit<Fastify.FastifyListenOptions, 'port'> {
  port: number;
}

export interface ServalConfig extends Fastify.FastifyHttpOptions<Server> {
  server: ServalServer;
  onReady?(event: {
    fastify: Fastify.FastifyInstance;
    config: ServalConfig;
  }): void;
  errorHandler?(
    err: unknown,
    req: Fastify.FastifyRequest,
    replay: Fastify.FastifyReply,
  ): Promise<void> | void;
  defaultControllerErrorHandler?(
    data: ControllerData,
  ): (
    error: Fastify.FastifyError,
    request: Fastify.FastifyRequest,
    reply: Fastify.FastifyReply,
  ) => void;
  notFoundHandler?(
    req: Fastify.FastifyRequest,
    replay: Fastify.FastifyReply,
  ): Promise<void> | void;
  controllers?: Controller[];
  middleware?: Middleware[];
  modules?: Module[];
  logs?: LoggerConfig;
}

export interface Serval {
  fastify: Fastify.FastifyInstance;
  config: ServalConfig;
}

export async function createServal(config: ServalConfig) {
  const rootTimeOffset = Date.now();
  const logger = new Logger('Serval');
  const fastify = Fastify(config);
  if (!config.controllers) {
    config.controllers = [];
  }
  if (!config.middleware) {
    config.middleware = [];
  }
  if (!config.modules) {
    config.modules = [];
  }
  let modules = config.modules;
  if (config.logs) {
    modules = [createLogger(config.logs), ...modules];
  }
  if (config.errorHandler) {
    fastify.setErrorHandler(config.errorHandler);
  } else {
    fastify.setErrorHandler((err, req, replay) => {
      logger.error(req.url, err);
      replay.send({ message: 'Unknown error' });
    });
  }
  if (config.notFoundHandler) {
    fastify.setNotFoundHandler(config.notFoundHandler);
  } else {
    fastify.setNotFoundHandler((req, replay) => {
      logger.warn('notFount', `${req.method}: ${req.url}`);
      replay.code(HttpStatus.NotFound).send({
        message: `${req.method}: ${req.url}`,
      });
    });
  }
  await fastify.register(FastifyMiddie);

  async function initializeControllers(
    controllers: Controller[],
  ): Promise<void> {
    for (let i = 0; i < controllers.length; i++) {
      const controller = controllers[i];
      if (controller) {
        const data = await controller({
          config: config as ServalConfig,
          fastify,
        });
        logger.info('controller', `${data.name}`);
        let methods = data.methods(data);
        if (methods instanceof Promise) {
          methods = await methods;
        }
        for (let j = 0; j < methods.length; j++) {
          const method = methods[j];
          const path = (data.path + method.path).replace(/\/\//g, '/');
          logger.info('controller', `    --> ${path}`);
          if (!method.fastifyRouteOptions.errorHandler) {
            if (config.defaultControllerErrorHandler) {
              method.fastifyRouteOptions.errorHandler =
                config.defaultControllerErrorHandler(data);
            } else {
              method.fastifyRouteOptions.errorHandler = async (
                error,
                request,
                replay,
              ) => {
                const exception = error as unknown as HttpException;
                if (exception.status && exception.message) {
                  logger.warn(request.url, error);
                  if (typeof exception.message === 'object') {
                    replay.header('Content-Type', 'application/json');
                    replay
                      .code(exception.status)
                      .send(JSON.stringify(exception.message));
                    return;
                  } else {
                    replay.header('Content-Type', 'application/json');
                    replay
                      .code(exception.status)
                      .send(JSON.stringify({ message: exception.message }));
                    return;
                  }
                } else {
                  const stack = (error as Error).stack
                    ? ((error as Error).stack as string).split('\n')
                    : [''];
                  logger.error(request.url, {
                    method: request.method,
                    path: request.url,
                    error: {
                      message: (error as Error).message,
                      stack: stack,
                    },
                  });
                  if (stack.join(' ').includes('fastify/lib/validation.js')) {
                    replay
                      .code(400)
                      .send(JSON.stringify({ message: error.message }));
                  } else {
                    replay
                      .code(500)
                      .send(JSON.stringify({ message: 'Unknown exception' }));
                  }
                  return;
                }
              };
            }
          }
          fastify[method.type](
            path,
            method.fastifyRouteOptions,
            method.handler,
          );
        }
      }
    }
  }

  async function initializeMiddleware(
    _middleware: Middleware[],
  ): Promise<void> {
    const middleware = _middleware.map((e) => e());
    for (let i = 0; i < middleware.length; i++) {
      const mv = middleware[i];
      logger.info('middleware', `${mv.name} --> ${mv.path}`);
      let handler = mv.handler();
      if (handler instanceof Promise) {
        handler = await handler;
      }
      fastify.use(mv.path, handler);
    }
  }

  function loadNextModule() {
    if (modules.length > 0) {
      const module = modules.splice(0, 1)[0];
      if (modules.length > 1 && module.name !== 'Logger') {
        logger.info('loadModule', module.name + ' ...');
      }
      const timeOffset = Date.now();
      try {
        let nextCalled = false;
        module.initialize({
          name: module.name,
          fastify,
          rootConfig: config as ServalConfig,
          next(error, data) {
            if (nextCalled) {
              return;
            }
            nextCalled = true;
            if (error) {
              logger.error('loadModule', {
                name: module.name,
                error: ('' + error.stack).split('\n'),
              });
              process.exit(1);
            } else {
              if (data) {
                if (data.controllers) {
                  for (let i = 0; i < data.controllers.length; i++) {
                    ((config as ServalConfig).controllers as Controller[]).push(
                      data.controllers[i],
                    );
                  }
                }
                if (data.middleware) {
                  for (let i = 0; i < data.middleware.length; i++) {
                    ((config as ServalConfig).middleware as Middleware[]).push(
                      data.middleware[i],
                    );
                  }
                }
              }
              if (modules.length > 1) {
                logger.info(
                  'loadModule',
                  `    Done in: ${(Date.now() - timeOffset) / 1000}s`,
                );
              }
              loadNextModule();
            }
          },
        });
      } catch (error) {
        const e = error as Error;
        logger.error(`loadModule`, {
          name: module.name,
          error: ('' + e.stack).split('\n'),
        });
        process.exit(1);
      }
    }
  }

  async function init() {
    if (!config.middleware) {
      config.middleware = [];
    }
    if (!config.controllers) {
      config.controllers = [];
    }
    await initializeMiddleware(config.middleware);
    await initializeControllers(config.controllers);
  }

  modules.push(
    {
      name: 'Serval Initialize',
      initialize({ next }) {
        init()
          .then(() => next())
          .catch((err) => next(err));
      },
    },
    {
      name: 'Start Server',
      initialize({ next, name }) {
        try {
          logger.info(name, 'working...');
          fastify.listen(config.server, () => {
            if (!config.logs || !config.logs.silentLogger) {
              // eslint-disable-next-line no-console
              console.log(`
              ${ConsoleColors.FgMagenta}Serval${ConsoleColors.Reset} - ${
                ConsoleColors.FgGreen
              }Started Successfully${ConsoleColors.Reset}
              -------------------------------------             
              PORT: ${config.server.port}
              PID: ${process.pid}
              TTS: ${(Date.now() - rootTimeOffset) / 1000}s
              \n`);
            }
            if (config.onReady) {
              config.onReady({
                fastify,
                config,
              });
            }
            next();
          });
        } catch (error) {
          next(error as Error);
        }
      },
    },
  );

  const self: Serval = {
    config,
    fastify,
  };
  loadNextModule();
  return self;
}
