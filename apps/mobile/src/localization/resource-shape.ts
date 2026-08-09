export type TranslationShape<T> = {
  [Key in keyof T]: T[Key] extends string
    ? string
    : T[Key] extends Readonly<Record<string, unknown>>
      ? TranslationShape<T[Key]>
      : never;
};
