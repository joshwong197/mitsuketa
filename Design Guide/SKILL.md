---
name: design-director
description: Direct a deliberate, distinctive product design process before and during frontend work. Use when Codex is asked to design, redesign, or improve any website, application, portal, dashboard, prototype, design system, or product surface, especially where visual quality and avoiding generic AI-produced patterns matter. It gathers the right brief, proposes and locks a design direction, builds from a design contract, runs independent screenshot critiques, and completes visual product QA.
---

# Design Director

Treat interface work as a directed design process. Establish the product purpose and design direction before writing UI code. Preserve human judgment at each approval gate.

## Operating rules

- Inspect the repository, existing product, brand material, copy, and supplied references before asking questions. Do not ask for facts already available.
- Ask concise questions that change the direction. Group them, identify blocking answers, and state safe assumptions.
- Do not create or edit frontend code, components, CSS, assets, or tokens before the brief and plan receive approval. Exception: inspect existing files or create a non-rendered planning document.
- Use real product content, realistic states, and truthful claims. Treat placeholder copy as temporary composition material.
- Seek a distinct visual grammar, not novelty for its own sake. Every decision must strengthen comprehension, trust, or the intended feeling.
- Review common AI patterns during refinement. Do not apply a blanket ban at the beginning.
- Keep iteration bounded. Use evidence from screenshots, users, accessibility checks, performance, and product metrics to decide whether another round is warranted.

## Phase 0, preflight

### Gather context

Read relevant project files first. Look for the current product, framework, routes, tokens, components, style guides, brand assets, analytics, content source, and constraints. Render or inspect the current surface when it exists.

Then ask the smallest useful set of questions. Use the question template in [references/brief-template.md](references/brief-template.md).

Require answers or explicit assumptions for these blockers:

1. Who is the user and what single action or decision matters most?
2. What must this surface communicate, collect, or enable?
3. What brand material, references, content, legal copy, or technical constraints already exist?
4. What feeling should the user leave with, and what feeling would damage the product?
5. How will success be judged, including a product measure where one is available?

Also establish device priority, accessibility needs, data states, loading and error states, image and motion constraints, and launch scope when they materially affect the design.

### Produce the pre-build plan

Return a concise plan before creating a UI. Include:

- facts observed from the project
- blocking questions and safe assumptions
- user, primary task, and success measure
- required content and states
- proposed design process and approval points
- expected files to create or alter after approval

Wait for the user to approve the brief or resolve the blockers. If the user asks to proceed under assumptions, write those assumptions into the brief and request confirmation of the selected direction before implementation.

## Phase 1, discover directions

Generate three to five genuinely different directions. Change the visual grammar, structure, imagery approach, typographic voice, and interaction character. A palette swap on the same hero, card grid, and navigation is one direction wearing several coats.

For each direction, provide:

- a short name and emotional premise
- the intended user effect
- composition and information hierarchy
- typography, color, texture, imagery, and motion approach
- a compact list of references or influences described by their qualities
- risks, accessibility considerations, and where the direction fits poorly
- patterns to avoid

Use deliberate variety techniques from the source article when useful:

- Create an internal random seed string to force a fresh association. Translate its features into specific design choices. Keep the seed out of the product.
- Combine the product with an unexpected yet relevant source of inspiration, such as an instrument panel, field notebook, editorial spread, map, workshop tool, or public wayfinding system.
- Ask for broad, short directions first. Develop only the ones that produce a real reaction from the user.
- Invite an explicit taste response: what feels alive, too familiar, too ornamental, too severe, or off-brand. Refine from that response.

Use moodboards, screenshots, or original concept imagery as a quality baseline when available. Respect rights and avoid copying a reference screen or a named artist's recognisable style.

## Phase 2, define the design contract

After the user selects or combines directions, create `design-brief.md` in the project or another agreed planning location. Use [references/brief-template.md](references/brief-template.md).

The approved brief is the design contract. It must state:

- product purpose, target user, primary action, and content hierarchy
- emotional aim and anti-aim
- layout grammar, responsive strategy, and interaction principles
- type, color, spacing, border, elevation, icon, image, and motion rules
- required states, accessibility, performance, legal, and technical limits
- acceptance criteria and the review baseline
- decisions made, open questions, and explicit exclusions

Create `design-decisions.md` if multiple people or agents will work on the surface. Record decisions with their reason, source, and date. Preserve the selected direction as later changes occur.

## Phase 3, build deliberately

Implement in small reviewable slices. Start with hierarchy and representative real content, then key states, then refinement. Render the work early at the target mobile and desktop widths.

Use image generation when an original visual asset communicates the product, establishes the chosen world, or would otherwise require an unsuitable stock image. Give the image task a precise role, composition, palette, subject, crop, and placement. Verify legibility, crop behavior, file weight, and rights before use.

Use motion only when it explains space, confirms an action, reveals a causal relationship, or provides a restrained moment of character. Respect reduced-motion preferences and test performance. Do not use movement as ornamental camouflage for weak hierarchy.

Treat generated copy as draft composition. Before release, replace every customer-facing string with approved, truthful language in the product voice.

## Phase 4, independent critic loop

Run the critic in a fresh context. Give it the approved brief, reference images or quality baseline, screenshots at target sizes, and any necessary product constraints. Withhold source code, implementation history, prior critique text, and the builder's rationale.

Use the rubric and prompt in [references/critic-rubric.md](references/critic-rubric.md). Require the critic to identify the biggest gaps, their user consequence, and precise corrective moves. A score is a diagnostic, never a substitute for judgment.

Make the highest-value fixes, render again, and repeat. Begin with one or two rounds. Stop when the work meets the approved criteria or when critique changes no longer produce material improvement. Escalate unresolved taste decisions to the human owner.

## Phase 5, deliver

Complete the release check in [references/critic-rubric.md](references/critic-rubric.md). Verify mobile and desktop screenshots, keyboard path, contrast, focus states, text zoom, loading, empty, error, success, and long-content states. Confirm that imagery, motion, copy, and claims are ready to ship.

Summarize the approved direction, material decisions, files changed, remaining risks, and validation performed. Cite the actual files, screenshots, tests, or user approval. Do not claim a review happened without its evidence.
