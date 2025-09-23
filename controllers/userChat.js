import userChats from "../models/userChats.js"

async function SavePrompt(req, res){
    try {
        const userId = req.auth.userId;
        if (!userId) {
            throw new Error("User not found");
        }
        // console.log("Received body:", req.body);
        const { prompt } = req?.body;
        await userChats.updateOne(
            { userId: userId },
            { $set: { additional_prompt: prompt } }
        );
        res.status(200).send({success : true,  updatedPrompt: prompt });
    } catch (error) {
        console.error("Error saving prompt:", error);
        res.status(500).send("Error saving prompt.");
    }
}

async function getPrompt(userId) {
    try {
        if (!userId) {
            return { success: false, message: "no user found" };
        }
        const result = await userChats.findOne(
            { userId: userId }
        );
        const additional_prompt = result?.additional_prompt;
        // console.log(additional_prompt);
        return { success: true, additional_prompt: additional_prompt };
    } catch (error) {
        console.error("Error finding prompt:", error);
        return { success: false, message: "Error finding prompt." };
    }
}

export { SavePrompt, getPrompt };