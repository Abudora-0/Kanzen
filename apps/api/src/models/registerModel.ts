import { type Model, type Schema, model, models } from 'mongoose';

/**
 * Register a model once. Vitest runs the suite in a single process where model
 * files are imported more than once, and mongoose throws on re-registration, so
 * we reuse an existing compiled model when present. The document type is passed
 * explicitly by each caller so inference is not lost.
 */
export function registerModel<T>(name: string, schema: Schema): Model<T> {
  return (models[name] as Model<T> | undefined) ?? (model(name, schema) as unknown as Model<T>);
}
