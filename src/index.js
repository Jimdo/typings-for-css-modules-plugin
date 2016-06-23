'use strict';
var vm = require('vm');
var path = require('path');
var fs = require('graceful-fs');

function rebuildModule (compilation, mod) {
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

function isCssModule (module) {
    var extname = path.extname(module.request);
    return /\/css-loader\//.test(module.request) && extname !== '.js';
}

function filterCssModules(modules) {
    return modules.filter(isCssModule);
}

var isCssModuleTainted = (moduleCache)=> (cssModule) => {
    // if we know this module already and the hash did not change ignore it
    if (moduleCache[cssModule.resource]) {
        // the same resource may be loaded multiple times
        // we only want to extract it once however so filter out on a first come first serve basis
        if (moduleCache[cssModule.resource].id !== cssModule.id) {
            if (this.verbose) {
                console.log(`TypingsForCssModulesPlugin - Module ID: [${cssModule.id}] ignored. Module with id [${moduleCache[cssModule.resource].id}] is requiring this file already. Skipping...`);
            }
            return false;
        }
        
        // check if something in the module actually changed
        if (moduleCache[cssModule.resource].hash === cssModule.getSourceHash()) {
            if (this.verbose) {
                console.log(`TypingsForCssModulesPlugin - [${cssModule.resource}] did not change. Skipping...`);
            }
            return false;
        }
    } 
    return true;
};

function filterTaintedCssModule (cssModules, moduleCache) {
    return cssModules.filter(isCssModuleTainted(moduleCache));
}

function cleanLoadersTillCssLoader (loaders) {
    var validLoaders = loaders.concat([]);
    while (validLoaders.length && validLoaders[0].indexOf('/css-loader/') === -1) {
        validLoaders.shift();
    }
    return validLoaders;  
}

function extractCssModuleDefinitionFromRawSource (source) {
    var sandbox = {
        exports: null,
        module: {},
        require: () => () => []
    };
    var script = new vm.Script(source);
    var context = new vm.createContext(sandbox);
    script.runInContext(context);
    return sandbox.exports.locals;
}

var retrieveCssModuleDefinitions = (compilation) => (cssModule) => {
    var oldLoaders = cssModule.loaders;
    var newLoaders = cleanLoadersTillCssLoader(oldLoaders);
    // we need the output of the css loader so we need to rerender this module
    // but remove all loaders till the css-loader before in order to get the desired output
    cssModule.loaders = newLoaders;
    return rebuildModule(compilation, cssModule).then(() => {
        var cssModuleDefinition = extractCssModuleDefinitionFromRawSource(cssModule._source.source());
        var cssModuleDefinition = {
            resource: cssModule.resource,
            id: cssModule.id,
            definition: cssModuleDefinition
        };
        if (this.verbose) {
            console.log(`TypingsForCssModulesPlugin - extracted definition for ${cssModule.resource}`);
        }
        cssModule.loaders = oldLoaders;
        return rebuildModule(compilation, cssModule)
        .then(() => {
            cssModuleDefinition.hash = cssModule.getSourceHash();
            // return result for further computation
            return cssModuleDefinition;
        })
        .catch((err) => {
            if (err) {
                console.error(`TypingsForCssModulesPlugin - [${cssModule.resource}] failed to rerender Module. Your output might be broken - consider retriggering webpack.`);
                console.error('error: ', err);
            }
        });
    }, (err)=> {
        if (err) {
            console.error(`TypingsForCssModulesPlugin - [${cssModule.resource}] failed to extract CSS Module Definitions. Skip typing extraction - trying to commence...`);
            console.error('error: ', err);
        }
    });
}

function writeToFile (filename, content) {
    return new Promise((resolve, reject) => {
        fs.writeFile(filename, content, (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

function writeCssModulesToFile(cssModuleDefinition) {
    var resource = cssModuleDefinition.resource;
    var definition = cssModuleDefinition.definition;

    var dirName = path.dirname(resource);
    var baseName = path.basename(resource);
    var filename = path.join(dirName, `${baseName}.d.ts`);
    console.log(filename, baseName);
    var interfaceName = filenameToInterfaceName(baseName);
    var fileContent = cssModuleToTypescriptInterface(interfaceName, definition);
    return writeToFile(filename, fileContent).then(() => {
        return filename;
    });
}

function TypingsForCssModulesPlugin (options) {
    options = options || {};
    this.verbose = options.verbose;
    this.moduleCache = {};
}

function filenameToInterfaceName(filename) {
    return filename
        .replace(/^(\w)/, function (_, c){ return 'I' + c.toUpperCase()})
        .replace(/\.(\w)/, function (_, c){ return c.toUpperCase()})
}
function cssModuleToTypescriptInterfaceProperties (cssModule) {
    return Object.keys(cssModule)
        .map((key)=> `  '${key}': string;`)
        .join('\n');
}

function cssModuleToTypescriptInterface (name, cssModule) {
    return (
`export interface ${name} {
${cssModuleToTypescriptInterfaceProperties(cssModule)}
}
declare var styles: ${name};

export default styles;
`
);
}

TypingsForCssModulesPlugin.prototype.apply = function (compiler) {
    compiler.plugin('after-compile', (compilation, callback) => {
        // only get modules that are loaded via css loader
        var cssModules = filterCssModules(compilation.modules);
        // if no module is found, skip it
        if (cssModules.length === 0) {
            if (this.verbose) {
                console.log(`TypingsForCssModulesPlugin - No CSS Module found. Skip typings extraction...`);
            }
            return callback();
        }

        // only take css modules that were touched and need rerendering
        var taintedCssModules = filterTaintedCssModule(cssModules, this.moduleCache);
        // if no module is found, skip it
        if (taintedCssModules.length === 0) {
            if (this.verbose) {
                console.log(`TypingsForCssModulesPlugin - No CSS Module was changed. Skip typings extraction...`);
            }
            return callback();
        }
        
        Promise
        .all(taintedCssModules
        .map(retrieveCssModuleDefinitions(compilation)))
        .then((cssModuleResponses)=> {
            if (this.verbose) {
                console.log(`TypingsForCssModulesPlugin - extracted all typings. Proceeding to asset writing stage...`);
            }
            if (cssModuleResponses.length === 0) {
                if (this.verbose) {
                    console.log(`TypingsForCssModulesPlugin - No CSS Module was changed. Skip writing typings file...`);
                }
                return callback();
            }
            Promise
            .all(cssModuleResponses.map((cssModuleResponse)=> {
                return writeCssModulesToFile(cssModuleResponse).then((filename) => {
                    if (this.verbose) {
                        console.log(`TypingsForCssModulesPlugin - write definition for ${cssModuleResponse.resource} to ${filename}`);
                    }
                    this.moduleCache[cssModuleResponse.resource] = {
                        id: cssModuleResponse.id,
                        hash: cssModuleResponse.hash
                    };
                })
            }))
            .then(() => {
                if (this.verbose) {
                    console.log(`TypingsForCssModulesPlugin - all typings updated`);
                }
                callback();
            }, (error) => {
                console.error(`TypingsForCssModulesPlugin - failed to write all typings`);
                console.error('error', error);
                callback();
            });
        }, (err)=> {
            console.error(`TypingsForCssModulesPlugin - something went wrong during the extraction phase. Proceeding to asset writing stage...`);
            console.error('error: ', err);
            callback();
        });
    });
};

module.exports = TypingsForCssModulesPlugin;