export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method} is not implemented in this adapter`);
    this.name = 'NotImplementedError';
  }
}
