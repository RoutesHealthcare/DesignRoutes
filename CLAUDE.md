# DesignRoutes

A diagram editor whose drawings are `.flow` text files (the text is the source of truth; the canvas is rebuilt from it).

- **Writing, reading or reviewing a `.flow` file:** use the `designroutes-flow` skill
  (`.claude/skills/designroutes-flow/SKILL.md`). It has the whole language, how to interpret a flow, and a checker
  that runs the real parser. Don't read the engine source for this.
- **Changing the language itself:** start at `src/engine/flow/language.ts` (`parseFlow` and the `*Stmt` writers).
  Shape types live in `src/shapes/<group>.ts`, aliases in `src/engine/flow/shape-kinds.ts`. Afterwards run
  `node scripts/build-flow-skill.mjs` to regenerate the skill's shape, alias and example references.
