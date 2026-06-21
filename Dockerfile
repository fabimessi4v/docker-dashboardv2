# Stage 1: Build the React + Material UI frontend using Node
FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Serve the production-ready dashboard via Flask
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Flask backend code and registry
COPY app.py external_services.json ./

# Prepare templates and static asset folders
RUN mkdir -p templates static

# Copy HTML index file
COPY --from=frontend-builder /frontend/dist/index.html ./templates/index.html

# Self-healing copy for Vite assets (handles different Vite layout modes dynamically)
COPY --from=frontend-builder /frontend/dist/ ./static_temp/
RUN if [ -d "./static_temp/static/assets" ]; then \
        cp -r ./static_temp/static/assets ./static/; \
    elif [ -d "./static_temp/assets" ]; then \
        cp -r ./static_temp/assets ./static/; \
    fi && rm -rf ./static_temp

EXPOSE 5000
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

CMD ["python", "app.py"]
