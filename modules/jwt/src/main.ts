import type { Module } from 'servaljs';
import { JWTManager } from './manager';
import type { JWTScope } from './models';

export interface JWTConfig {
  scopes: JWTScope[];
}

export function createJwt(config: JWTConfig): Module {
  return {
    name: 'JWT',
    initialize({ next }) {
      JWTManager.setScopes(config.scopes);
      next();
    },
  };
}
