import {
  createHttpErrorHandler,
  type HttpErrorHandler,
} from 'servaljs/http-error';
import { Logger } from 'servaljs/logger';
import type { ServalConfig } from 'servaljs/main';
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteShorthandOptions,
} from 'fastify';

/**
 * HTTP method type.
 */
export type ControllerMethodType = 'get' | 'post' | 'put' | 'delete' | 'head';

/**
 * Object returned from the `createControllerMethod` function.
 */
export interface ControllerMethod {
  name: string;
  type: ControllerMethodType;
  path: string;
  fastifyRouteOptions: RouteShorthandOptions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (request: FastifyRequest, replay: FastifyReply) => Promise<any>;
}

/**
 * Configuration object for creating a controller method.
 */
export interface ControllerMethodConfig<
  PreRequestHandlerResult = unknown,
  ReturnType = unknown,
> {
  options?: RouteShorthandOptions;
  /**
   * Type of the HTTP request which will be handled by this controller method.
   */
  type: ControllerMethodType;
  path?: string;
  /**
   * Method which will be called before `handler` method on each request.
   * Output from `preRequestHandler` method is available in `handler` method.
   */
  preRequestHandler?: ControllerMethodPreRequestHandler<PreRequestHandlerResult>;
  /**
   * Method which holds a business logic for specified REST endpoint. It is
   * recommended not to use Express Response object (which is available as
   * a parameter) directly but to return an object which will be converted
   * into JSON response.
   *
   * If there is a need to return a file from the `handler`, there are 2
   * options:
   *
   * - File can be sent in a response by return a Buffer from the `handler`
   * method.
   * - Returning an object with `__file` property of type string which
   * holds the absolute path to the file. This option is more efficient
   * then returning a Buffer because it uses response stream.
   */
  handler: ControllerMethodRequestHandler<PreRequestHandlerResult, ReturnType>;
}

export type ControllerMethodPreRequestHandlerData = {
  /**
   * Name of the method
   */
  name: string;
  /**
   * Controller logger
   */
  logger: Logger;
  /**
   * HTTP error handler. You can use it to throw controlled
   * exceptions.
   */
  errorHandler: HttpErrorHandler;
  /**
   * Fastify request
   */
  request: FastifyRequest;
  /**
   * Fastify response. It is recommended not to use this object
   * directly.
   */
  replay: FastifyReply;
};

export type ControllerMethodPreRequestHandler<
  PreRequestHandlerResult = unknown,
> = (
  data: ControllerMethodPreRequestHandlerData,
) => Promise<PreRequestHandlerResult>;

export type ControllerMethodRequestHandlerData = {
  /**
   * Name of the method
   */
  name: string;
  /**
   * Fastify request
   */
  request: FastifyRequest;
  /**
   * Fastify response. It is recommended not to use this object
   * directly.
   */
  replay: FastifyReply;
  /**
   * Controller logger
   */
  logger: Logger;
  /**
   * HTTP error handler. You can use it to throw controlled
   * exceptions.
   */
  errorHandler: HttpErrorHandler;
};

export type ControllerMethodRequestHandler<
  PreRequestHandlerResult = unknown,
  ReturnType = unknown,
> = (
  data: ControllerMethodRequestHandlerData & PreRequestHandlerResult,
) => Promise<ReturnType>;

export interface ControllerMethods {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [name: string]: ControllerMethodConfig<any, any>;
}

export interface ControllerConfig {
  /**
   * Name of the controller. Used for generated logger
   * and to organize errors.
   */
  name: string;
  /**
   * Path of the controller. This path will be prefixed to all
   * methods in a controller.
   *
   * For example: `/my/controller`
   * Or: `/my/controller/:slug`
   */
  path: string;
  /**
   * Method which returns a map of controller methods. This method is
   * called after `setup` method, and output from it is passed as a
   * parameter.
   */
  methods(): Promise<ControllerMethods> | ControllerMethods;
}

export type Controller = (data: {
  config: ServalConfig;
  fastify: FastifyInstance;
}) => Promise<ControllerData>;

export interface ControllerData {
  /**
   * Name of the controller. Used for generated logger
   * and to organize errors.
   */
  name: string;
  /**
   * Path of the controller name the same way as
   * Express route.
   *
   * For example: /my/controller
   * Or: /my/controller/:slug
   */
  path: string;
  logger: Logger;
  methods(): Promise<ControllerMethod[]> | ControllerMethod[];
}

/**
 * Function which creates a Controller method object. This function is mant to
 * be used in a Controller object.
 */
export function createControllerMethod<
  PreRequestHandlerReturnType = unknown,
  ReturnType = unknown,
>(config: ControllerMethodConfig<PreRequestHandlerReturnType, ReturnType>) {
  return config;
}

function wrapControllerMethod<
  PreRequestHandlerResult = unknown,
  ReturnType = unknown,
>(
  _controller: ControllerConfig,
  path: string,
  logger: Logger,
  methodName: string,
  config: ControllerMethodConfig<PreRequestHandlerResult, ReturnType>,
): ControllerMethod {
  const name = methodName;
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  const errorHandler = createHttpErrorHandler({
    place: name ? name : path,
    logger,
  });
  // const fullPath = controller.path + path;

  return {
    name,
    type: config.type,
    path,
    fastifyRouteOptions: config.options || {},
    handler: async (request, replay) => {
      let preRequestHandlerResult: PreRequestHandlerResult = {} as never;
      if (config.preRequestHandler) {
        preRequestHandlerResult = await config.preRequestHandler({
          logger,
          errorHandler,
          name,
          request,
          replay,
        });
      }
      return await config.handler({
        logger,
        errorHandler,
        request,
        replay,
        name,
        ...preRequestHandlerResult,
      });
    },
  };
}

/**
 * Function which create a Controller object. Output of this function is used
 * in `controllers` property of the `createServal` function
 * configuration.
 */
export function createController(config: ControllerConfig): Controller {
  return async () => {
    const logger = new Logger(config.name);
    if (!config.path.startsWith('/')) {
      config.path = '/' + config.path;
    }

    async function getMethods() {
      let configMethods = config.methods();
      if (configMethods instanceof Promise) {
        configMethods = await configMethods;
      }
      const methodNames = Object.keys(configMethods);
      const methods: ControllerMethod[] = [];
      for (let i = 0; i < methodNames.length; i++) {
        const methodName = methodNames[i];
        const method = configMethods[methodName];
        methods.push(
          wrapControllerMethod(
            config,
            method.path || '',
            logger,
            methodName,
            {
              type: method.type,
              preRequestHandler: method.preRequestHandler,
              handler: method.handler,
            },
          ),
        );
      }
      return methods;
    }

    return {
      name: config.name,
      path: config.path,
      methods: getMethods,
      logger,
    };
  };
}
