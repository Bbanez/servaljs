import { ControllerMethodPreRequestHandler, HttpStatus } from 'servaljs';
import { JWTError } from './error';
import { JWTManager } from './manager';
import type { JWT } from './models';

export interface JwtPreRequestHandlerResult<Props = unknown> {
  token: JWT<Props>;
}

export function createJwtPreRequestHandler<Props = unknown>(config: {
  roles: string[];
}): ControllerMethodPreRequestHandler<JwtPreRequestHandlerResult<Props>> {
  return async ({ errorHandler, request }) => {
    const token = JWTManager.get<Props>({
      token: request.headers.authorization || '',
      roles: config.roles,
    });
    if (token instanceof JWTError) {
      throw errorHandler(HttpStatus.Forbidden, token.message);
    }
    return { token };
  };
}
