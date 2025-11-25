import { z } from "zod";

export const createWithdrawSchema = z.object({
  amount: z.number().positive(),
  toAddress: z.string().min(4),
  proofImage: z.string().optional(),
  txHash: z.string().optional(),
});


