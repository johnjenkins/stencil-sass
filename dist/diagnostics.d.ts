import type { LegacyException } from 'sass-embedded';
import * as d from './declarations';
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
export declare function loadDiagnostic(context: d.PluginCtx, sassError: LegacyException, filePath: string): d.Diagnostic | null;
