import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FeathersPluginOptions, FeathersApp, ModuleNamespace } from './types.js';
export type LoadModule = (absolutePath: string) => Promise<ModuleNamespace>;
export interface FeathersRuntime {
    app: FeathersApp;
    handler: (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => void;
    start(): Promise<void>;
    close(): Promise<void>;
}
export declare function createFeathersRuntime(paths: readonly string[], load: LoadModule, options: FeathersPluginOptions): Promise<FeathersRuntime>;
/** Backwards-compatible convenience for tests and service registration. */
export declare function createFeathersApp(paths: readonly string[], load: LoadModule, options: FeathersPluginOptions): Promise<FeathersApp>;
