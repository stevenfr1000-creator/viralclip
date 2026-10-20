# Job queue note

The current API uses FastAPI BackgroundTasks.
This is fine for a single instance and low volume.

For production:
1. Add Redis.
2. Add a Celery worker that calls `pipeline.process`.
3. Have the API enqueue a task and return the job_id immediately.
4. Store job state in Redis or a database so it survives restarts.

The health endpoint already reports `jobs_processing` so you can see load before the queue is added.
