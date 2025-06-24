from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import openai
import os

openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI()

# Allow frontend to access this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all or restrict to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    transcript: Optional[str] = None

@app.post("/chat")
async def chat_endpoint(payload: ChatRequest):
    messages = payload.messages
    if payload.transcript:
        messages.append({
            "role": "user",
            "content": f"Here is the transcript:\n{payload.transcript}"
        })

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=messages
        )
        return {"response": response.choices[0].message["content"]}
    except Exception as e:
        return {"error": str(e)}
