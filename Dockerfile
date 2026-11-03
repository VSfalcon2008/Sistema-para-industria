FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    DATA_FILE=/data/shared-data.json

WORKDIR /app
COPY . /app
EXPOSE 8000
CMD ["python", "server.py"]
