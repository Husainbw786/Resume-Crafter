import { Router } from 'express';
import {openai_call, openai_general} from '../controllers/ai_controllers.js'
import { requireAuth } from "@clerk/express";


const router = Router();

// router.post('/openai', requireAuth(), openai_call);
router.post('/openai', requireAuth(), openai_call);
router.post('/general',openai_general);

export default router;
