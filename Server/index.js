require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/api/quiz', async (req, res) => {
    try {
        const { category, difficulty } = req.body;
        
        // Special handling for ARD category - load from JSON file
        if (category === 'ARD') {
            console.log('Loading ARD quiz from ard.json');
            const ardPath = path.join(__dirname, 'AI', 'ard.json');
            const ardQuestions = JSON.parse(fs.readFileSync(ardPath, 'utf8'));
            
            // Shuffle and select 10 random questions
            const shuffled = ardQuestions.sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, 10);
            
            // Convert to proper quiz format
            const quizJson = {
                quiz_id: `ard_quiz_${Date.now()}`,
                questions: selected.map((q, index) => ({
                    id: `q${index + 1}`,
                    category: 'ARD',
                    difficulty: difficulty && difficulty !== 'Mixed' ? difficulty.toLowerCase() : 'medium',
                    question: q.question,
                    options: q.options,
                    correct_answer: ['A', 'B', 'C', 'D'][q.options.indexOf(q.answer)],
                    explanation: `Зөв хариулт: ${q.answer}`
                }))
            };
            
            console.log(`ARD quiz generated with ${quizJson.questions.length} questions`);
            res.json(quizJson);
            return;
        }
        
        // For other categories, use AI generation
        const rulePath = path.join(__dirname, 'AI', 'Rule.txt');
        const systemPrompt = fs.readFileSync(rulePath, 'utf8');
        
        // Add random seed for uniqueness
        const randomSeed = Date.now() + Math.random();
        let userPrompt = `Generate a completely new and unique quiz with mixed categories (seed: ${randomSeed}).`;
        if (category && category !== 'Mixed') {
            userPrompt = `Generate a completely new and unique quiz about ${category}. IMPORTANT: ALL 10 questions MUST be ONLY about ${category}. Do not include any other categories. Every question's "category" field must be "${category}". (seed: ${randomSeed})`;
        }
        
        // Add difficulty instruction
        if (difficulty && difficulty !== 'Mixed') {
            userPrompt += `\n\nDIFFICULTY REQUIREMENT: ALL 10 questions MUST be ${difficulty.toUpperCase()} difficulty ONLY. Every question's "difficulty" field must be "${difficulty.toLowerCase()}".`;
        } else {
            userPrompt += `\n\nDIFFICULTY REQUIREMENT: Use mixed difficulty with the standard distribution (4 easy, 4 medium, 2 hard questions).`;
        }

        console.log(`Generating quiz for category: ${category || 'Mixed'}, difficulty: ${difficulty || 'Mixed'}`);

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: userPrompt
                }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 1.0, // Increased for more randomness
            response_format: { type: "json_object" }
        });

        const quizContent = completion.choices[0]?.message?.content;
        
        if (!quizContent) {
            throw new Error("No content received from AI");
        }

        let cleanContent = quizContent;
        // Remove markdown code blocks if present
        if (cleanContent.includes('```')) {
            cleanContent = cleanContent.replace(/```json\n?|```/g, '').trim();
        }

        const quizJson = JSON.parse(cleanContent);
        
        // Validate quiz structure
        if (!quizJson.questions || !Array.isArray(quizJson.questions) || quizJson.questions.length === 0) {
            throw new Error("Invalid quiz structure: questions array is missing or empty");
        }

        console.log(`Quiz generated successfully with ${quizJson.questions.length} questions`);
        res.json(quizJson);

    } catch (error) {
        console.error("Error generating quiz:", error.message);
        res.status(500).json({ 
            error: "Failed to generate quiz",
            details: error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
