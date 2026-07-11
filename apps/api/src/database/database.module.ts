import { Module } from "@nestjs/common";

import { DATABASE_TOKEN, createDatabase } from "./db.js";

@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: () => createDatabase(),
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule {}
