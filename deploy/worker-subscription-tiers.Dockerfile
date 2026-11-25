FROM aibeego-api:subscription-tiers-20261122 AS api-runtime
FROM aibeego-worker:before-subscription-tiers-20261122 AS patched
WORKDIR /app
COPY --from=api-runtime /app /tmp/api-runtime
COPY . /tmp/worker-overlay
RUN node /tmp/worker-overlay/patch-runtime.cjs

FROM aibeego-worker:before-subscription-tiers-20261122
WORKDIR /app
COPY --from=patched /app /app
CMD ["node", "dist/index.js"]
