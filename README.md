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

#### `verbose`

If set to true it will log to console during webpack compilations. Defaults to `false`.
```
  new TypingsPlugin({
    verbose: true
  });
```

#### `indent`

Specify the `indent` used in the generated typings files. Defaults to `  ` (2 spaces).
```
  new TypingsPlugin({
    indent: '    '
  });
```

## Support

As the Plugin just hooks into the webpack compilation process it can handle all kind of css preprocessors (`sass`, `scss`, `stylus`, `less`, ...).
The only requirement is that those preprocessors have proper webpack loaders defined - meaning they can already be loaded by webpack anyways.

## Requirements

The current state of the Plugin expects you to load your CSS Modules via `css-loader` (https://github.com/webpack/css-loader).

## Known issues

 - As the Plugin hooks into the compilation process of Webpack the intial build may yield `ts-lint` errors. A simple restart of Webpack should fix this problem!
 - As the Plugin writes to disk Webpack gets notified of changes. This means it will probably retrigger a build immediatelly after finishing the first time. To prevent this you can add the generated typing files to an `ignore-list` for Webpack.
