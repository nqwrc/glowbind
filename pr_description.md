🎯 **What:** Removed duplicate `QueryResult` type definition from `web/src/types.ts`.
💡 **Why:** `QueryResult` was already defined and used in `web/src/engine/bridge.ts`, so the definition in `web/src/types.ts` was redundant. Removing it reduces duplication and improves code maintainability.
✅ **Verification:** Verified by running the TypeScript compiler (`npm run build -w web`) and the server tests (`npm run test -w server`). All builds and tests pass successfully.
✨ **Result:** Cleaned up code health issue without changing behavior.
