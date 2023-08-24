# ServalJS JWT module

This module provides a simple and easy way to implement JWT security in the App.

## Usage

```ts
import {
  createController,
  createControllerMethod,
  createServal,
  HttpStatus,
} from 'servaljs';
import { JWTEncode } from './encode';
import { JWTError } from './error';
import { createJwt } from './main';
import { JWTManager } from './manager';
import {
  createJwtPreRequestHandler,
  JwtPreRequestHandlerResult,
} from './pre-request-handler';

createServal({
  server: {
    port: 1280,
  },
  modules: [
    createJwt({
      scopes: [
        {
          // Algorithm
          alg: 'HS256',
          // For how long will JWT be wail
          expIn: 60000,
          // Who created a JWT
          issuer: 'localhost',
          // Secret for HMAC
          secret: 'secret',
        },
      ],
    }),
  ],
  controllers: [
    createController({
      name: 'TestJwt',
      path: '/test',
      methods() {
        return {
          public: createControllerMethod<void, { message: string }>({
            path: '/public',
            type: 'get',
            async handler() {
              return { message: 'This route is not protected' };
            },
          }),

          login: createControllerMethod<void, { token: string }>({
            path: '/login',
            type: 'post',
            async handler({ request, errorHandler }) {
              // Check if user if valid
              const user = await MyDBRequest(request.headers.authorization);
              const token = JWTManager.create<{ email: string }>({
                /**
                 * Who is issuing the JWT. This value must be
                 * one of the scopes defined in `createJwt(...)`
                 */
                issuer: 'localhost',
                // What are users roles
                roles: user.roles,
                // What is user ID
                userId: user._id,
                // Custom JWT properties
                props: {
                  email: user.email,
                },
              });
              if (token instanceof JWTError) {
                throw errorHandler(
                  HttpStatus.InternalServerError,
                  'Failed to create access token.',
                );
              }
              return { token: JWTEncode.encode(token) };
            },
          }),

          protected: createControllerMethod<
            JwtPreRequestHandlerResult,
            { message: string }
          >({
            path: '/protected',
            type: 'get',
            preRequestHandler: createJwtPreRequestHandler({
              roles: ['USER'],
            }),
            async handler({ token }) {
              // This is a users JWT
              console.log(token);
              return { message: 'This is protected resource.' };
            },
          }),
        };
      },
    }),
  ],
});
```
