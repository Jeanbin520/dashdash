import { Controller, Get, Inject } from "@nestjs/common";
import { count } from "drizzle-orm";

import { DATABASE_TOKEN, type Database } from "./database/db.js";
import { resourcePools } from "./database/schema.js";

@Controller()
export class AppController {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  @Get("health")
  health() {
    return { status: "ok" };
  }

  @Get("health/db")
  async healthDb() {
    const [result] = await this.db
      .select({ value: count() })
      .from(resourcePools);
    return { status: "ok", resourcePools: result?.value ?? 0 };
  }
}
