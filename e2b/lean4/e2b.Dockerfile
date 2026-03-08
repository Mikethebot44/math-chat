FROM e2bdev/code-interpreter:latest

RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  ca-certificates \
  curl \
  git \
  zstd \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /home/user

RUN curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh \
  | bash -s -- -y

ENV PATH="/home/user/.elan/bin:${PATH}"

RUN lake new lean_workspace math

WORKDIR /home/user/lean_workspace

RUN lake exe cache get
RUN lake build
RUN printf 'import Mathlib\n\ntheorem warmup_truth : True := by\n  trivial\n' > Warmup.lean
RUN lake env lean Warmup.lean
