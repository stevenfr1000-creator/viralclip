from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, Header, HTTPException

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import uuid
import os
import json
from datetime import datetime
from pipeline import VideoPipeline


API_KEY = os.getenv("VIRALCLIP_API_KEY", "")

def verify_api_key(x_api_key: Optional[str] = Header(None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return True


app = FastAPI(title="ViralClip AI API", version="1.7")

_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)





jobs = {}
pipeline = VideoPipeline()
JOBS_FILE = "/tmp/viralclip_jobs.json"

def load_jobs():
    global jobs
    if os.path.exists(JOBS_FILE):
        try:
            with open(JOBS_FILE, "r") as f:
                jobs = json.load(f)
        except:
            jobs = {}

def save_jobs():
    try:
        with open(JOBS_FILE, "w") as f:
            json.dump(jobs, f)
    except:
        pass

load_jobs()

ANALYTICS_FILE = "/tmp/viralclip_analytics.json"
analytics = []

def load_analytics():
    global analytics
    if os.path.exists(ANALYTICS_FILE):
        try:
            with open(ANALYTICS_FILE, "r") as f:
                analytics = json.load(f)
        except:
            analytics = []

def save_analytics():
    try:
        with open(ANALYTICS_FILE, "w") as f:
            json.dump(analytics[-500:], f)
    except:
        pass

load_analytics()

class Clip(BaseModel):

    id: str
    start: float
    end: float
    score: int
    rationale: str
    title: str
    download_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    signed_url: Optional[str] = None
    duration_s: Optional[float] = None



class Job(BaseModel):
    id: str
    status: str
    progress: int
    clips: List[Clip] = []
    message: Optional[str] = None

# Minimal user store (replace with a real DB before production)
users: dict = {}

import hashlib

def _hash_pw(password: str) -> str:
    return hashlib.sha256((password or "").encode()).hexdigest()

@app.post("/api/v1/auth/register")
def register(email: str = Form(...), password: str = Form(...)):
    """Minimal register. Replace with a real user store before production."""
    email = (email or "").strip().lower()
    if not email or "@" not in email or len(password or "") < 6:
        return {"error": "Valid email and password (6+ chars) required"}
    if email in users:
        return {"error": "Email already registered"}
    users[email] = {"email": email, "password": _hash_pw(password), "id": str(uuid.uuid4())}
    return {"status": "registered", "user_id": users[email]["id"]}

@app.post("/api/v1/auth/login")
def login(email: str = Form(...), password: str = Form(...)):
    user = users.get((email or "").strip().lower())
    if not user or user.get("password") != _hash_pw(password):
        return {"error": "Invalid credentials"}
    return {"status": "ok", "user_id": user["id"], "email": user["email"]}

def process_job(job_id: str, source: str, is_url: bool):
    try:
        jobs[job_id]["status"] = "processing"

        jobs[job_id]["progress"] = 20
        jobs[job_id]["message"] = "Downloading or preparing video..."


        save_jobs()
        
        options = jobs[job_id].get("options", {})
        user_id = jobs[job_id].get("user_id", "default")
        brand = brand_templates.get(user_id)
        
        jobs[job_id]["progress"] = 40
        jobs[job_id]["message"] = "Transcribing audio..."

        save_jobs()
        
        jobs[job_id]["progress"] = 60
        jobs[job_id]["message"] = "Scoring viral moments..."

        save_jobs()
        
        jobs[job_id]["progress"] = 80
        jobs[job_id]["message"] = "Rendering 9:16 clips..."
        save_jobs()





        
        results = pipeline.process(
            source, 
            is_url=is_url,
            caption_style=options.get("caption_style", "bold"),
            max_clips=options.get("max_clips", 5),
            brand=brand
        )
        
        jobs[job_id]["progress"] = 80
        jobs[job_id]["message"] = "Rendering clips..."
        save_jobs()


        
        clips = []
        for i, r in enumerate(results):
            clips.append(Clip(
                id=f"{job_id[:8]}-{i+1}",
                start=r.get("start", 0),
                end=r.get("end", 30),
                score=r.get("score", 75),
                rationale=r.get("rationale", "High potential moment"),
                title=r.get("title", "Viral Clip"),
                download_url=f"/api/v1/clips/{job_id}/{os.path.basename(r.get('file_path', 'clip.mp4'))}",
                thumbnail_url=f"/api/v1/thumbs/{job_id}/{os.path.basename(r.get('thumbnail', ''))}" if r.get("thumbnail") else None,
                signed_url=r.get("signed_url"),
                duration_s=round(float(r.get("end", 0)) - float(r.get("start", 0)), 1),
                file_size=r.get("file_size")
            ))




        
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["clips"] = [c.dict() for c in clips]
        jobs[job_id]["message"] = f"Complete — {len(clips)} clips ready"
        jobs[job_id]["used_demo"] = any(r.get("used_demo") for r in results)


        jobs[job_id]["completed_at"] = datetime.utcnow().isoformat()
        if clips:
            jobs[job_id]["avg_score"] = round(sum(c.score for c in clips) / len(clips), 1)
            jobs[job_id]["avg_duration_s"] = round(sum((c.duration_s or 0) for c in clips) / len(clips), 1)

        save_jobs()

    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["message"] = f"Failed: {str(e)[:160]}"
        jobs[job_id]["error"] = str(e)[:300]
        print(f"[api] job {job_id} failed: {e}")


        jobs[job_id]["progress"] = 0
        save_jobs()




# Simple brand templates with disk persistence
BRANDS_FILE = "/tmp/viralclip_brands.json"
brand_templates = {}

def load_brands():
    global brand_templates
    if os.path.exists(BRANDS_FILE):
        try:
            with open(BRANDS_FILE, "r") as f:
                brand_templates = json.load(f)
        except:
            brand_templates = {}

def save_brands():
    try:
        with open(BRANDS_FILE, "w") as f:
            json.dump(brand_templates, f)
    except:
        pass

load_brands()


@app.post("/api/v1/brands")
def save_brand(
    user_id: str = Form("default"),
    name: str = Form("Default"),
    primary_color: str = Form("#FFFFFF"),
    accent_color: str = Form("#FFD700"),
    font: str = Form("Arial"),
    logo_url: Optional[str] = Form(None)
):
    brand_templates[user_id] = {
        "name": name,
        "primary_color": primary_color,
        "accent_color": accent_color,
        "font": font,
        "logo_url": logo_url
    }
    save_brands()
    return {"status": "saved", "user_id": user_id}


@app.get("/api/v1/brands/{user_id}")
def get_brand(user_id: str):
    return brand_templates.get(user_id, {
        "name": "Default",
        "primary_color": "#FFFFFF",
        "accent_color": "#FFD700",
        "font": "Arial"
    })



@app.post("/api/v1/analytics/feedback")
def record_feedback(clip_id: str = Form(...), posted: bool = Form(False), views: int = Form(0)):
    """Persist analytics feedback for virality improvement"""
    entry = {
        "clip_id": clip_id,
        "posted": posted,
        "views": views,
        "timestamp": datetime.utcnow().isoformat()
    }
    analytics.append(entry)
    save_analytics()
    return {"status": "recorded", "total_feedback": len(analytics)}

@app.get("/api/v1/analytics/performance")
def performance_summary():
    """Simple clip performance summary"""
    if not jobs:
        return {"jobs": 0, "avg_virality": 0}
    completed = [j for j in jobs.values() if j.get("status") == "completed" and j.get("avg_score")]
    if not completed:
        return {"completed_jobs": 0, "avg_virality": 0}
    avg = round(sum(j["avg_score"] for j in completed) / len(completed), 1)
    return {
        "completed_jobs": len(completed),
        "average_virality_score": avg,
        "total_clips": sum(len(j.get("clips", [])) for j in completed),
        "total_size_bytes": sum(j.get("total_size", 0) for j in completed)
    }


    if not analytics:
        return {"average_views": 0, "posted_rate": 0, "total": 0}
    posted = sum(1 for a in analytics if a.get("posted"))
    avg_views = sum(a.get("views", 0) for a in analytics) / len(analytics)
    return {
        "total_feedback": len(analytics),
        "posted_rate": round(posted / len(analytics), 2),
        "average_views": round(avg_views, 1)
    }


@app.get("/api/v1/health")
def health():
    """Report which pipeline capabilities are available."""
    from pipeline import WHISPER_AVAILABLE, MEDIAPIPE_AVAILABLE, GENAI_AVAILABLE, S3_AVAILABLE
    return {
        "status": "ok",
        "version": "1.7",
        "capabilities": {
            "whisper": WHISPER_AVAILABLE,
            "mediapipe": MEDIAPIPE_AVAILABLE,
            "gemini": GENAI_AVAILABLE and bool(os.getenv("GEMINI_API_KEY")),
            "s3": S3_AVAILABLE and bool(os.getenv("S3_BUCKET")),
            "ffmpeg": True,
            "demo_fallback": True,
            "heuristic_scoring": True,
            "zip_download": True,
            "cancel": True,
            "real_local_path": WHISPER_AVAILABLE,
            "jobs_processing": sum(1 for j in jobs.values() if j.get("status") == "processing"),
        }




    }

@app.post("/api/v1/demo")
async def create_demo_job(background_tasks: BackgroundTasks, max_clips: int = Form(3), caption_style: str = Form("bold")):
    """Start a demo job that always produces clips via fallbacks."""
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "id": job_id,
        "user_id": "demo",
        "status": "pending",
        "progress": 5,
        "clips": [],
        "message": "Demo queued",
        "options": {"max_clips": max_clips, "caption_style": caption_style}
    }
    save_jobs()
    print(f"[api] demo job created {job_id}")
    # Use a non-existent URL so the pipeline falls back to demo video

    background_tasks.add_task(process_job, job_id, "https://demo.invalid/video", True)
    return {"job_id": job_id, "status": "processing", "mode": "demo"}


@app.get("/api/v1/jobs")
def list_jobs(user_id: Optional[str] = "default"):
    """List jobs, optionally filtered by user_id"""
    filtered = [
        {
            "id": jid,
            "status": j["status"],
            "clip_count": len(j.get("clips", [])),
            "message": j.get("message"),
            "user_id": j.get("user_id"),
            "completed_at": j.get("completed_at"),
            "avg_score": j.get("avg_score"),
            "total_size": j.get("total_size"),
        }
        for jid, j in jobs.items() if j.get("user_id") == user_id
    ]
    return {"jobs": filtered[-50:]}


@app.post("/api/v1/jobs")
async def create_job(

    background_tasks: BackgroundTasks,
    url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    max_clips = max(1, min(int(max_clips or 5), 10))
    caption_style = caption_style if caption_style in ("bold", "karaoke", "clean", "emoji") else "bold"


    user_id: Optional[str] = Form("default"),
    x_api_key: Optional[str] = Header(None)
):
    verify_api_key(x_api_key)
    if not _check_rate(user_id or "default"):
        return {"error": "Rate limit exceeded (10 jobs/hour)"}
    if not url and not file:
        return {"error": "Provide a url or a file"}
    if file and getattr(file, "size", None) and file.size > 500 * 1024 * 1024:
        return {"error": "File too large (max 500 MB)"}

        if not url and not file:
            return {"error": "Provide a url or a file"}
        if file and file.size and file.size > 500 * 1024 * 1024:
            return {"error": "File too large (max 500 MB)"}


    
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "id": job_id,
        "user_id": user_id,
        "status": "pending",
        "progress": 5,
        "clips": [],
        "message": "Queued",
        "options": {"max_clips": max_clips, "caption_style": caption_style or "bold"}
    }
    save_jobs()
    print(f"[api] job created {job_id} user={user_id} clips={max_clips} style={caption_style or 'bold'}")

    if url:
        background_tasks.add_task(process_job, job_id, url, True)
    elif file:
        temp_path = f"/tmp/{job_id}_{file.filename}"
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        background_tasks.add_task(process_job, job_id, temp_path, False)
    else:
        return {"error": "Provide a url or a file"}

    return {"job_id": job_id, "status": "processing"}


@app.get("/api/v1/jobs/{job_id}")
def get_job(job_id: str):
    if job_id not in jobs:
        return {"error": "Job not found"}
    return jobs[job_id]

@app.get("/api/v1/thumbs/{job_id}/{filename}")
def get_thumbnail(job_id: str, filename: str):
    file_path = f"/tmp/viralclip/{filename}"
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="image/jpeg")
    return {"error": "Thumbnail not found"}

@app.post("/api/v1/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    """Mark a processing job as cancelled. Best-effort stub."""
    job = jobs.get(job_id)
    if not job:
        return {"error": "Job not found"}
    if job.get("status") in ("completed", "failed", "cancelled"):
        return {"job_id": job_id, "status": job.get("status"), "message": "Already finished"}
    job["status"] = "cancelled"
    job["message"] = "Cancelled by user"
    job["progress"] = 0
    print(f"[api] cancelled job {job_id}")
    save_jobs()
    return {"job_id": job_id, "status": "cancelled"}

@app.get("/api/v1/jobs/{job_id}/zip")
def download_zip(job_id: str):


    """Return a ZIP of all clips for a job when local files exist."""
    import zipfile
    from io import BytesIO
    from fastapi.responses import StreamingResponse

    job = jobs.get(job_id)
    if not job or not job.get("clips"):
        return {"error": "No clips available"}

    buf = BytesIO()
    added = 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, clip in enumerate(job["clips"]):
            dl = clip.get("download_url", "")
            filename = dl.split("/")[-1] if dl else f"clip_{i}.mp4"
            local_path = f"/tmp/viralclip/{filename}"
            if os.path.exists(local_path):
                safe_title = (clip.get("title") or "clip")[:40].replace("/", "_")
                zf.write(local_path, arcname=f"{i+1}_{safe_title}.mp4")
                added += 1
    if added == 0:
        return {"error": "No local clip files found for this job"}

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=viralclips_{job_id[:8]}.zip"}
    )

    """Foundation for downloading only selected clips"""
    ids = [x.strip() for x in clip_ids.split(",") if x.strip()]
    job = jobs.get(job_id, {})
    selected = [c for c in job.get("clips", []) if c.get("id") in ids]
    return {
        "job_id": job_id,
        "requested": len(ids),
        "found": len(selected),
        "clips": [{"id": c["id"], "title": c.get("title"), "download_url": c.get("download_url")} for c in selected]
    }

    import zipfile
    from io import BytesIO
    from fastapi.responses import StreamingResponse
    
    job = jobs.get(job_id)
    if not job or not job.get("clips"):
        return {"error": "No clips available"}
    
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, clip in enumerate(job["clips"]):
            # Resolve local file if present
            dl = clip.get("download_url", "")
            filename = dl.split("/")[-1] if dl else f"clip_{i}.mp4"
            local_path = f"/tmp/viralclip/{filename}"
            if os.path.exists(local_path):
                zf.write(local_path, arcname=f"{i+1}_{clip.get('title', 'clip')[:30]}.mp4")
    
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=viralclips_{job_id[:8]}.zip"}
    )


    # Prefer signed S3 URL if available
    job = jobs.get(job_id, {})
    for clip in job.get("clips", []):
        if filename in (clip.get("download_url") or "") and clip.get("signed_url"):
            from fastapi.responses import RedirectResponse
            return RedirectResponse(clip["signed_url"])
    
    file_path = f"/tmp/viralclip/{filename}"
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="video/mp4", filename=filename)
    return {"error": "File not ready"}


