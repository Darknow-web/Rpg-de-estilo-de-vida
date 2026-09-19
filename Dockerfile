# Life Quest — imagen para Cloud Run
# Build: npm install → vite build (cliente) + esbuild (servidor). Runtime: node dist/server.cjs
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
# Las variables VITE_* son públicas y se incrustan en el bundle en tiempo de build.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_VAPID_PUBLIC_KEY
ARG VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY firebase-applet-config.json ./
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
