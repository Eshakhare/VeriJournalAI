# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
# Need contracts from parent directory, so Docker context must be repo root
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY contracts/ ./contracts/
COPY frontend/ ./frontend/
ENV VITE_API_BASE_URL=https://verijournal-ai-api-vox7kbm6kq-uc.a.run.app/api/v1
ENV VITE_FIREBASE_API_KEY=
ENV VITE_FIREBASE_AUTH_DOMAIN=
ENV VITE_FIREBASE_PROJECT_ID=
ENV VITE_FIREBASE_STORAGE_BUCKET=
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=
ENV VITE_FIREBASE_APP_ID=
ENV VITE_USE_MOCK_API=false
RUN cd frontend && npm run build

# Production stage
FROM nginx:alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

