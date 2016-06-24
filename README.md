# typings-for-css-modules-plugin

Webpack Plugin that generates TypeScript typings for CSS modules

## Installation

Install via npm `npm install --save-dev typings-for-css-modules-plugin`

## Usage

Add to Plugins in your `webpack.config`

e.g.
```js
import TypingsPlugin from 'typings-for-css-modules-plugin';

webpackConfig.plugins = [
  new TypingsPlugin({
    verbose: false
  });
]
```

### Options

The Plugin accepts one parameter - an `options`-Object.
Currently this object is checked for one key: `verbose`. If set to true it will log to console during webpack compilations.

### Requirements

The current state of the Plugin expects you to load your CSS Modules via `css-loader` (https://github.com/webpack/css-loader).

### Known issues

As the Plugin hooks into the compilation process of webpack the intial build may yield `ts-lint` errors. A simple restart of your webpack service will fix this problem!
