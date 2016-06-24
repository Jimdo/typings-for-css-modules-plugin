import {
  removeLoadersBeforeCssLoader,
  filterCssModules,
  extractCssModuleFromSource,
} from './cssModuleHelper';
import {
  generateInterface,
  filenameToTypingsFilename,
} from './cssModuleToInterface';
import persistToFile from './persist';



export default class TypingsForCssModulesPlugin {
  constructor (options = {}) {
    this.verbose = options.verbose;
    this.moduleCache = {};
  }

  log (msg) {
    if (this.verbose) {
      console.log(msg); // esl
    }
  }

  logError (...msg) {
    console.error(...msg);
  }

  rebuildModule (compilation, mod) {
    return new Promise(function rebuildPromise(resolve, reject) {
      compilation.rebuildModule(mod, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  wasModuleUpdated (cssModule) {
    // if we know this module already and the hash did not change ignore it
    if (this.moduleCache[cssModule.resource]) {
      // the same resource may be loaded multiple times
      // we only want to extract it once however so filter out on a first come first serve basis
      if (this.moduleCache[cssModule.resource].id !== cssModule.id) {
        this.log(`TypingsForCssModulesPlugin - Module ID: [${cssModule.id}] ignored. Module with id [${this.moduleCache[cssModule.resource].id}] is requiring this file already. Skipping...`);
        return false;
      }

      // check if something in the module actually changed
      if (this.moduleCache[cssModule.resource].hash === cssModule.getSourceHash()) {
        this.log(`TypingsForCssModulesPlugin - [${cssModule.resource}] did not change. Skipping...`);
        return false;
      }
    }
    return true;
  }

  filterTaintedCssModule (cssModules) {
    return cssModules.filter((cssModule)=> this.wasModuleUpdated(cssModule));
  }

  retrieveCssModuleDefinitions (compilation, cssModule) {
    const oldLoaders = cssModule.loaders;
    const newLoaders = removeLoadersBeforeCssLoader(oldLoaders);
    // we need the output of the css loader so we need to rerender this module
    // but remove all loaders till the css-loader before in order to get the desired output
    cssModule.loaders = newLoaders;
    return this.rebuildModule(compilation, cssModule).then(() => {
      const cssModuleSource = extractCssModuleFromSource(cssModule._source.source());
      const cssModuleDefinition = {
        resource: cssModule.resource,
        id: cssModule.id,
        definition: cssModuleSource,
      };
      this.log(`TypingsForCssModulesPlugin - extracted definition for ${cssModule.resource}`);
      cssModule.loaders = oldLoaders;
      return this.rebuildModule(compilation, cssModule)
        .then(() => {
          cssModuleDefinition.hash = cssModule.getSourceHash();
          // return result for further computation
          return cssModuleDefinition;
        })
        .catch((err) => {
          this.logError(
            `TypingsForCssModulesPlugin - [${cssModule.resource}] failed to rerender Module. Your output might be broken - consider retriggering webpack.`
            , err
          );
        });
    }, (err) => {
      this.logError(
        `TypingsForCssModulesPlugin - [${cssModule.resource}] failed to extract CSS Module Definitions. Skip typing extraction - trying to commence...`,
        err
      );
    });
  }

  apply(compiler) {
    compiler.plugin('after-compile', (compilation, callback) => {
      // only get modules that are loaded via css loader
      const cssModules = filterCssModules(compilation.modules);
      // if no module is found, skip it
      if (cssModules.length === 0) {
        this.log('TypingsForCssModulesPlugin - No CSS Module found. Skip typings extraction...');
        return callback();
      }

      // only take css modules that were touched and need rerendering
      const taintedCssModules = this.filterTaintedCssModule(cssModules, this.moduleCache);
      // if no module is found, skip it
      if (taintedCssModules.length === 0) {
        this.log('TypingsForCssModulesPlugin - No CSS Module was changed. Skip typings extraction...');
        return callback();
      }

      Promise
        .all(taintedCssModules
          .map((taintedCssModule)=> this.retrieveCssModuleDefinitions(compilation, taintedCssModule)))
        .then((cssModuleResponses) => {
          this.log('TypingsForCssModulesPlugin - extracted all typings. Proceeding to asset writing stage...');
          if (cssModuleResponses.length === 0) {
            this.log('TypingsForCssModulesPlugin - No CSS Module was changed. Skip writing typings file...');
            return callback();
          }
          Promise
            .all(cssModuleResponses.map((cssModuleResponse) => {
              const {
                resource,
                definition,
                id,
                hash,
              } = cssModuleResponse;
              const typingsFilename = filenameToTypingsFilename(resource);
              const typingsContent = generateInterface(definition);
              return persistToFile(typingsFilename, typingsContent).then((typingsFilename) => {
                this.log(`TypingsForCssModulesPlugin - write definition for ${cssModuleResponse.resource} to ${typingsFilename}`);
                this.moduleCache[resource] = {
                  id: id,
                  hash: hash,
                };
              });
            }))
            .then(() => {
              this.log('TypingsForCssModulesPlugin - all typings updated');
              callback();
            }, (err) => {
              this.logError('TypingsForCssModulesPlugin - failed to write all typings', err);
              callback();
            });
        }, (err) => {
          this.logError('TypingsForCssModulesPlugin - something went wrong during the extraction phase. Proceeding to asset writing stage...', err);
          callback();
        });
    });
  }
}
