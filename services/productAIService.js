// services/productAIService.js
const { genAI, GEMINI_MODEL } = require('../config/gemini');

/**
 * Verifies listing images for visible damage and appropriate campus parameters.
 */
async function verifyProductWithAI(title, description, imageUrls) {
    try {
        const mainImageResp = await fetch(imageUrls[0]);
        if (!mainImageResp.ok) throw new Error(`Could not fetch product image: ${mainImageResp.status}`);

        const arrayBuffer = await mainImageResp.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        const mimeType = mainImageResp.headers.get('content-type') || 'image/jpeg';

        const prompt = `
            You are an expert product moderator for a university marketplace called UniThrift.
            Analyze this product listing:
            Title: ${title}
            Description: ${description}

            Task:
            1. Verify if the image shows a real, physical product.
            2. Check if the product is appropriate for a university (no weapons, drugs, or illegal items).
            3. Confirm if the title/description matches the image.
            
            Return ONLY a JSON object in this format:
            {"verified": boolean, "reason": "short explanation", "confidence": 0-1}
        `;

        const response = await genAI.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { role: 'user', parts: [
                    { text: prompt },
                    { inlineData: { data: base64Data, mimeType } }
                ]}
            ]
        });

        const text = response.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON payload matched.');
        return JSON.parse(match[0]);
    } catch (error) {
        console.warn("AI Verification bypass/fallback applied:", error.message);
        return { verified: true, reason: 'AI moderations temporarily bypassed.', confidence: 0.5, fallback: true };
    }
}

/**
 * Generates an evaluation summary based on product attributes and reviews.
 */
async function generateProductInsights(product, reviews) {
    try {
        const reviewsText = (reviews && reviews.length > 0)
            ? reviews.map(r => `- ${r.rating}/5: "${(r.review_text || '').slice(0, 300)}"`).join('\n')
            : 'No reviews yet.';

        const prompt = `You are an AI assistant for UniThrift, a campus marketplace in India. Analyze this product listing and its reviews.

Product Title: ${product.title}
Category: ${product.category}
Condition: ${product.condition}
Price: ₹${product.price}
Description: ${product.description}

Reviews:
${reviewsText}

Task:
1. Give a short assessment of the product itself (is the description reasonable for the stated price/condition, anything a buyer should note).
2. Analyze the reviews: overall sentiment, and any recurring praise or complaints. If there are no reviews, say so plainly.
3. Give a one-word recommendation: "Positive", "Neutral", or "Caution".

Return ONLY JSON, no markdown, in this exact format:
{"product_summary": "...", "review_summary": "...", "recommendation": "Positive|Neutral|Caution"}`;

        const response = await genAI.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const text = response.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON found in Gemini response');
        return JSON.parse(match[0]);
    } catch (err) {
        console.error('Gemini product insights error:', err.message);
        return {
            product_summary: 'AI analysis is temporarily unavailable for this product.',
            review_summary: (reviews && reviews.length) ? `${reviews.length} review(s) on file.` : 'No reviews yet.',
            recommendation: 'Neutral',
            ai_unavailable: true
        };
    }
}

/**
 * Processes chat message turns with UniBot.
 */
async function chatbotChatTurn(userMessage, history) {
    const UNIBOT_SYSTEM_PROMPT = `You are UniBot, the friendly AI assistant built into UniThrift — a peer-to-peer marketplace where Indian college students buy and sell second-hand items with each other (books, electronics, dorm/hostel items, lab equipment, uniforms, etc). You and the whole website were made by Rizwaan, the developer (You are allowed to mention the developer when specifically asked to).

Your job is to help students with things like:
- How to list an item for sale, write a good title/description, and pick a fair price for a used item (given its condition, original price, and category).
- How UniThrift's seller verification works (documents are reviewed, AI gives an advisory check, a human admin makes the final call).
- How to buy safely: meeting on campus in public places, inspecting items before paying, using the in-app chat instead of sharing personal contact info too early, and never paying full amount upfront to an unverified seller.
- How to report a suspicious buyer/seller or a listing that looks like a scam.
- General navigation help (Marketplace, Sell an Item, Updates/notifications, Profile, Filters).

REAL-TIME INVENTORY INTEGRATION:
- You DO have access to live marketplace database inventory! Whenever a user asks for specific products, categories, or items currently in stock, our database dynamically queries active listings matching their intent and renders them directly below your reply in the chat window.
- NEVER tell the user that you don't have access to real-time inventory, live stock, or current listings.
- Instead, speak confidently about the fact that matching listings are being displayed below your message. For example: "I searched our campus listings and found these active matches for you below:" or "Here are some of the options currently available on campus shown below:".
- Warmly introduce the items being displayed.

Guidelines:
- Keep answers short, warm, and practical — a few sentences or a short list, not an essay.
- Give concrete price ranges/suggestions when asked, but make clear they're rough estimates, not guarantees.
- If asked something with no clear connection to UniThrift, campus marketplaces, or student life, answer briefly and helpfully anyway, but steer back to how UniThrift can help.
- Never ask for or encourage sharing OTPs, passwords, full card numbers, or other sensitive account details in chat.
- While you can see and refer to general marketplace inventory, you CANNOT access or modify an individual user's private account settings, private message history, or pending order transactions. If asked about modifying a personal listing, refer them to the Profile page.
- Do not make up UniThrift policies you're not sure about; if unsure, say so plainly rather than inventing details.
- You ONLY answer questions related to UniThrift, buying/selling on campus, pricing, safety, or using the app. If asked anything unrelated (recipes, homework, general chit-chat, coding help, etc.), do NOT answer it — respond only with a brief, polite decline and remind the user you're scoped to UniThrift. Do not provide any information, tips, or partial answers on off-topic subjects, even briefly.`;

    const contents = [
        { role: 'user', parts: [{ text: UNIBOT_SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: "Got it — I'm UniBot, ready to help students buy, sell, and stay safe on UniThrift." }] },
        ...history.map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.text }]
        })),
        { role: 'user', parts: [{ text: userMessage }] }
    ];

    const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents
    });

    return response.text || '';
}

module.exports = {
    verifyProductWithAI,
    generateProductInsights,
    chatbotChatTurn
};