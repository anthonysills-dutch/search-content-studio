/** A message a member may read: server functions pass it to the page as it is. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export function notFound(what: string): never {
  throw new UserError(`${what} not found`);
}
