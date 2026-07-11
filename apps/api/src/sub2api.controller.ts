import { Controller, Get } from "@nestjs/common";

import { GptGroupQuotaService } from "./gpt-group-quota.service.js";

@Controller("api/integrations/sub2api/gpt")
export class Sub2ApiController {
  constructor(private readonly gptGroupQuotas: GptGroupQuotaService) {}

  @Get("groups")
  getGptGroupQuotas() {
    return this.gptGroupQuotas.getGroupQuotas();
  }
}
