import TypingsCssModulePlugin from '../src/';

module.exports = {
  entry: './test/entry.ts',
  output: {
    path: __dirname,
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      { test: /\.ts$/, loaders: ['babel', 'ts'] },
      { test: /\.css$/, loader: 'css?modules' }
    ]
  },
  plugins: [new TypingsCssModulePlugin()]
};
