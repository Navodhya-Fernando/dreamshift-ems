// global.d.ts
import type { Mongoose } from 'mongoose';

declare global {
  // Cached mongoose connection holder used by src/lib/mongoose.ts.
  var mongoose: {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;
  } | undefined;
}

export {};
