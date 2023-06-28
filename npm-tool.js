const { createFS } = require('@banez/fs');
const { createConfig } = require('@banez/npm-tool');
const { fileReplacer } = require('./file-replacer');

const fs = createFS({
  base: process.cwd(),
});

module.exports = createConfig({
  bundle: {
    extend: [
      {
        title: 'Remove build info',
        task: async () => {
          await fs.deleteFile(['dist', 'tsconfig.tsbuildinfo']);
        },
      },
      {
        title: 'Remove tests',
        task: async () => {
          await fs.deleteDir(['dist', 'test']);
        },
      },
      {
        title: 'Fix imports',
        task: async () => {
          await fileReplacer({
            basePath: '',
            dirPath: ['dist'],
            regex: [/servaljs\//g],
            endsWith: ['.js', '.d.ts'],
          });
        },
      },
    ],
  },
});
