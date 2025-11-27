import { GoogleGenAI } from "@google/genai";
import { TableSchema, DataRecord } from "../types";

export const analyzeData = async (schema: TableSchema, records: DataRecord[]) => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Prepare a summary of the data for the prompt
  const recordSummary = records.map(r => r.data);
  const fieldInfo = schema.fields.map(f => `${f.name} (${f.type})`).join(', ');

  const prompt = `
    You are a GIS data analyst. I will provide you with a dataset from a schema named "${schema.name}".
    Schema Fields: ${fieldInfo}.
    
    Here is a sample of the data (JSON):
    ${JSON.stringify(recordSummary.slice(0, 50))} ${records.length > 50 ? '...(truncated)' : ''}

    Total records: ${records.length}.

    Please provide a concise analysis in HTML format (just the inner body content, no html/head tags) with the following:
    1. A summary of the data distribution.
    2. Identify any key trends or anomalies.
    3. Suggest 2 actionable insights based on this data.
    
    Keep the tone professional. Use <h3> for headings and <ul> for lists.
    Do not use markdown backticks.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "<p>Failed to generate analysis. Please check your API key configuration.</p>";
  }
};
