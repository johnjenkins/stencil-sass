import * as d from './declarations';
/**
 * Helper type to note which plugin methods are defined for this plugin.
 */
type WithRequired<T, K extends keyof T> = T & {
    [P in K]-?: T[P];
};
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
export declare function sass(opts?: d.PluginOptions): WithRequired<d.Plugin, 'transform'>;
export {};
