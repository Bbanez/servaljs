import type { FastifyInstance } from 'fastify';
import type { ServalConfig } from './main';
import type { Controller, Middleware } from './rest';

export interface ModuleConfig {
  name: string;
  rootConfig: ServalConfig;
  fastify: FastifyInstance;
  next(
    error?: Error,
    data?: {
      controllers?: Controller[];
      middleware?: Middleware[];
    },
  ): void;
}
export interface Module {
  name: string;
  initialize(config: ModuleConfig): void;
}
