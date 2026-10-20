# ViralClip AI - Backend

## Quick Start (Development)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\\Scripts\\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

API will be available at http://localhost:8000

## Verified real path

With faster-whisper, yt-dlp, and FFmpeg installed, a local file upload or a reachable URL produces real transcribed, scored, 9:16 clips.
Check `GET /api/v1/health` — `real_local_path` is true when Whisper is available.


## Real Clipping Pipeline

The pipeline in `pipeline.py` prefers real processing when dependencies are present:

1. Download (yt-dlp) or use an uploaded file
2. Transcribe with faster-whisper (word timestamps)
3. Score moments (Gemini when available, otherwise heuristics)
4. Cut + reframe to 9:16 (MediaPipe face tracking when available, otherwise center crop)
5. Burn ASS captions and generate a thumbnail

Demo fallbacks are used only when the source or a dependency is missing.  
Check installed capabilities at `GET /api/v1/health`.

A demo job that always produces clips (via fallbacks) is available at `POST /api/v1/demo`.

Poll job status at `GET /api/v1/jobs/{job_id}` until `status` is `completed` or `failed`.

Upload a local file with `POST /api/v1/jobs` (multipart `file`) or pass a `url`.

Brand colors and font are saved with `POST /api/v1/brands` and applied to captions when present.

Feedback on posted clips can be recorded with `POST /api/v1/analytics/feedback`.

Job cancel is available at `POST /api/v1/jobs/{job_id}/cancel` (best-effort stub).

A ZIP of all clips for a job is available at `GET /api/v1/jobs/{job_id}/zip` when local files exist.

Thumbnails are served at `GET /api/v1/thumbs/{job_id}/{filename}`.

Individual clips are served at `GET /api/v1/clips/{job_id}/{filename}`.

Bulk selection of clips is supported on the frontend; the backend bulk endpoint returns matching clip metadata.

When S3 is configured, clips may include a `signed_url` for direct download.

Performance summary is available at `GET /api/v1/analytics/performance`.

CORS is enabled for local development. Restrict origins before production.

Health can be polled from the frontend on a configurable interval.

Optional API key auth is checked via the `x-api-key` header when configured.

Rate limiting is not yet enforced; add it before public launch.

Copy `backend/.env.example` to `.env` and fill in keys before starting.

Docker Compose for local full stack is in the project root (`docker-compose.yml`).

Frontend lives in `../frontend` and talks to this API.

A React Native skeleton lives in `../../viralclip-mobile` and can call the same API.

Demo videos are generated on demand in `/tmp/viralclip` when the source is unavailable.

Pipeline logs use the `[pipeline]` prefix; API logs use `[api]`.

Brand colors should be hex (`#RRGGBB`). They are converted to ASS format when captions are generated.

Supported caption styles are `bold`, `karaoke`, `clean`, and `emoji`.

`max_clips` defaults to 5 and is capped by the number of scored moments.

Progress stages are: downloading (20%), transcribing (40%), scoring (60%), rendering (80%), complete (100%).

Jobs are scoped by `user_id` (defaults to `default`).

Brand defaults are white primary, gold accent, and Arial font when none is saved.

`completed_at` is an ISO timestamp set when a job finishes.

`avg_score` is the mean virality score of the clips in a completed job.

`file_size` is in bytes.

`duration_s` is the clip length in seconds.

Thumbnails are named `thumb_{index}_{score}.jpg` inside the work directory.

Clip files are named `clip_{index}_{score}_{shortid}.mp4`.

ASS subtitle files are named `clip_{index}.ass` and burned into the video.

`download_url` points to `/api/v1/clips/{job_id}/{filename}`.

`rationale` is a short explanation of why the clip scored well.

`title` is a short headline derived from the transcript segment.

Scores range from 0 to 100; higher is more viral-worthy.

`start` and `end` are timestamps in seconds from the source video.

`signed_url` is present when S3 is configured and provides a temporary download link.

`caption_style` on a clip records the style used when it was rendered.

`thumbnail_url` points to the JPEG thumbnail for the clip.

Job `status` is one of: pending, processing, completed, failed, cancelled.

`progress` is an integer from 0 to 100.

`message` is a human-readable status string shown in the UI.

`options` stores the request parameters (max_clips, caption_style) on the job.

`clips` is the array of rendered clip objects on a completed job.

`id` is the job UUID.

Jobs include `user_id` so history can be filtered per user.

`total_size` is the sum of clip file sizes in bytes.

`avg_duration_s` is the mean clip length in seconds for a completed job.

Health reports which real capabilities (whisper, mediapipe, gemini, s3, zip, cancel) are available.

API version is 1.6 (also reported by the health endpoint).

Demo mode (`POST /api/v1/demo`) always produces clips via fallbacks, even without a real video.

Upload a local video with the `file` field on `POST /api/v1/jobs`, or pass a `url`.

The work directory defaults to `/tmp/viralclip` and can be changed in the pipeline constructor.




















## Production checklist
- [ ] Install real pipeline packages (faster-whisper, mediapipe, yt-dlp)
- [ ] Set GEMINI_API_KEY and S3 credentials if used
- [ ] Restrict CORS origins
- [ ] Add rate limiting
- [ ] Add a job queue (Redis/Celery) for long videos
- [ ] Enable authentication
- [ ] Confirm FFmpeg is installed in the runtime image
- [ ] Test with a real YouTube URL before launch

















## Requirements

See `requirements.txt`. Uncomment the real pipeline packages for production.

## Notes

- Redis/Celery can be added for production queueing so long videos do not block the API.
- For a simple start, the current FastAPI BackgroundTasks path is sufficient for low volume.
## Environment Variables

```
GEMINI_API_KEY=your_key_here          # optional LLM scoring
S3_BUCKET=your-bucket                 # optional cloud storage
S3_REGION=us-east-1                   # optional
```

Set these before starting the server for real scoring and storage.



