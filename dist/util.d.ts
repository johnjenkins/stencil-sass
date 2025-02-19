import type { LegacyOptions } from 'sass-embedded';
import * as d from './declarations';
/**
 * Determine if the Sass plugin should be applied, based on the provided `fileName`
 *
 * @param fileName the name of a file to potentially transform
 * @returns `true` if the name of the file ends with a sass extension (.scss, .sass), case insensitive. `false`
 * otherwise
 */
export declare function usePlugin(fileName: string): boolean;
/**
 * Build a list of options to provide to Sass' `render` API.
 * @param opts the options provided to the plugin within a Stencil configuration file
 * @param sourceText the source text of the file to transform
 * @param fileName the name of the file to transform
 * @param context the runtime context being used by the plugin
 * @returns the generated/normalized plugin options
 */
export declare function getRenderOptions(opts: d.PluginOptions, sourceText: string, fileName: string, context: d.PluginCtx): LegacyOptions<'async'>;
/**
 * Replaces the extension with the provided file name with 'css'.
 *
 * If the file does not have an extension, no transformation will be applied.
 *
 * @param fileName the name of the file whose extension should be replaced
 * @returns the updated filename, using 'css' as the file extension
 */
export declare function createResultsId(fileName: string): string;
export declare function normalizePath(str: string): string;
/**
 * Split an import path into a module ID and file path
 * @param orgImport the import path to split
 * @returns a module id and the filepath under that module id
 */
export declare function getModuleId(orgImport: string): {
    moduleId: string;
    filePath: string;
};
