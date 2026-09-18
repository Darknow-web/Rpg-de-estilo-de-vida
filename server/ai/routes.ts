import { Router, type Response } from 'express';
import { requireAuth, rateLimit, type AuthedRequest } from '../auth.ts';
import { structuredCall, AiError, aiAvailable, MODEL_ID } from './model.ts';
import {
  onboardingInputSchema,
  onboardingOutputSchema,
  appraisalInputSchema,
  appraisalOutputSchema,
  nextMissionInputSchema,
  nextMissionOutputSchema,
  availabilityInputSchema,
  availabilityOutputSchema,
} from '@/shared/schemas/ai';
import { ONBOARDING_SYSTEM_PROMPT, buildOnboardingUserPrompt } from './prompts/onboarding.ts';
import { APPRAISER_SYSTEM_PROMPT, buildAppraiserUserPrompt } from './prompts/appraiser.ts';
import { NEXT_MISSION_SYSTEM_PROMPT, buildNextMissionUserPrompt } from './prompts/nextMission.ts';
import { AVAILABILITY_SYSTEM_PROMPT, buildAvailabilityUserPrompt } from './prompts/availability.ts';
import type { z } from 'zod';

export const aiRouter = Router();
aiRouter.use(requireAuth);

aiRouter.get('/status', (_req, res) => {
  res.json({ available: aiAvailable(), model: MODEL_ID });
});

/** Respuesta uniforme: { ok: true, data } o { ok: false, fallback: true, reason }. Nunca 500 por fallo de IA. */
function replyFallback(res: Response, err: unknown) {
  const kind = err instanceof AiError ? err.kind : 'unknown';
  if (!(err instanceof AiError)) console.error('[ai] error inesperado', err);
  res.status(200).json({ ok: false, fallback: true, reason: kind });
}

function handle<TIn extends z.ZodType, TOut extends z.ZodType>(opts: {
  input: TIn;
  output: TOut;
  system: string;
  user: (i: z.infer<TIn>) => string;
  temperature?: number;
}) {
  return async (req: AuthedRequest, res: Response) => {
    const parsed = opts.input.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'bad_request', issues: parsed.error.issues.slice(0, 5) });
      return;
    }
    try {
      const data = await structuredCall({
        system: opts.system,
        user: opts.user(parsed.data),
        schema: opts.output,
        temperature: opts.temperature,
      });
      res.json({ ok: true, data, model: MODEL_ID });
    } catch (err) {
      replyFallback(res, err);
    }
  };
}

aiRouter.post(
  '/onboarding',
  rateLimit('onboarding', 12),
  handle({
    input: onboardingInputSchema,
    output: onboardingOutputSchema,
    system: ONBOARDING_SYSTEM_PROMPT,
    user: buildOnboardingUserPrompt,
    temperature: 0.8,
  }),
);

aiRouter.post(
  '/appraise',
  rateLimit('appraise', 40),
  handle({
    input: appraisalInputSchema,
    output: appraisalOutputSchema,
    system: APPRAISER_SYSTEM_PROMPT,
    user: buildAppraiserUserPrompt,
    temperature: 0.4,
  }),
);

aiRouter.post(
  '/next-mission',
  rateLimit('next-mission', 30),
  handle({
    input: nextMissionInputSchema,
    output: nextMissionOutputSchema,
    system: NEXT_MISSION_SYSTEM_PROMPT,
    user: buildNextMissionUserPrompt,
    temperature: 0.7,
  }),
);

aiRouter.post(
  '/parse-availability',
  rateLimit('availability', 30),
  handle({
    input: availabilityInputSchema,
    output: availabilityOutputSchema,
    system: AVAILABILITY_SYSTEM_PROMPT,
    user: (i) => buildAvailabilityUserPrompt(i.text),
    temperature: 0.2,
  }),
);
