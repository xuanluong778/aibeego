FROM node:22.22.3-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --chown=node:node standalone/ ./
COPY --chown=node:node static/ ./apps/web/.next-platform-release/static/
COPY --chown=node:node public/ ./public/
RUN rm -rf /app/apps/web/public && ln -s /app/public /app/apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
