import type { ObjectSchema } from '@banez/object-utility/types';
import { JWTHeader, JWTHeaderSchema } from './header';
import { JWTPayload, JWTPayloadSchema } from './payload';

export interface JWT<PayloadProps = undefined> {
  header: JWTHeader;
  payload: JWTPayload<PayloadProps>;
  signature: string;
}

export const JWTSchema: ObjectSchema = {
  header: {
    __type: 'object',
    __required: true,
    __child: JWTHeaderSchema,
  },
  payload: {
    __type: 'object',
    __required: true,
    __child: JWTPayloadSchema,
  },
};
