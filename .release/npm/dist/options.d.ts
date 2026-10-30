import type { FeathersPluginOptions } from './types.js';
export declare function validateOptions(options: FeathersPluginOptions): Required<Pick<FeathersPluginOptions, 'prefix' | 'jsonLimit' | 'debounceMs' | 'adapter'>>;
