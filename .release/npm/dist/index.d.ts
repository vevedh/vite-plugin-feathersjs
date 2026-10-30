import type { Plugin } from 'vite';
import type { FeathersPluginOptions } from './types.js';
export type { FeathersPluginOptions, FeathersApp, FeathersModule, SocketTransportOptions } from './types.js';
export { createFeathersApp, createFeathersRuntime } from './app.js';
export { validateOptions } from './options.js';
export default function feathersPlugin(options: FeathersPluginOptions): Plugin;
