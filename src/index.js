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

  async rebuildModule (compilation, mod) {
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
    // if we dont know this module already return true
    if (!this.moduleCache[cssModule.resource]) {
      return true;
    }

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

    return true;
  }

  filterDirtyCssModule (cssModules) {
    return cssModules.filter((cssModule)=> this.wasModuleUpdated(cssModule));
  }

  async extractCssModuleDefintion (cssModule, compilation) {
    const oldLoaders = cssModule.loaders;
    const newLoaders = removeLoadersBeforeCssLoader(oldLoaders);
    // we need the output of the css loader so we need to rerender this module
    // but remove all loaders till the css-loader before in order to get the desired output
    cssModule.loaders = newLoaders;
    try {
      await this.rebuildModule(compilation, cssModule);
    } catch (err) {
      this.logError(
        `TypingsForCssModulesPlugin - [${cssModule.resource}] failed to extract CSS Module Definitions. Skip typing extraction - trying to commence...`,
        err
      );
      return;
    }

    const cssModuleRules = extractCssModuleFromSource(cssModule._source.source());
    const cssModuleDefinition = {
      resource: cssModule.resource,
      id: cssModule.id,
      rules: cssModuleRules,
    };
    this.log(`TypingsForCssModulesPlugin - extracted definition for ${cssModule.resource}`);

    cssModule.loaders = oldLoaders;
    try {
      await this.rebuildModule(compilation, cssModule);
    } catch (err) {
      this.logError(
        `TypingsForCssModulesPlugin - [${cssModule.resource}] failed to rerender Module. Your output might be broken - consider retriggering webpack.`
        , err
      );
    }

    // we have to take the `original` hash of the file when its rendered with all loaders attached
    cssModuleDefinition.hash = cssModule.getSourceHash();

    return cssModuleDefinition;
  }

  async retrieveCssModulesDefinitions (cssModules, compilation) {
    return Promise.all(cssModules.map(async (cssModule)=>  {
      return await this.extractCssModuleDefintion(cssModule, compilation);
    }));
  }

  async writeTypingsToFile (typingsFilename, typingsContent) {
    await persistToFile(typingsFilename, typingsContent);
  }

  cacheCssModule (cssModuleDefinition) {
    const {
      resource,
      id,
      hash,
    } = cssModuleDefinition;
    this.moduleCache[resource] = {
      id: id,
      hash: hash,
    };
  }

  async persistCssModules (cssModuleDefinitions) {
    return Promise.all(cssModuleDefinitions.map(async (cssModuleDefinition) => {
      const {
        resource,
        rules,
      } = cssModuleDefinition;
      const typingsFilename = filenameToTypingsFilename(resource);
      const typingsContent = generateInterface(rules, resource);
      try {
        await this.writeTypingsToFile(typingsFilename, typingsContent);
      } catch (err) {
        this.logError(
          `TypingsForCssModulesPlugin - failed write typings to ${typingsFilename}`,
          err
        );
      }
      this.log(`TypingsForCssModulesPlugin - wrote definition for ${resource} to ${typingsFilename}`);
      this.cacheCssModule(cssModuleDefinition);
    }));
  }

  apply (compiler) {
    compiler.plugin('after-compile', async (compilation, callback) => {
      // only get modules that are loaded via css loader
      const cssModules = filterCssModules(compilation.modules);
      // if no module is found, skip it
      if (cssModules.length === 0) {
        this.log('TypingsForCssModulesPlugin - No CSS Module found. Skip typings extraction...');
        return callback();
      }

      // only take css modules that were touched and need rerendering
      const dirtyCssModules = this.filterDirtyCssModule(cssModules, this.moduleCache);
      // if no module is found, skip it
      if (dirtyCssModules.length === 0) {
        this.log('TypingsForCssModulesPlugin - No CSS Module was changed. Skip typings extraction...');
        return callback();
      }

      let cssModuleDefinitions;
      try {
        cssModuleDefinitions = await this.retrieveCssModulesDefinitions(dirtyCssModules, compilation);
      } catch (err) {
        this.logError('TypingsForCssModulesPlugin - something went wrong during the extraction phase. Proceeding to asset writing stage...', err);
        return callback();
      }

      this.log('TypingsForCssModulesPlugin - extracted all typings. Proceeding to asset writing stage...');

      try {
        await this.persistCssModules(cssModuleDefinitions);
        this.log('TypingsForCssModulesPlugin - all typings updated');
      } catch (err) {
        this.logError('TypingsForCssModulesPlugin - failed to write all typings', err);
      } finally {
        callback();
      }
    });
  }
}
