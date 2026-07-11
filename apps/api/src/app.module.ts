import { Module } from "@nestjs/common";

import { AppController } from "./app.controller.js";
import { DatabaseModule } from "./database/database.module.js";
import { Sub2ApiModule } from "./sub2api.module.js";

@Module({
  imports: [DatabaseModule, Sub2ApiModule],
  controllers: [AppController],
})
export class AppModule {}
