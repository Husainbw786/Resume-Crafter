import express from "express";
import cors from "cors";
import path from "path";
import url, { fileURLToPath } from "url";
import ImageKit from "imagekit";
import mongoose from "mongoose";
import Chat from "./models/chat.js";
import UserChats from "./models/userChats.js";
import { clerkMiddleware, requireAuth } from "@clerk/express";
import aiRoutes from "./routes/ai_routes.js";
import promptRoutes from "./routes/prompt_routes.js";
import { getPrompt } from "./controllers/userChat.js"; // Import getPrompt
import dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT || 3000;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.options('*', cors());
app.use(express.json());
app.use(clerkMiddleware());
mongoose.connect(process.env.MONGO)
  .then(() => { 
    console.log("MongoDB connected successfully!"); 
  })
  .catch((err) => { 
    console.error("Error connecting to MongoDB:", err.message); 
  });
// const connect = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO);
//     console.log("Connected to MongoDB");
//   } catch (err) {
//     console.log(err);
//   }
// };

// console.log(process.env.IMAGE_KIT_ENDPOINT); // Should print your endpoint
// console.log(process.env.IMAGE_KIT_PUBLIC_KEY); // Should print your public key
// console.log(process.env.IMAGE_KIT_PRIVATE_KEY);
const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
});

app.get("/api/upload", (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
});

app.post("/api/chats", requireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  const { text } = req.body;

  try {
    // CREATE A NEW CHAT
    const newChat = new Chat({
      userId: userId,
      history: [{ role: "user", parts: [{ text }] }],
    });

    const savedChat = await newChat.save();

    // CHECK IF THE USERCHATS EXISTS
    const userChats = await UserChats.find({ userId: userId });

    // IF DOESN'T EXIST CREATE A NEW ONE AND ADD THE CHAT IN THE CHATS ARRAY
    if (!userChats.length) {
      const newUserChats = new UserChats({
        userId: userId,
        chats: [
          {
            _id: savedChat._id,
            title: text.substring(0, 40),
          },
        ],
      });

      await newUserChats.save();
      res.status(201).send(newChat._id);
    } else {
      // IF EXISTS, PUSH THE CHAT TO THE EXISTING ARRAY
      await UserChats.updateOne(
        { userId: userId },
        {
          $push: {
            chats: {
              _id: savedChat._id,
              title: text.substring(0, 40),
            },
          },
        }
      );

      res.status(201).send(newChat._id);
    }
  } catch (err) {
    console.log(err);
    res.status(500).send(err.toString());
  }
});

app.get("/api/chats", requireAuth(), async (req, res) => {
  const userId = req.auth?.userId;
  
  console.log("GET /api/chats - User ID:", userId);
  console.log("GET /api/chats - Auth object:", req.auth);
  console.log("GET /api/chats - Headers:", req.headers.authorization ? 'Bearer token present' : 'No auth header');

  if (!userId) {
    console.error("No userId found in request.auth");
    return res.status(401).json({ error: "User ID not found in authentication" });
  }

  try {
    const userChats = await UserChats.find({ userId });

    // Fetch the stored prompt
    const promptData = await getPrompt(userId);

    if (userChats.length === 0) {
      return res.status(200).send({ chats: [], additional_prompt: promptData.additional_prompt });
    }

    res.status(200).send({ chats: userChats[0].chats, additional_prompt: promptData.additional_prompt });
  } catch (err) {
    console.error("Error in GET /api/chats:", err);
    res.status(500).send("Error fetching user chats!");
  }
});

app.get("/api/chats/:id", requireAuth(), async (req, res) => {
  const userId = req.auth.userId;

  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId });
    res.status(200).send(chat);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error fetching chat!");
  }
});

app.put("/api/chats/:id", requireAuth(), async (req, res) => {
  const userId = req.auth.userId;

  const { question, answer, img } = req.body;

  const newItems = [
    ...(question
      ? [{ role: "user", parts: [{ text: question }], ...(img && { img }) }]
      : []),
    { role: "assistant", parts: [{ text: answer }] },
  ];

  try {
    const updatedChat = await Chat.updateOne(
      { _id: req.params.id, userId },
      {
        $push: {
          history: {
            $each: newItems,
          },
        },
      }
    );

    res.status(200).send(updatedChat);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error adding conversation!");
  }
});

app.get("/api/debug", (req, res) => {
  res.json({
    status: "debug info",
    environment: process.env.NODE_ENV || 'development',
    hasClerkKeys: !!(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY),
    hasFrontendUrl: !!process.env.FRONTEND_URL,
    corsOrigins: process.env.NODE_ENV === 'production' 
      ? [
          process.env.FRONTEND_URL || 'https://resume-cafter-frontend.vercel.app',
          'https://resume-cafter-frontend.vercel.app',
          'https://tech.resume.crafter'
        ] 
      : "*",
    timestamp: new Date().toISOString()
  });
});

app.use("/ai", aiRoutes);
app.use("/api/prompt", promptRoutes);

app.use((err, req, res, next) => {
  console.error("Error middleware triggered:", err);
  console.error("Error stack:", err.stack);
  console.error("Request URL:", req.url);
  console.error("Request headers:", req.headers);
  
  if (err.name === 'ClerkAuthenticationError') {
    return res.status(401).json({ 
      error: "Authentication failed", 
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
  
  res.status(401).json({ 
    error: "Unauthenticated", 
    message: err.message || "Authentication required"
  });
});

app.get("/health", (req, res) => {
  res.send({ status: "up" });
});


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
