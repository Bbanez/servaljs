# ServalJS

<img src="https://i.imgur.com/THy9VEx.png" width="200" height="200" />

[![NPM Version][npm-image]][npm-url]

[npm-image]: https://img.shields.io/npm/v/servaljs.svg
[npm-url]: https://npmjs.org/package/servaljs

## Introduction

ServalJS is not a framework but rather a utility set for [FastifyJS](https://fastify.dev/https://expressjs.com/), written in [TypeScript](https://www.typescriptlang.org/). It was developed to provide more structured and organized code on the backend.

## Table of contents

- [Installation](#installation)
- [Creating Serval application](#creating-serval-application)
- [Controller](#controller)
  - [Controller setup](#controller-setup)
  - [Pre request handler](#pre-request-handler)
- [Middleware](#middleware)
- [Modules](#modules)

## Installation

```sh
npm i --save fastify servaljs @fastify/middie
```

## Creating Serval application

To create Fastify application powered by Serval tool set, `createServal` function is used. This is also the main entry point for the application which is used to configure it. Application configuration is pretty simple. There are 4 important properties in configuration object (see Snippet 1):

- `server.port` - Specify the port on which Express server will be available,
- `controllers` - Array of controller objects which will be mounted in order,
- `middleware` - Array of middleware object which will be mounted in order,
- `modules` - Array of module objects which will be mounted in order,

```ts
const app = createServal({
  server: {
    port: 7000,
  },
  modules: [
    /* List of modules */
  ],
  controllers: [
    /* List of controllers */
  ],
  middleware: [
    /* Middleware list */
  ],
});
```

_Snippet 1 - Create a Serval application._

This will be explained in more detail.

- First step is mounting [modules](#modules). They are mounded in FIFO order and once 1 module is mounted, it will trigger a callback which will mount the next module, and so on.
- Next step is mounting [middleware](#middleware) objects.
- In next step, all [controller](#controller) objects will be mounted in FIFO order.
- With all above steps completed successfully, `onReady` function will be called, HTTP server will be started and it will print message like one shown below:

```text
Serval - Started Successfully
-------------------------------------
PORT: 1280
PID: 24720
TTS: 0.007s
```

## Controller

Most important tools for creating REST APIs are tools for connecting HTTP
requests with some business logic, doing a required work and creating a
response. This is as easy as creating an HTTP route handler for specified
method. In pure Fastify application this could be done like shown in Snippet 2.

```ts
fastify.get('/user', (request, replay) => {
  // Get user from the database
  // ...
  return user;
});
```

_Snippet 2 - Creating an endpoint using Fastify_

This is all very nice but writing a code this way can be messy and organizing it can be a challenge. Because of this, abstracts like Controller, Controller method and Middleware exist in the Serval tool set. In this section, Controller abstract will be covered.

Controller is an abstraction which provides clean and unified way for creating a group of REST endpoints. Controller object is created by calling `createController` function which accepts configuration object as an argument. Controller by itself if just a _"placeholder"_ and does not hold any complex logic. To implement a logic, and to add REST endpoints, Controller method is used.

By using the Serval Controller approach, code from Snippet 2 can be rewritten like shown in Snippet 3.

```ts
const UserController = createController({
  name: 'User',
  path: '/user',
  methods() {
    return {
      getUser: createControllerMethod<void, User>({
        type: 'get',
        async handler() {
          // Get user from the database
          // ...
          return user;
        },
      }),
    };
  },
});
```

_Snippet 3 - Create an endpoint using the Serval controller/method approach._

Much more code is written in Snippet 3 compared to 2, so why is this better? Second example provides structure, consistency (which is not easy to spot on such a short example) and unified way to create REST endpoints. This means that navigation in project is much quicker, and it is easier to understand what is the end result of each endpoint. In addition to that, return type of the method can be specified.

### Pre request handler

It is a method inside of a Controller Method configuration object. It is executed before each required to specified route and output from it is piped to handler method. For example, you can create a pre request handler which will convert a first letter of a request parameter in upper-case like shown in Snippet 5.

```ts
const MyController = createController<{ baseMessage: string }>({
  name: 'My controller',
  path: '/hello',
  methods() {
    return {
      world: createControllerMethod<{ name: string }, { message: string }>({
        path: '/:name',
        type: 'get',
        async preRequestHandler({ request }) {
          const params = request.params as { name: string };
          return {
            name:
              params.name.substring(0, 1).toUpperCase +
              params.name.substring(1).toLowerCase(),
          };
        },
        async handler({ name }) {
          return {
            message: `Hello ${name}!`,
          };
        },
      }),
    };
  },
});
```

_Snippet 4 - Controller method pre request handler_

Again, example from Snippet 4 is trivial but it illustrates how pre request handler is used. As it can be seen, pre request handler functions like a [middleware](#middleware) but only for specific route. It is useful when different routes use different mechanisms for security and resource protection.

## Middleware

Middleware is similar to a controller, but it is usually used to transform incoming or outgoing data in some shape or form. Because of this, middleware is triggered for all methods on all routes which are starting with a specified path.

Like the `createController` function, `createMiddleware` function returns the
_Middleware_ object which is used in the Serval configuration object in the
middleware array property. Example for creating a middleware object is shown in
Snippet 6.

```ts
createMiddleware({
  name: 'Test middleware',
  path: '/test',
  handler() {
    return async () => {
      // Middleware logic.
    };
  },
});
```

_Snippet 5 - Creating a simple middleware object._

It is important to know that handler method can be asynchronous and will be called only once when the middleware is mounted. So before returning a request handler function, setup of the middleware can be done.

## Modules

Module is the core abstract in the Serval which allows external code to
access the pipe. Modules are passed to the configuration object in `modules`
array.
