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

## Example

Imagine you have a file `~/my-project/src/component/MyComponent/component.scss` in your project with the following content:
```
.some-class {
  // some styles
  &.someOtherClass {
    // some other styles
  }
  &-sayWhat {
    // more styles
  }
}
```

Adding the `typings-for-css-modules-plugin` will generate a file `~/my-project/src/component/MyComponent/mycomponent.scss.d.ts` that has the following content:
```
export interface IMyComponentScss {
  'some-class': string;
  'someOtherClass': string;
  'some-class-sayWhat': string;
}
declare const styles: IMyComponentScss;

export default styles;
```

### Example in Visual Studio Code
![typed-css-modules](https://cloud.githubusercontent.com/assets/749171/16340497/c1cb6888-3a28-11e6-919b-f2f51a282bba.gif)

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
