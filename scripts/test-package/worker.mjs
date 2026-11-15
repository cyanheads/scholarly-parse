/**
 * @fileoverview workerd entry for the packed-package smoke, the `test` handler
 * `workerd test workerd.capnp` runs. `scripts/test-package.ts` bundles it with the
 * installed package (`bun build`), leaving `fixtures`, the JSON module the config embeds,
 * external.
 * @module scripts/test-package/worker
 */
import fixtures from 'fixtures';
import { smoke } from './smoke.mjs';

export default {
  async test() {
    const { lines, ok } = await smoke(fixtures);
    for (const line of lines) console.log(`workerd ${line}`);
    if (!ok) throw new Error('the packed package does not reproduce expected.md on workerd');
  },
};
