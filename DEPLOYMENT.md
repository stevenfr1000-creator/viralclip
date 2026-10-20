# ViralClip AI Deployment Guide

## Local Development (Docker)

```bash
cd viralclip-web
docker-compose up --build
```

- API: http://localhost:8000
- Frontend: http://localhost:5173

## Real path (verified)

The backend Dockerfile installs faster-whisper, mediapipe, opencv-python-headless, and yt-dlp.
A local file upload or a reachable URL exercises real transcription, scoring, and FFmpeg 9:16 cuts.

Check `GET /api/v1/health` — `real_local_path` is true when Whisper is available.

## Cloud Deployment Options

### Backend (FastAPI)
- **Railway / Render**: Connect GitHub repo, set start command `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Fly.io / AWS ECS**: Use the provided Dockerfile
- Set environment variable `GEMINI_API_KEY` for real LLM scoring

### Frontend
- **Vercel / Netlify**: Connect the `frontend` folder
- Set build command: `npm run build`
- Output directory: `dist`
- Environment: `VITE_API_URL=https://your-api-domain.com`

### Mobile
- Use Expo EAS Build for Android (.apk/.aab) and iOS (.ipa)
- Update API base URL in the app to your deployed backend

## Production Checklist
- [ ] Confirm FFmpeg is in the image
- [ ] Confirm real packages are installed (see Dockerfile)
- [ ] Add Redis + Celery for background jobs
- [ ] Use S3 or similar for clip storage
- [ ] Enable GPU workers for faster Whisper
- [ ] Add authentication
- [ ] Set up proper CORS and rate limiting
- [ ] Monitor costs (especially LLM and video processing)

## Environment Variables
```
GEMINI_API_KEY=your_key_here
S3_BUCKET=your-bucket
```
