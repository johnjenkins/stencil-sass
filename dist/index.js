'use strict';

var sassEmbedded = require('sass-embedded');
var path = require('node:path');

/**
 * Generates a diagnostic as a result of an error originating from Sass.
 *
 * This function mutates the provided context by pushing the generated diagnostic to the context's collection of
 * diagnostics.
 *
 * @param context the compilation context that the plugin has access to
 * @param sassError the Sass error to create a diagnostic from
 * @param filePath the path of the file that led to an error being raised
 * @returns the created diagnostic, or `null` if one could not be generated
 */
function loadDiagnostic(context, sassError, filePath) {
    if (sassError == null || context == null) {
        return null;
    }
    const diagnostic = {
        level: 'error',
        type: 'css',
        language: 'scss',
        header: 'sass error',
        code: formatCode(sassError.status),
        relFilePath: null,
        absFilePath: null,
        messageText: formatMessage(sassError.message),
        lines: [],
    };
    if (typeof sassError.file === 'string' && sassError.file !== 'stdin') {
        filePath = sassError.file;
    }
    if (typeof filePath === 'string') {
        diagnostic.language = /(\.scss)$/i.test(filePath) ? 'scss' : 'sass';
        diagnostic.absFilePath = filePath;
        diagnostic.relFilePath = formatFileName(context.config.rootDir, diagnostic.absFilePath);
        const errorLineNumber = sassError.line;
        const errorLineIndex = errorLineNumber - 1;
        diagnostic.lineNumber = errorLineNumber;
        diagnostic.columnNumber = sassError.column;
        if (errorLineIndex > -1) {
            try {
                const sourceText = context.fs.readFileSync(diagnostic.absFilePath);
                const srcLines = sourceText.split(/\r?\n/);
                const errorLine = {
                    lineIndex: errorLineIndex,
                    lineNumber: errorLineNumber,
                    text: typeof srcLines[errorLineIndex] === 'string' ? srcLines[errorLineIndex] : '',
                    errorCharStart: sassError.column,
                    errorLength: 0,
                };
                for (let i = errorLine.errorCharStart; i >= 0; i--) {
                    if (STOP_CHARS.indexOf(errorLine.text.charAt(i)) > -1) {
                        break;
                    }
                    errorLine.errorCharStart = i;
                }
                for (let j = errorLine.errorCharStart; j <= errorLine.text.length; j++) {
                    if (STOP_CHARS.indexOf(errorLine.text.charAt(j)) > -1) {
                        break;
                    }
                    errorLine.errorLength++;
                }
                if (errorLine.errorLength === 0 && errorLine.errorCharStart > 0) {
                    errorLine.errorLength = 1;
                    errorLine.errorCharStart--;
                }
                diagnostic.lines.push(errorLine);
                if (errorLine.lineIndex > 0) {
                    const previousLine = {
                        lineIndex: errorLine.lineIndex - 1,
                        lineNumber: errorLine.lineNumber - 1,
                        text: srcLines[errorLine.lineIndex - 1],
                        errorCharStart: -1,
                        errorLength: -1,
                    };
                    diagnostic.lines.unshift(previousLine);
                }
                if (errorLine.lineIndex + 1 < srcLines.length) {
                    const nextLine = {
                        lineIndex: errorLine.lineIndex + 1,
                        lineNumber: errorLine.lineNumber + 1,
                        text: srcLines[errorLine.lineIndex + 1],
                        errorCharStart: -1,
                        errorLength: -1,
                    };
                    diagnostic.lines.push(nextLine);
                }
            }
            catch (e) {
                console.error(`StyleSassPlugin loadDiagnostic, ${e}`);
            }
        }
    }
    context.diagnostics.push(diagnostic);
    return diagnostic;
}
/**
 * Helper function for converting a number error code to a string
 * @param input the numeric error code to convert
 * @returns the stringified error code
 */
function formatCode(input) {
    let output = '';
    if (input != null) {
        output = String(input);
    }
    return output;
}
/**
 * Splits up a message from Sass, returning all input prior to the first '╷' character.
 * If no such character exists, the entire original message will be returned.
 * @param input the Sass message to split
 * @returns the split message
 */
function formatMessage(input) {
    let output = '';
    if (typeof input === 'string') {
        output = input.split('╷')[0];
    }
    return output;
}
/**
 * Formats the provided filename, by stripping the provided root directory out of the filename, and limiting the
 * display string to 80 characters
 * @param rootDir the root directory to strip out of the provided filename
 * @param fileName the filename to format for pretty printing
 * @returns the formatted filename
 */
function formatFileName(rootDir, fileName) {
    if (!rootDir || !fileName)
        return '';
    fileName = fileName.replace(rootDir, '');
    if (/\/|\\/.test(fileName.charAt(0))) {
        fileName = fileName.substring(1);
    }
    if (fileName.length > 80) {
        fileName = '...' + fileName.substring(fileName.length - 80);
    }
    return fileName;
}
const STOP_CHARS = [
    '',
    '\n',
    '\r',
    '\t',
    ' ',
    ':',
    ';',
    ',',
    '{',
    '}',
    '.',
    '#',
    '@',
    '!',
    '[',
    ']',
    '(',
    ')',
    '&',
    '+',
    '~',
    '^',
    '*',
    '$',
];

/**
 * Determine if the Sass plugin should be applied, based on the provided `fileName`
 *
 * @param fileName the name of a file to potentially transform
 * @returns `true` if the name of the file ends with a sass extension (.scss, .sass), case insensitive. `false`
 * otherwise
 */
function usePlugin(fileName) {
    if (typeof fileName === 'string') {
        return /(\.scss|\.sass)$/i.test(fileName);
    }
    return false;
}
/**
 * Build a list of options to provide to Sass' `render` API.
 * @param opts the options provided to the plugin within a Stencil configuration file
 * @param sourceText the source text of the file to transform
 * @param fileName the name of the file to transform
 * @param context the runtime context being used by the plugin
 * @returns the generated/normalized plugin options
 */
function getRenderOptions(opts, sourceText, fileName, context) {
    var _a;
    // Create a copy of the original sass config, so we don't modify the one provided.
    // Explicitly add `data` (as it's a required field) to be the source text
    const renderOpts = Object.assign(Object.assign({}, opts), { data: sourceText });
    // activate indented syntax if the file extension is .sass.
    // this needs to be set prior to injecting global sass (as the syntax affects the import terminator)
    renderOpts.indentedSyntax = /(\.sass)$/i.test(fileName);
    // create a copy of the original path config, so we don't modify the one provided
    renderOpts.includePaths = Array.isArray(opts.includePaths) ? opts.includePaths.slice() : [];
    // add the directory of the source file to includePaths
    renderOpts.includePaths.push(path.dirname(fileName));
    // ensure each of the includePaths is an absolute path
    renderOpts.includePaths = renderOpts.includePaths.map((includePath) => {
        if (path.isAbsolute(includePath)) {
            return includePath;
        }
        // if it's a relative path then resolve it with the project's root directory
        return path.resolve(context.config.rootDir, includePath);
    });
    // create a copy of the original global config of paths to inject, so we don't modify the one provided.
    // this is a Stencil-specific configuration, and not a part of the Sass API.
    const injectGlobalPaths = Array.isArray(opts.injectGlobalPaths) ? opts.injectGlobalPaths.slice() : [];
    if (injectGlobalPaths.length > 0) {
        // Automatically inject each of these paths into the source text.
        // This is accomplished by prepending the global stylesheets to the file being processed.
        const injectText = injectGlobalPaths
            .map((injectGlobalPath) => {
            if (!path.isAbsolute(injectGlobalPath)) {
                // convert any relative paths to absolute paths relative to the project root
                if (context.sys && typeof context.sys.normalizePath === 'function') {
                    // context.sys.normalizePath added in stencil 1.11.0
                    injectGlobalPath = context.sys.normalizePath(path.join(context.config.rootDir, injectGlobalPath));
                }
                else {
                    // TODO, eventually remove normalizePath() from @stencil/sass
                    injectGlobalPath = normalizePath(path.join(context.config.rootDir, injectGlobalPath));
                }
            }
            const importTerminator = renderOpts.indentedSyntax ? '\n' : ';';
            return `@import "${injectGlobalPath}"${importTerminator}`;
        })
            .join('');
        renderOpts.data = injectText + renderOpts.data;
    }
    // remove non-standard sass option
    delete renderOpts.injectGlobalPaths;
    // the "file" config option is not valid here
    delete renderOpts.file;
    if (context.sys && typeof context.sys.resolveModuleId === 'function') {
        const importers = [];
        if (typeof renderOpts.importer === 'function') {
            importers.push(renderOpts.importer);
        }
        else if (Array.isArray(renderOpts.importer)) {
            importers.push(...renderOpts.importer);
        }
        /**
         * Create a handler for loading files when a `@use` or `@import` rule is encountered for loading a path prefixed
         * with a tilde (~). Such imports indicate that the module should be resolved from the `node_modules` directory.
         * @param url the path to the module to load
         * @param _prev Unused - typically, this is a string identifying the stylesheet that contained the @use or @import.
         * @param done a callback to return the path to the resolved path
         */
        const importer = (url, _prev, done) => {
            if (typeof url === 'string') {
                if (url.startsWith('~')) {
                    try {
                        const m = getModuleId(url);
                        if (m.moduleId) {
                            context.sys
                                .resolveModuleId({
                                moduleId: m.moduleId,
                                containingFile: m.filePath,
                            })
                                .then((resolved) => {
                                if (resolved.pkgDirPath) {
                                    const resolvedPath = path.join(resolved.pkgDirPath, m.filePath);
                                    done({
                                        file: context.sys.normalizePath(resolvedPath),
                                    });
                                }
                                else {
                                    done(null);
                                }
                            })
                                .catch((err) => {
                                done(err);
                            });
                            return;
                        }
                    }
                    catch (e) {
                        done(e);
                    }
                }
            }
            done(null);
        };
        importers.push(importer);
        renderOpts.importer = importers;
    }
    renderOpts.silenceDeprecations = [...((_a = renderOpts.silenceDeprecations) !== null && _a !== undefined ? _a : []), 'legacy-js-api'];
    return renderOpts;
}
/**
 * Replaces the extension with the provided file name with 'css'.
 *
 * If the file does not have an extension, no transformation will be applied.
 *
 * @param fileName the name of the file whose extension should be replaced
 * @returns the updated filename, using 'css' as the file extension
 */
function createResultsId(fileName) {
    // create what the new path is post transform (.css)
    const pathParts = fileName.split('.');
    pathParts[pathParts.length - 1] = 'css';
    return pathParts.join('.');
}
function normalizePath(str) {
    // Convert Windows backslash paths to slash paths: foo\\bar ➔ foo/bar
    // https://github.com/sindresorhus/slash MIT
    // By Sindre Sorhus
    if (typeof str !== 'string') {
        throw new Error(`invalid path to normalize`);
    }
    str = str.trim();
    if (EXTENDED_PATH_REGEX.test(str) || NON_ASCII_REGEX.test(str)) {
        return str;
    }
    str = str.replace(SLASH_REGEX, '/');
    // always remove the trailing /
    // this makes our file cache look ups consistent
    if (str.charAt(str.length - 1) === '/') {
        const colonIndex = str.indexOf(':');
        if (colonIndex > -1) {
            if (colonIndex < str.length - 2) {
                str = str.substring(0, str.length - 1);
            }
        }
        else if (str.length > 1) {
            str = str.substring(0, str.length - 1);
        }
    }
    return str;
}
/**
 * Split an import path into a module ID and file path
 * @param orgImport the import path to split
 * @returns a module id and the filepath under that module id
 */
function getModuleId(orgImport) {
    if (orgImport.startsWith('~')) {
        orgImport = orgImport.substring(1);
    }
    const splt = orgImport.split('/');
    const m = {
        moduleId: null,
        filePath: null,
    };
    if (orgImport.startsWith('@') && splt.length > 1) {
        // we have a scoped package, it's module includes the word following the first slash
        m.moduleId = splt.slice(0, 2).join('/');
        m.filePath = splt.slice(2).join('/');
    }
    else {
        m.moduleId = splt[0];
        m.filePath = splt.slice(1).join('/');
    }
    return m;
}
const EXTENDED_PATH_REGEX = /^\\\\\?\\/;
const NON_ASCII_REGEX = /[^\x00-\x80]+/;
const SLASH_REGEX = /\\/g;

/**
 * The entrypoint of the Stencil Sass plugin
 *
 * This function creates & configures the plugin to be used by consuming Stencil projects
 *
 * For configuration details, please see the [GitHub README](https://github.com/ionic-team/stencil-sass).
 *
 * @param opts options to configure the plugin
 * @return the configured plugin
 */
function sass(opts = {}) {
    return {
        name: 'sass',
        pluginType: 'css',
        /**
         * Performs the Sass file compilation
         * @param sourceText the contents of the Sass file to compile
         * @param fileName the name of the Sass file to compile
         * @param context a runtime context supplied by Stencil, providing access to the current configuration, an
         * in-memory FS, etc.
         * @returns the results of the Sass file compilation
         */
        transform(sourceText, fileName, context) {
            if (!usePlugin(fileName)) {
                return null;
            }
            if (typeof sourceText !== 'string') {
                return null;
            }
            const renderOpts = getRenderOptions(opts, sourceText, fileName, context);
            const results = {
                id: createResultsId(fileName),
                dependencies: [],
            };
            if (sourceText.trim() === '') {
                results.code = '';
                return Promise.resolve(results);
            }
            return new Promise((resolve) => {
                try {
                    // invoke sass' compiler at this point
                    sassEmbedded.render(renderOpts, (err, sassResult) => {
                        if (err) {
                            loadDiagnostic(context, err, fileName);
                            results.code = `/**  sass error${err && err.message ? ': ' + err.message : ''}  **/`;
                            resolve(results);
                        }
                        else {
                            results.dependencies = Array.from(sassResult.stats.includedFiles).map((dep) => context.sys.normalizePath(dep));
                            results.code = sassResult.css.toString();
                            // write this css content to memory only so it can be referenced
                            // later by other plugins (autoprefixer)
                            // but no need to actually write to disk
                            context.fs.writeFile(results.id, results.code, { inMemoryOnly: true }).then(() => {
                                resolve(results);
                            });
                        }
                    });
                }
                catch (e) {
                    // who knows, just good to play it safe here
                    const diagnostic = {
                        level: 'error',
                        type: 'css',
                        language: 'scss',
                        header: 'sass error',
                        relFilePath: null,
                        absFilePath: null,
                        messageText: e,
                        lines: [],
                    };
                    context.diagnostics.push(diagnostic);
                    results.code = `/**  sass error${e && e.message ? ': ' + e.message : ''}  **/`;
                    resolve(results);
                }
            });
        },
    };
}

exports.sass = sass;
