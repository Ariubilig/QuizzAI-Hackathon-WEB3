import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// GROQ SDK for Deno
const Groq = (await import("npm:groq-sdk@0.36.0")).default;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Embedded system prompt
const SYSTEM_PROMPT = `ROLE:  
You are InfiniteQuizAI, an engine designed to generate fair, verifiable quiz data for the competitive game INFINITE QUIZ.  
Your output **must always strictly follow the JSON structure described below** with zero deviation.

TASK:  
Your responsibility is to generate unique quiz questions each time you are called.
All questions must have factual and verifiable answers.  
Your output must never include text outside of the JSON.  
Your structure and field order must never change.

OUTPUT FORMAT:
You must return a JSON object with this exact structure:
{
  "quiz_id": "unique_quiz_identifier",
  "questions": [ array of 10 question objects ]
}

HARD RULES:  
For every question, you must include:
- "id" (unique identifier, e.g., "q1", "q2", etc.)
- "category" (MUST match the requested category)
- "difficulty" (easy / medium / hard)
- "question" (the question text)
- "options" (array of exactly 4 strings)
- "correct_answer" (one of "A", "B", "C", "D")
- "explanation" (brief explanation of the correct answer)

Questions must be:
- 100% factually correct  
- No subjective or opinion-based content  
- No ambiguous phrasing  
- UNIQUE - Generate different questions each time

CATEGORY RULES - CRITICAL:  
Available categories: 
- English: Science, History, Geography, Technology, Space, Pop Culture, Mathematics
- Mongolian: 'Өв Соёл', 'Спорт', 'Anime', 'eSports', 'Монголын Түүх', 'Поп Соёл', 'Монгол Хоол', 'Шинжлэх ухаан', 'Технологи', 'Математик', 'Ерөнхий мэдлэг'

IMPORTANT CATEGORY ENFORCEMENT:
- If user requests a SPECIFIC category, generate ALL 10 questions from ONLY that category.
- The "category" field in EVERY question MUST be exactly the requested category.
- If the requested category is in Mongolian (e.g., "Монголын Түүх"), ALL content (questions, options, explanation) MUST be in MONGOLIAN.
- If the requested category is in English, ALL content MUST be in ENGLISH.
- ONLY use mixed categories if the user explicitly requests "Mixed" quiz.

DIFFICULTY DISTRIBUTION:  
When user requests a SPECIFIC difficulty (easy, medium, or hard):
- ALL 10 questions MUST be of that difficulty level ONLY
- The "difficulty" field in EVERY question MUST match the requested difficulty

When user requests MIXED difficulty (or default):
- 4 questions MUST be easy
- 4 questions MUST be medium
- 2 questions MUST be hard

DIFFICULTY DEFINITIONS:  
easy = basic objective facts  
medium = general knowledge  
hard = multi-step reasoning or less commonly known facts

STRICT RULES FOR STABILITY:  
- Never add new fields  
- Never remove fields  
- Never reorder fields  
- Never include ANY text outside the JSON  
- Explanations must be factual and concise
- Options should be plain text in an array (no A., B., etc.)

RANDOMNESS RULES:  
- Generate DIFFERENT questions each time
- Vary topics and question content within the requested category
- DO NOT repeat questions from previous quizzes
- Each quiz should be completely unique

FINAL REQUIREMENT:  
Output ONLY the JSON, nothing else.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { category, difficulty } = await req.json();

    const groq = new Groq({ apiKey: Deno.env.get("GROQ_API_KEY") });

    // Add random seed for uniqueness
    const randomSeed = Date.now() + Math.random();
    let userPrompt = `Generate a completely new and unique quiz with mixed categories (seed: ${randomSeed}).`;

    if (category && category !== "Mixed") {
      userPrompt = `Generate a completely new and unique quiz about ${category}. IMPORTANT: ALL 10 questions MUST be ONLY about ${category}. Do not include any other categories. Every question's "category" field must be "${category}". (seed: ${randomSeed})`;

      // Check if category is likely Mongolian (contains non-ASCII or specific keywords)
      // This is a heuristic, but the SYSTEM_PROMPT also enforces language based on category name.
      // We can explicitly add a language instruction if needed, but the system prompt should handle it.
      if (/[а-яА-ЯөӨүҮ]/.test(category)) {
        userPrompt += `\n\nLANGUAGE REQUIREMENT: The category is Mongolian. Therefore, ALL questions, options, and explanations MUST be in MONGOLIAN.`;
      }
    }

    // Add difficulty instruction
    if (difficulty && difficulty !== "Mixed") {
      userPrompt += `\n\nDIFFICULTY REQUIREMENT: ALL 10 questions MUST be ${difficulty.toUpperCase()} difficulty ONLY. Every question's "difficulty" field must be "${difficulty.toLowerCase()}".`;
    } else {
      userPrompt += `\n\nDIFFICULTY REQUIREMENT: Use mixed difficulty with the standard distribution (4 easy, 4 medium, 2 hard questions).`;
    }

    console.log(
      `Generating quiz for category: ${category || "Mixed"}, difficulty: ${
        difficulty || "Mixed"
      }`
    );

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 1.0,
      response_format: { type: "json_object" },
    });

    const quizContent = completion.choices[0]?.message?.content;

    if (!quizContent) {
      throw new Error("No content received from AI");
    }

    let cleanContent = quizContent;
    // Remove markdown code blocks if present
    if (cleanContent.includes("```")) {
      cleanContent = cleanContent.replace(/```json\n?|```/g, "").trim();
    }

    const quizJson = JSON.parse(cleanContent);

    // Validate quiz structure
    if (
      !quizJson.questions ||
      !Array.isArray(quizJson.questions) ||
      quizJson.questions.length === 0
    ) {
      throw new Error(
        "Invalid quiz structure: questions array is missing or empty"
      );
    }

    console.log(
      `Quiz generated successfully with ${quizJson.questions.length} questions`
    );

    return new Response(JSON.stringify(quizJson), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error generating quiz:", errorMessage);
    return new Response(
      JSON.stringify({
        error: "Failed to generate quiz",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
