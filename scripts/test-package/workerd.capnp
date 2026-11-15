# `workerd test` config for the packed-package smoke. scripts/test-package.ts writes
# worker.bundle.mjs (worker.mjs bundled with the installed package) and fixtures.json
# beside it in the temp app. compatibilityDate is pinned; move it to the new release's
# date when workerd is bumped (a binary rejects a date newer than its own).
using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [(name = "main", worker = .main)],
);

const main :Workerd.Worker = (
  modules = [
    (name = "worker", esModule = embed "worker.bundle.mjs"),
    (name = "fixtures", json = embed "fixtures.json"),
  ],
  compatibilityDate = "2026-11-12",
);
