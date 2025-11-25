import { z } from "zod";

export const createTradeSchema = z.object({
  coin: z.string().min(1),
  type: z.enum(["UP", "DOWN"]),
  amount: z.number().positive(),
  timeframe: z.number().int().min(30).max(3600),
});


