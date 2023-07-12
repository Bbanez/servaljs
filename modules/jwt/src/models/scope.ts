import type { ObjectSchema } from '@banez/object-utility/types';
import type { JWTAlgorithm } from './header';

export interface JWTScope {
  secret: string;
  expIn: number;
  issuer: string;
  alg: JWTAlgorithm;
}

export const JWTScopeSchema: ObjectSchema = {
  secret: {
    __type: 'string',
    __required: true,
  },
  expIn: {
    __type: 'number',
    __required: true,
  },
  issuer: {
    __type: 'string',
    __required: true,
  },
  alg: {
    __type: 'string',
    __required: true,
    __validate(value: string): boolean {
      return ['HS256'].includes(value);
    },
  },
};
