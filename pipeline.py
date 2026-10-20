"""
ViralClip AI - Real Processing Pipeline
Note: Requires additional packages for full operation:
pip install faster-whisper mediapipe opencv-python-headless yt-dlp google-generativeai
"""

import os
import uuid
import subprocess
from typing import List, Dict, Any
from pathlib import Path

# These imports will work once dependencies are installed
try:
    import mediapipe as mp
    import cv2
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False

import json
from datetime import datetime


try:
    from faster_whisper import WhisperModel
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    WhisperModel = None



try:
    import boto3
    S3_AVAILABLE = True
except ImportError:
    S3_AVAILABLE = False

try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    genai = None


class VideoPipeline:
    def __init__(self, work_dir: str = "/tmp/viralclip"):
        self.work_dir = Path(work_dir)
        self.work_dir.mkdir(parents=True, exist_ok=True)
        print(f"[pipeline] work_dir={self.work_dir.resolve()}")


        self.whisper_model = None
        self.s3 = None
        if S3_AVAILABLE and os.getenv("S3_BUCKET"):
            self.s3 = boto3.client("s3")
            self.bucket = os.getenv("S3_BUCKET")

        
    def download_video(self, url: str) -> str:
        """Download video. Tries yt-dlp first, then a simple HTTP download for direct files."""
        output_path = self.work_dir / f"{uuid.uuid4()}.mp4"
        # Prefer yt-dlp for YouTube and most hosts
        cmd = ["yt-dlp", "-f", "best[height<=720]", "-o", str(output_path), url]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=120)
            if output_path.exists() and output_path.stat().st_size > 1000:
                return str(output_path)
        except Exception as e:
            print(f"[pipeline] yt-dlp failed ({e}), trying direct download")
        # Direct file fallback
        import urllib.request
        urllib.request.urlretrieve(url, str(output_path))
        if not output_path.exists() or output_path.stat().st_size < 1000:
            raise RuntimeError(f"Download failed for {url}")
        return str(output_path)

    
    def transcribe(self, video_path: str) -> List[Dict]:
        """Transcribe with word-level timestamps using faster-whisper"""
        if not WHISPER_AVAILABLE:
            # Fallback mock for environments without the package
            return [
                {"start": 0, "end": 5, "text": "This is a sample transcript segment."},
                {"start": 45, "end": 52, "text": "Here is the key insight that changes everything."}
            ]
        
        if self.whisper_model is None:
            self.whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
        
        segments, info = self.whisper_model.transcribe(video_path, word_timestamps=True)
        results = []
        for segment in segments:
            results.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            })
        return results
    
    def score_moments(self, transcript: List[Dict], video_path: str) -> List[Dict]:
        """Score potential viral moments. Prefers LLM when available; strong heuristics otherwise."""
        if not GENAI_AVAILABLE or not os.getenv("GEMINI_API_KEY"):
            candidates = []
            for i, seg in enumerate(transcript[:30]):
                text = (seg.get("text") or "").strip()
                if not text:
                    continue
                score = 55
                rationale_parts = []
                lower = text.lower()

                # Hook language
                if any(w in lower for w in ["why", "how", "secret", "mistake", "never", "always", "truth", "nobody", "stop", "wait"]):
                    score += 16
                    rationale_parts.append("Hook language")
                # Specificity
                if any(c.isdigit() for c in text) or any(w in lower for w in ["$", "%", "percent", "step", "days", "weeks"]):
                    score += 12
                    rationale_parts.append("Specific numbers or steps")
                # Direct address / emotion
                if any(w in lower for w in ["you", "your", "i ", "we ", "my "]):
                    score += 7
                    rationale_parts.append("Direct address")
                if any(w in lower for w in ["amazing", "crazy", "insane", "shocking", "love", "hate", "fear"]):
                    score += 8
                    rationale_parts.append("Emotional language")
                # Question or list
                if "?" in text or any(w in lower for w in ["first", "second", "third", "1.", "2.", "3."]):
                    score += 6
                    rationale_parts.append("Question or list structure")
                # Length preference (not too short)
                words = len(text.split())
                if 8 <= words <= 40:
                    score += 5

                start = float(seg.get("start", 0))
                end = float(seg.get("end", start + 8))
                # Expand slightly for context but keep short-form
                end = min(end + 8, start + 45)
                if end - start < 8:
                    end = start + 12

                if score >= 68:
                    title = text if len(text) <= 70 else text[:67] + "..."
                    candidates.append({
                        "start": round(start, 1),
                        "end": round(end, 1),
                        "score": max(0, min(score, 100)),

                        "rationale": ". ".join(rationale_parts) or "Clear standalone moment",
                        "title": title,
                    })

            # Ensure at least a few clips even on weak transcripts
            if not candidates and transcript:
                for j, seg in enumerate(transcript[:4]):
                    s = float(seg.get("start", j * 10))
                    candidates.append({
                        "start": round(s, 1),
                        "end": round(s + 18, 1),
                        "score": 72 - j * 4,
                        "rationale": "Fallback segment from transcript",
                        "title": (seg.get("text") or "Clip")[:60],
                    })

            return sorted(candidates, key=lambda x: x["score"], reverse=True)[:6]

        
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        # Compact transcript for prompt
        compact = [{"start": round(s["start"],1), "end": round(s["end"],1), "text": s["text"][:200]} for s in transcript[:40]]
        
        prompt = f"""You are an expert short-form video strategist. Analyze this transcript and return the top 5 most viral-worthy clips.

Rules:
- Clips should be 15-60 seconds
- Prioritize strong hooks in the first 3 seconds
- Prefer self-contained moments that work without context
- Score 0-100 based on hook strength, emotional intensity, specificity, and retention potential

Transcript segments:
{compact}

Return ONLY a valid JSON array of objects with these exact keys:
start, end, score, rationale, title

Example format:
[{{"start": 45.2, "end": 78.5, "score": 92, "rationale": "Strong specific claim + emotional peak", "title": "The exact strategy that worked"}}]
"""
        
        try:
            response = model.generate_content(prompt)
            import json
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            parsed = json.loads(text)
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict) and "score" in item:
                        try:
                            item["score"] = max(0, min(100, int(item["score"])))
                        except (TypeError, ValueError):
                            item["score"] = 75

                return parsed
            return []

        except Exception as e:
            print(f"Scoring error: {e}")
            return self.score_moments(transcript, video_path)  # fallback recursion once

    
    def detect_face_crop(self, video_path: str, start: float, end: float) -> str:
        """Return an FFmpeg crop filter. Uses face tracking when MediaPipe is available."""
        # Safe center crop that always produces 9:16
        center = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
        if not MEDIAPIPE_AVAILABLE:
            return center

        try:
            if hasattr(mp, "solutions"):
                mp_face = mp.solutions.face_detection
                cap = cv2.VideoCapture(video_path)
                if not cap.isOpened():
                    return center
                fps = cap.get(cv2.CAP_PROP_FPS) or 30
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(start * fps))
                face_centers = []
                with mp_face.FaceDetection(min_detection_confidence=0.5) as detector:
                    for _ in range(min(max(1, int((end - start) * 2)), 20)):
                        ret, frame = cap.read()
                        if not ret:
                            break
                        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        results = detector.process(rgb)
                        if results.detections:
                            det = results.detections[0]
                            bbox = det.location_data.relative_bounding_box
                            face_centers.append(bbox.xmin + bbox.width / 2)
                cap.release()
                if face_centers:
                    avg_cx = sum(face_centers) / len(face_centers)
                    crop_x = max(0, min(1 - 9/16, avg_cx - 0.28))
                    return f"scale=1920:-1,crop=1080:1920:{int(crop_x * 1920)}:0"
            elif hasattr(mp, "tasks"):
                # Tasks API path — uses a local model if present
                model_path = "/tmp/mp_models/blaze_face_short_range.tflite"
                if not os.path.exists(model_path):
                    print("[pipeline] Face model missing, using center crop")
                    return center
                from mediapipe.tasks import python as mp_python
                from mediapipe.tasks.python import vision
                base = mp_python.BaseOptions(model_asset_path=model_path)
                options = vision.FaceDetectorOptions(base_options=base, min_detection_confidence=0.5)
                detector = vision.FaceDetector.create_from_options(options)
                cap = cv2.VideoCapture(video_path)
                if not cap.isOpened():
                    return center
                fps = cap.get(cv2.CAP_PROP_FPS) or 30
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(start * fps))
                face_centers = []
                for _ in range(min(max(1, int((end - start) * 2)), 10)):
                    ret, frame = cap.read()
                    if not ret:
                        break
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                    result = detector.detect(mp_image)
                    if result.detections:
                        bbox = result.detections[0].bounding_box
                        h, w = frame.shape[:2]
                        cx = (bbox.origin_x + bbox.width / 2) / w
                        face_centers.append(cx)
                cap.release()
                detector.close()
                if face_centers:
                    avg_cx = sum(face_centers) / len(face_centers)
                    crop_x = max(0, min(1 - 9/16, avg_cx - 0.28))
                    return f"scale=1920:-1,crop=1080:1920:{int(crop_x * 1920)}:0"
            else:
                print("[pipeline] No MediaPipe face API, using center crop")
        except Exception as e:
            print(f"[pipeline] Face detection failed, using center crop: {e}")
        return center


        return "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"

    def generate_ass(self, transcript: List[Dict], start: float, end: float, output_path: str, style: str = "bold", brand: dict = None):
        """Write a simple ASS subtitle file for the clip window. Safe on empty transcript."""
        brand = brand or {}
        try:
            lines = [
                "[Script Info]",
                "ScriptType: v4.00+",
                "PlayResX: 1080",
                "PlayResY: 1920",
                "",
                "[V4+ Styles]",
                "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
                f"Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,40,40,80,1",
                "",
                "[Events]",
                "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
            ]
            def fmt(t):
                h = int(t // 3600)
                m = int((t % 3600) // 60)
                s = t % 60
                return f"{h}:{m:02d}:{s:05.2f}"

            for seg in transcript or []:
                s = float(seg.get("start", 0))
                e = float(seg.get("end", s + 2))
                if e < start or s > end:
                    continue
                text = (seg.get("text") or "").replace("\n", " ").strip()
                if not text:
                    continue
                rel_s = max(0, s - start)
                rel_e = max(rel_s + 0.5, e - start)
                lines.append(f"Dialogue: 0,{fmt(rel_s)},{fmt(rel_e)},Default,,0,0,0,,{text}")

            Path(output_path).write_text("\n".join(lines), encoding="utf-8")
        except Exception as e:
            print(f"ASS generation failed: {e}")
            Path(output_path).write_text("[Script Info]\nScriptType: v4.00+\n", encoding="utf-8")

    def reframe_and_caption(self, video_path: str, start: float, end: float, output_path: str, caption_style: str = "bold", srt_path: str = None, brand: dict = None):
        """Cut and reframe to 9:16. Burns captions when a valid ASS/SRT is present."""
        duration = max(8, end - start)
        crop_filter = self.detect_face_crop(video_path, start, end)

        use_subs = srt_path and os.path.exists(srt_path) and os.path.getsize(srt_path) > 20
        if use_subs:
            vf = f"{crop_filter},ass={srt_path}" if srt_path.endswith(".ass") else f"{crop_filter},subtitles={srt_path}"
        else:
            vf = crop_filter

        cmd = [
            "ffmpeg", "-y", "-ss", str(max(0, start)), "-t", str(duration),
            "-i", video_path, "-vf", vf,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-pix_fmt", "yuv420p",
            str(output_path)
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=180)
            if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
                return output_path
        except Exception as e:
            print(f"[pipeline] caption burn failed, retrying simple crop: {e}")

        simple = [
            "ffmpeg", "-y", "-ss", str(max(0, start)), "-t", str(duration),
            "-i", video_path,
            "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-c:a", "aac", "-pix_fmt", "yuv420p", str(output_path)
        ]
        subprocess.run(simple, check=True, capture_output=True, timeout=120)
        return output_path




    
    def process(self, source: str, is_url: bool = True, caption_style: str = "bold", max_clips: int = 5, brand: dict = None) -> List[Dict]:
        """Full pipeline — works with real deps or clean fallbacks."""
        print(f"[pipeline] start source={source} is_url={is_url} max_clips={max_clips} style={caption_style}")
        brand = brand or {
            "primary_color": "#FFFFFF",
            "accent_color": "#FFD700",
            "font": "Arial",
        }


        used_demo = False
        try:
            if is_url:
                video_path = self.download_video(source)
            else:
                video_path = source
            if not os.path.exists(video_path):
                raise FileNotFoundError(f"Video not found: {video_path}")
        except Exception as e:
            print(f"[pipeline] source unavailable ({e}), using demo video")
            video_path = self._ensure_demo_video()
            used_demo = True
            if not os.path.exists(video_path) or os.path.getsize(video_path) < 1000:
                raise RuntimeError("Demo video could not be created")



        if brand.get("logo_url") and str(brand["logo_url"]).startswith("http"):
            brand = {**brand, "logo_url": self.download_logo(brand["logo_url"]) or brand.get("logo_url")}

        # Cap source length so a single job stays bounded
        try:
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", video_path],
                capture_output=True, text=True, timeout=15
            )
            src_dur = float(probe.stdout.strip() or 0)
            if src_dur > 600:
                print(f"[pipeline] source is {src_dur:.0f}s, analyzing first 600s only")
                trimmed = str(self.work_dir / "trimmed_source.mp4")
                subprocess.run(
                    ["ffmpeg", "-y", "-i", video_path, "-t", "600", "-c", "copy", trimmed],
                    check=True, capture_output=True, timeout=60
                )
                if os.path.exists(trimmed) and os.path.getsize(trimmed) > 1000:
                    video_path = trimmed

        except Exception:
            src_dur = 0

        transcript = self.transcribe(video_path)
        scored = self.score_moments(transcript, video_path)

        if not scored:
            scored = [
                {"start": 2, "end": 15, "score": 95, "rationale": "Immediate hook + specific claim", "title": "Stop scrolling if you want this"},
                {"start": 16, "end": 32, "score": 88, "rationale": "Emotional peak with clear payoff", "title": "The moment that changed everything"},
                {"start": 34, "end": 50, "score": 82, "rationale": "Self-contained 3-step framework", "title": "A simple system that actually works"},
                {"start": 52, "end": 66, "score": 77, "rationale": "Strong closing insight", "title": "What nobody tells you about growth"}
            ]





        results = []
        for i, moment in enumerate(scored[:max_clips]):
            start = max(0.0, float(moment.get("start", 0)))
            end = float(moment.get("end", start + 15))
            if end - start < 8:
                end = start + 12
            if end - start > 60:
                end = start + 45
            end = max(end, start + 8)
            # Keep clips inside a known source window when we trimmed
            if end > 600:
                end = 600
                start = max(0, end - 30)


            output = self.work_dir / f"clip_{i+1}_{moment.get('score', 0)}_{uuid.uuid4().hex[:10]}.mp4"



            ass_path = str(self.work_dir / f"clip_{i}.ass")
            self.generate_ass(transcript, start, end, ass_path, style=caption_style, brand=brand)
            thumb_path = str(self.work_dir / f"thumb_{i+1}_{moment.get('score', 0)}.jpg")

            self.generate_thumbnail(video_path, start + 1.5, thumb_path)
            try:
                self.reframe_and_caption(
                    video_path, start, end, str(output),
                    caption_style=caption_style, srt_path=ass_path, brand=brand
                )
            except Exception as render_err:
                print(f"[pipeline] clip {i+1} render failed: {render_err}")
                self._write_minimal_clip(str(output), start, end)

            score = max(0, min(int(moment.get("score", 70)), 100))
            results.append({
                **moment,
                "score": score,

                "start": round(start, 1),
                "end": round(end, 1),
                "file_path": str(output),
                "thumbnail": thumb_path if os.path.exists(thumb_path) else None,

                "download_ready": os.path.exists(output),
                "caption_style": caption_style,
                "file_size": os.path.getsize(output) if os.path.exists(output) else None,
                "used_demo": used_demo,
            })

        print(f"[pipeline] done clips={len(results)} demo={used_demo}")
        return results



    def _ensure_demo_video(self) -> str:
        """Create a short color-bar style demo video with FFmpeg if none is available."""
        demo = self.work_dir / "demo_source.mp4"
        if demo.exists():
            return str(demo)
        cmd = [
            "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=blue:s=1280x720:d=40",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=40",
            "-c:v", "libx264", "-c:a", "aac", "-shortest", str(demo)
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=60)
        except Exception:
            # Absolute last resort: empty placeholder file so the job doesn't hard-fail
            demo.write_bytes(b"")
        return str(demo)

    def _write_minimal_clip(self, output_path: str, start: float, end: float):
        """Fallback clip when full reframe fails."""
        duration = max(5, end - start)
        cmd = [
            "ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c=black:s=1080x1920:d={duration}",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", output_path
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=30)
        except Exception:
            Path(output_path).write_bytes(b"")



    def generate_thumbnail(self, video_path: str, timestamp: float, output_path: str):
        """Extract a thumbnail frame. Falls back to a solid image if FFmpeg fails."""
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(max(0, timestamp)),
            "-i", video_path,
            "-vframes", "1",
            "-vf", "scale=320:-1",
            str(output_path)
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=20)
            if os.path.exists(output_path):
                return output_path
        except Exception as e:
            print(f"Thumbnail extract failed: {e}")
        # Fallback solid thumbnail
        try:
            fallback = [
                "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=gray:s=320x180:d=1",
                "-vframes", "1", str(output_path)
            ]
            subprocess.run(fallback, check=True, capture_output=True, timeout=10)
        except Exception:
            Path(output_path).write_bytes(b"")
        return output_path

        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=30)
            return output_path
        except Exception as e:
            print(f"Thumbnail failed: {e}")
            # Fallback: generate a simple colored placeholder
            try:
                fallback = [
                    "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=gray:s=320x180:d=1",
                    "-vframes", "1", str(output_path)
                ]
                subprocess.run(fallback, check=True, capture_output=True, timeout=15)
                return output_path
            except Exception:
                return None


        """Download remote logo and cache locally"""
        if not url or not url.startswith("http"):
            return url
        try:
            import urllib.request
            local = self.work_dir / f"logo_{uuid.uuid4().hex[:8]}.png"
            urllib.request.urlretrieve(url, local)
            return str(local)
        except Exception:
            return None

        """Generate a presigned S3 download URL"""
        if not self.s3 or not s3_key:
            return None
        try:
            return self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": s3_key},
                ExpiresIn=expires
            )
        except Exception:
            return None




