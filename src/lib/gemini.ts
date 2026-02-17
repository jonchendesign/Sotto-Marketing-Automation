export async function callGemini(prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ]
      })
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini error ${res.status}: ${txt}`);
  }

  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
