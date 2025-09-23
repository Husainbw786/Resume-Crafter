import { Router } from 'express';
import {openai_call, openai_general} from '../controllers/ai_controllers.js'
import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";


const router = Router();

// router.post('/openai', ClerkExpressRequireAuth(), openai_call);
router.post('/openai', ClerkExpressRequireAuth(), openai_call);
router.post('/general',openai_general);

export default router;
