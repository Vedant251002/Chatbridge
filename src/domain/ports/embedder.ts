// Provider-agnostic embedder. Returns a fixed-dimension float vector per input.
export interface Embedder {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
