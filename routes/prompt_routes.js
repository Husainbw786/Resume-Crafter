import { Router } from 'express';
import { requireAuth } from "@clerk/express";
import { SavePrompt } from '../controllers/userChat.js';

const router = Router();

router.post('/', requireAuth(), SavePrompt);

export default router;
