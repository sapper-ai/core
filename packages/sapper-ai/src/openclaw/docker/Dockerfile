FROM node:20-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates bash curl \
  && rm -rf /var/lib/apt/lists/*

# OpenClaw Gateway CLI (package name verified in runtime environments)
RUN npm install -g @anthropic/openclaw-gateway@latest

ENV OPENCLAW_DM_POLICY=disabled
ENV OPENCLAW_GROUP_POLICY=disabled
ENV OPENCLAW_ENABLE_CLI=true
ENV HOME=/home/analyst

COPY install-ca.sh /opt/runtime/install-ca.sh
COPY test-runner.sh /opt/runtime/test-runner.sh

RUN chmod +x /opt/runtime/install-ca.sh /opt/runtime/test-runner.sh \
  && mkdir -p /skills /captures /run/openclaw /home/analyst \
  && chown -R root:root /opt/runtime /skills /captures /run/openclaw /home/analyst

WORKDIR /home/analyst
ENTRYPOINT ["/opt/runtime/test-runner.sh"]
