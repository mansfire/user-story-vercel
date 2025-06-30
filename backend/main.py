from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import openai
import os
import requests
import json
from dotenv import load_dotenv
from jira import JIRA

load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")
FIRE_FLIES_API_KEY = os.getenv("FIREFLIES_API_KEY")
JIRA_URL = os.getenv("JIRA_URL")
JIRA_EMAIL = os.getenv("JIRA_EMAIL")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")
JIRA_PROJECT_KEY = os.getenv("JIRA_PROJECT_KEY")

SUMMARIZATION_SYSTEM_PROMPT = "Summarize the following meeting transcript."

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def stream_openai_response(system_prompt: str, user_input: str):
    completion = openai.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input}
        ],
        stream=True,
    )
    for chunk in completion:
        token = chunk.choices[0].delta.content or ""
        yield token

@app.post("/chat")
async def chat(request: Request):
    try:
        data = await request.json()
        messages = data.get("messages", [])
        transcript = data.get("transcript", "")
        user_prompt = messages[-1]["content"].lower().strip()

        async def chat_stream():
            if "summarize" in user_prompt:
                if not transcript:
                    yield "❌ No transcript loaded."
                    return
                for chunk in stream_openai_response(SUMMARIZATION_SYSTEM_PROMPT, transcript):
                    yield chunk

            elif "list" in user_prompt and "stories" in user_prompt:
                try:
                    jira = JIRA(server=JIRA_URL, basic_auth=(JIRA_EMAIL, JIRA_API_TOKEN))
                    jql = f"project = {JIRA_PROJECT_KEY} ORDER BY created DESC"
                    issues = jira.search_issues(jql, maxResults=10)
                    if not issues:
                        yield "No stories found in Jira."
                        return
                    for issue in issues:
                        yield f"- **{issue.fields.summary}** (`{issue.key}`)\n"
                except Exception as e:
                    yield f"❌ Failed to fetch stories from Jira: {e}"

            elif "generate" in user_prompt and "stories" in user_prompt:
                if not transcript:
                    yield "❌ Please load a transcript or upload feedback first."
                    return

                full_prompt = f"""
Convert the following user feedback into a list of user stories with 1–3 relevant tags and acceptance criteria.

Use this exact JSON format:
[
  {{
    "story": "As a [type of user], I want to [do something] so that [benefit].",
    "tags": ["tag1", "tag2"],
    "acceptance_criteria": ["criteria1", "criteria2"]
  }}
]

Only use user types: operator, developer, admin.
- Operators use individual cubes.
- Developers create applications for the cube.
- Administrators manage many cubes.

[Include your full acceptance criteria and examples here.]

Feedback:
{transcript}
"""
                full_response = ""
                for chunk in stream_openai_response("You are a user story generator", full_prompt):
                    full_response += chunk
                    yield chunk

            else:
                yield "🤔 Try one of the following:\n- 'Summarize the transcript'\n- 'Generate user stories'\n- 'List user stories'"

        return StreamingResponse(chat_stream(), media_type="text/plain")

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/fireflies")
async def get_fireflies_transcripts():
    print("📥 /fireflies endpoint hit")
    if not FIRE_FLIES_API_KEY:
        return JSONResponse(status_code=500, content={"error": "Fireflies API key not set"})

    try:
        query = {
            "query": """
                query Transcripts($limit: Int) {
                  transcripts(limit: $limit) {
                    id
                    title
                  }
                }
            """,
            "variables": {"limit": 10}
        }

        response = requests.post(
            "https://api.fireflies.ai/graphql",
            headers={"Authorization": f"Bearer {FIRE_FLIES_API_KEY}"},
            json=query
        )

        if response.status_code != 200:
            return JSONResponse(status_code=500, content={
                "error": f"Fireflies error {response.status_code}: {response.text}"
            })

        return JSONResponse(content=response.json()["data"]["transcripts"])

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/fireflies/transcript")
async def get_fireflies_transcript_details(id: str):
    if not FIRE_FLIES_API_KEY:
        return JSONResponse(status_code=500, content={"error": "Fireflies API key not set"})

    try:
        query = {
            "query": """
                query Transcript($transcriptId: String!) {
                  transcript(id: $transcriptId) {
                    sentences {
                      text
                    }
                  }
                }
            """,
            "variables": {"transcriptId": id}
        }

        response = requests.post(
            "https://api.fireflies.ai/graphql",
            headers={"Authorization": f"Bearer {FIRE_FLIES_API_KEY}"},
            json=query
        )

        if response.status_code != 200:
            return JSONResponse(status_code=500, content={
                "error": f"Fireflies error {response.status_code}: {response.text}"
            })

        json_data = response.json()
        sentences = json_data["data"]["transcript"]["sentences"]
        full_text = "\n".join([s["text"] for s in sentences])
        return JSONResponse(content={"transcript": full_text})

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/jira")
async def push_to_jira(request: Request):
    try:
        data = await request.json()
        story = data.get("story", "")
        tags = data.get("tags", [])

        if not story or not tags:
            return JSONResponse(status_code=400, content={"error": "Missing story or tags"})

        summary = story.split("so that")[0].strip()

        jira = JIRA(server=JIRA_URL, basic_auth=(JIRA_EMAIL, JIRA_API_TOKEN))
        issue = jira.create_issue(fields={
            "project": {"key": JIRA_PROJECT_KEY},
            "summary": summary,
            "description": f"{story}\n\nTags: {', '.join(tags)}",
            "issuetype": {"name": "Story"},
        })

        return JSONResponse(content={"message": f"Created JIRA issue {issue.key}"})

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/jira/bulk")
async def bulk_push_to_jira(request: Request):
    try:
        data = await request.json()
        stories = data.get("stories", [])

        if not stories:
            return JSONResponse(status_code=400, content={"error": "No stories provided"})

        jira = JIRA(server=JIRA_URL, basic_auth=(JIRA_EMAIL, JIRA_API_TOKEN))
        created = []

        for s in stories:
            story = s.get("story", "")
            tags = s.get("tags", [])
            summary = story.split("so that")[0].strip()

            issue = jira.create_issue(fields={
                "project": {"key": JIRA_PROJECT_KEY},
                "summary": summary,
                "description": f"{story}\n\nTags: {', '.join(tags)}",
                "issuetype": {"name": "Story"},
            })
            created.append(issue.key)

        return JSONResponse(content={"created": created})

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/jira/recent")
async def get_recent_jira_stories():
    try:
        jira = JIRA(server=JIRA_URL, basic_auth=(JIRA_EMAIL, JIRA_API_TOKEN))
        jql = f"project = {JIRA_PROJECT_KEY} ORDER BY created DESC"
        issues = jira.search_issues(jql, maxResults=10)

        results = []
        for issue in issues:
            results.append({
                "key": issue.key,
                "summary": issue.fields.summary,
                "description": issue.fields.description,
                "created": issue.fields.created,
            })

        return JSONResponse(content=results)

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
