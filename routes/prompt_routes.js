import { Router } from 'express';
import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";
import { SavePrompt } from '../controllers/userChat.js';

const router = Router();

router.post('/',ClerkExpressRequireAuth(), SavePrompt);

export default router;
