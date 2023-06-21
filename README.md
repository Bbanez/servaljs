# ServalJS

<img src="https://i.imgur.com/THy9VEx.png" width="200" height="200" />

[![NPM Version][npm-image]][npm-url]

## IN DEVELOPMENT

```ts
createServal({
  server: {
    port: 1280,
  },
  controllers: [
    createController({
      name: 'Hello world',
      path: '/hello',
      methods() {
        return {
          '/world': createControllerMethod<
            { test: string },
            { test: string; data: string }
          >({
            type: 'get',
            preRequestHandler: async () => {
              return {
                test: 'Test',
              };
            },
            async handler({ errorHandler }) {
              return {
                message: 'Hello world!',
              };
            },
          }),
        };
      },
    }),
  ],
});
```

[npm-image]: https://img.shields.io/npm/v/servaljs.svg
[npm-url]: https://npmjs.org/package/servaljs
